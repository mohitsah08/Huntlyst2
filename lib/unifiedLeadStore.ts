/**
 * Unified Canonical Lead Store
 * 
 * Strict Specification Responsibilities:
 * 1. ONE canonical unified lead record per company.
 * 2. Merges Internal and External datasets cleanly without duplicate rows.
 * 3. Tracks provenance: origins ['INTERNAL', 'EXTERNAL'] -> display 'INTERNAL', 'EXTERNAL', 'BOTH'.
 * 4. Maintains full chronological statusHistory and audited manual overrides in auditTrail.
 * 5. Supports individual and bulk PASS / promote transitions.
 * 6. Disk-persisted via HuntlystDatabaseStore across reloads and restarts.
 */

import { extractCanonicalDomain } from '@/lib/deduplication';
import { dbStore } from '@/lib/db/store';
import {
  UnifiedLead,
  FinalLeadStatus,
  WorkflowOrigin,
  LeadPackage,
  ManualOverrideRecord,
  StatusHistoryEntry,
  computeOriginDisplay,
  LeadQualificationSummary,
} from '@/lib/leadPackage';
import { CompanyVerificationResult } from '@/providers/types';
import { evaluateInternalLeadPackage, type TargetProfile } from '@/lib/internalQualification';

export class UnifiedLeadStore {
  private static instance: UnifiedLeadStore;
  private leads: Map<string, UnifiedLead> = new Map();
  private domainIndex: Map<string, string> = new Map(); // canonical domain -> leadId
  private nameIndex: Map<string, string> = new Map(); // normalized name -> leadId

  private constructor() {
    this.hydrateFromDb();
  }

  public static getInstance(): UnifiedLeadStore {
    if (!UnifiedLeadStore.instance) {
      UnifiedLeadStore.instance = new UnifiedLeadStore();
    }
    return UnifiedLeadStore.instance;
  }

  private normalizeNameKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  private generateLeadId(companyName: string, domain?: string | null): string {
    if (domain) {
      const cleanDom = domain.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '');
      if (cleanDom) return `lead_${cleanDom}`;
    }
    const cleanName = this.normalizeNameKey(companyName);
    return `lead_${cleanName || Math.random().toString(36).slice(2, 10)}`;
  }

  private hydrateFromDb(): void {
    try {
      const persisted = (dbStore as any).getUnifiedLeadsRaw?.() || [];
      for (const lead of persisted) {
        this.leads.set(lead.id, lead);
        if (lead.identity.canonical_domain) {
          this.domainIndex.set(lead.identity.canonical_domain.toLowerCase(), lead.id);
        }
        if (lead.identity.company_name) {
          this.nameIndex.set(this.normalizeNameKey(lead.identity.company_name), lead.id);
        }
      }
    } catch (err) {
      console.warn('[UnifiedLeadStore] Warning hydrating from database:', err);
    }
  }

  private persistToDb(): void {
    try {
      const allLeads = Array.from(this.leads.values());
      (dbStore as any).saveUnifiedLeadsRaw?.(allLeads);
    } catch (err) {
      console.warn('[UnifiedLeadStore] Warning saving to database:', err);
    }
  }

  /**
   * Finds existing canonical lead by domain or normalized name fingerprint
   */
  public findExistingLead(companyName: string, domain?: string | null): UnifiedLead | undefined {
    if (domain) {
      const leadId = this.domainIndex.get(domain.toLowerCase());
      if (leadId && this.leads.has(leadId)) {
        return this.leads.get(leadId);
      }
    }
    const nameKey = this.normalizeNameKey(companyName);
    if (nameKey) {
      const leadId = this.nameIndex.get(nameKey);
      if (leadId && this.leads.has(leadId)) {
        return this.leads.get(leadId);
      }
    }
    return undefined;
  }

  /**
   * Upserts a lead from INTERNAL workflow (Agent 1 + Internal Qualification)
   */
  public upsertLeadFromInternal(
    pkg: LeadPackage,
    evalOrProfile:
      | {
          finalStatus: FinalLeadStatus;
          qualification: LeadQualificationSummary;
          verdictReason: string;
        }
      | TargetProfile
  ): UnifiedLead {
    const now = new Date().toISOString();
    const compName = pkg.seed_data.normalized.company_name;
    const website = pkg.seed_data.normalized.website || '';
    const canonicalDomain = (pkg.seed_data.normalized.canonical_domain || (website ? extractCanonicalDomain(website) : '')).toLowerCase();

    // If a TargetProfile was passed directly, evaluate it now
    let evalResult: {
      finalStatus: FinalLeadStatus;
      qualification: LeadQualificationSummary;
      verdictReason: string;
    };

    if ('geography' in (evalOrProfile as any) || 'industries' in (evalOrProfile as any)) {
      const evaluation = evaluateInternalLeadPackage(pkg, evalOrProfile as TargetProfile);
      evalResult = {
        finalStatus: evaluation.finalStatus,
        qualification: evaluation.qualification,
        verdictReason: evaluation.verdictReason,
      };
    } else {
      evalResult = evalOrProfile as any;
    }

    let existing = this.findExistingLead(compName, canonicalDomain);

    const historyEntry: StatusHistoryEntry = {
      status: evalResult.finalStatus,
      source: 'INTERNAL_AUTO',
      timestamp: now,
      reason: evalResult.verdictReason || 'Evaluated against target profile using internal dataset',
    };

    if (existing) {
      // Merge into existing canonical lead!
      const origins: WorkflowOrigin[] = existing.origins.includes('INTERNAL')
        ? existing.origins
        : [...existing.origins, 'INTERNAL'];

      const internalSnapshot = {
        source_file: pkg.source.file_name,
        source_row: pkg.source.row_number,
        sheet_name: pkg.source.sheet_name || null,
        page_number: pkg.source.page_number || null,
        raw_data: { ...pkg.seed_data.raw_fields },
        normalized_data: { ...pkg.seed_data.normalized },
        audit: { ...pkg.audit },
        lead_package: pkg,
        status: evalResult.finalStatus,
        status_history: existing.internal?.status_history
          ? [...existing.internal.status_history, historyEntry]
          : [historyEntry],
        evaluated_at: now,
      };

      existing.origins = origins;
      existing.originDisplay = computeOriginDisplay(origins);
      existing.internal = internalSnapshot;
      existing.currentStatus = evalResult.finalStatus;
      existing.qualification = evalResult.qualification;
      existing.statusHistory.push(historyEntry);
      existing.updatedAt = now;

      this.persistToDb();
      return existing;
    }

    // New Canonical Lead
    const leadId = this.generateLeadId(compName, canonicalDomain);
    const origins: WorkflowOrigin[] = ['INTERNAL'];

    const newLead: UnifiedLead = {
      id: leadId,
      identity: {
        company_name: compName,
        canonical_domain: canonicalDomain,
        website,
      },
      origins,
      originDisplay: 'INTERNAL',
      internal: {
        source_file: pkg.source.file_name,
        source_row: pkg.source.row_number,
        sheet_name: pkg.source.sheet_name || null,
        page_number: pkg.source.page_number || null,
        raw_data: { ...pkg.seed_data.raw_fields },
        normalized_data: { ...pkg.seed_data.normalized },
        audit: { ...pkg.audit },
        lead_package: pkg,
        status: evalResult.finalStatus,
        status_history: [historyEntry],
        evaluated_at: now,
      },
      currentStatus: evalResult.finalStatus,
      qualification: evalResult.qualification,
      auditTrail: [],
      statusHistory: [historyEntry],
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: now,
    };

    this.leads.set(leadId, newLead);
    if (canonicalDomain) this.domainIndex.set(canonicalDomain, leadId);
    if (compName) this.nameIndex.set(this.normalizeNameKey(compName), leadId);

    this.persistToDb();
    return newLead;
  }

  /**
   * Upserts a lead from EXTERNAL workflow (live web intelligence)
   */
  public upsertLeadFromExternal(
    extResult: CompanyVerificationResult,
    targetProfileId?: string
  ): UnifiedLead {
    const now = new Date().toISOString();
    const compName = extResult.company.name;
    const website = extResult.company.website || '';
    const canonicalDomain = (extractCanonicalDomain(website) || '').toLowerCase();

    // Map external verificationStatus to the 4 final statuses:
    // QUALIFIED -> VERIFIED, REVIEW -> REVIEW, REJECTED -> REJECTED, UNVERIFIED / PARTIALLY_VERIFIED / ERROR -> UNVERIFIED
    let normalizedFinalStatus: FinalLeadStatus;
    if (extResult.verificationStatus === 'QUALIFIED') {
      normalizedFinalStatus = 'VERIFIED';
    } else if (extResult.verificationStatus === 'REJECTED') {
      normalizedFinalStatus = 'REJECTED';
    } else if (extResult.verificationStatus === 'REVIEW') {
      normalizedFinalStatus = 'REVIEW';
    } else {
      normalizedFinalStatus = 'UNVERIFIED';
    }

    let existing = this.findExistingLead(compName, canonicalDomain);

    const historyEntry: StatusHistoryEntry = {
      status: normalizedFinalStatus,
      source: 'EXTERNAL_AUTO',
      timestamp: now,
      reason: extResult.decisionExplanation || extResult.rejectionReason || 'External research & qualification completed',
    };

    // Format qualification criteria for unified view
    const formattedCriteria: LeadQualificationSummary['criteria'] = {};
    const criteriaObj = extResult.criteria || {};
    for (const [k, v] of Object.entries(criteriaObj)) {
      if (!v) continue;
      formattedCriteria[k] = {
        name: k.charAt(0).toUpperCase() + k.slice(1),
        category: 'research',
        active: true,
        status: v.status as any,
        requiredValue: v.target || undefined,
        actualValue: v.value || undefined,
        reason: v.reason || `${k} status: ${v.status}`,
        evidence: v.evidence || undefined,
        weight: 10,
      };
    }

    const qualificationSummary: LeadQualificationSummary = {
      target_profile_id: targetProfileId || 'target_profile_active',
      match_percentage: `${extResult.company.confidenceScore || 85}%`,
      match_score: extResult.company.confidenceScore || 85,
      criteria: formattedCriteria,
      passedCriteria: extResult.passedCriteria || [],
      failedCriteria: extResult.failedCriteria || [],
      missingCriteria: extResult.unknownCriteria || [],
      reviewCriteria: extResult.verificationStatus === 'REVIEW' ? [extResult.rejectionReason || 'Under Review'] : [],
      exactReason: extResult.decisionExplanation || extResult.rejectionReason,
    };

    const externalSnapshot = {
      researched: true,
      current_data: { ...extResult.company },
      evidence: {
        sources: extResult.sources || [],
        ...(extResult.fieldAudits ? extResult.fieldAudits : {}),
      },
      status: normalizedFinalStatus,
      status_history: existing?.external?.status_history
        ? [...existing.external.status_history, historyEntry]
        : [historyEntry],
      researched_at: now,
      sources: extResult.sources || [],
    };

    if (existing) {
      // Merge into existing canonical lead!
      const origins: WorkflowOrigin[] = existing.origins.includes('EXTERNAL')
        ? existing.origins
        : [...existing.origins, 'EXTERNAL'];

      existing.origins = origins;
      existing.originDisplay = computeOriginDisplay(origins);
      existing.external = externalSnapshot;
      existing.currentStatus = normalizedFinalStatus;
      existing.qualification = qualificationSummary;
      existing.statusHistory.push(historyEntry);
      existing.updatedAt = now;
      existing.lastVerifiedAt = now;

      this.persistToDb();
      return existing;
    }

    // New Canonical Lead
    const leadId = this.generateLeadId(compName, canonicalDomain);
    const origins: WorkflowOrigin[] = ['EXTERNAL'];

    const newLead: UnifiedLead = {
      id: leadId,
      identity: {
        company_name: compName,
        canonical_domain: canonicalDomain,
        website,
      },
      origins,
      originDisplay: 'EXTERNAL',
      external: externalSnapshot,
      currentStatus: normalizedFinalStatus,
      qualification: qualificationSummary,
      auditTrail: [],
      statusHistory: [historyEntry],
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: now,
    };

    this.leads.set(leadId, newLead);
    if (canonicalDomain) this.domainIndex.set(canonicalDomain, leadId);
    if (compName) this.nameIndex.set(this.normalizeNameKey(compName), leadId);

    this.persistToDb();
    return newLead;
  }

  /**
   * Applies a manual status override with full audit tracking.
   * Requirement 8 & 25: Never destroy original machine decision.
   */
  public manualOverrideStatus(
    leadId: string,
    newStatus: FinalLeadStatus,
    overrideReason: string,
    overrideBy: string = 'User Action',
    workflow: WorkflowOrigin = 'INTERNAL'
  ): UnifiedLead {
    const lead = this.leads.get(leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const now = new Date().toISOString();
    const origStatus = lead.currentStatus;

    const auditRecord: ManualOverrideRecord = {
      lead_id: leadId,
      workflow,
      original_status: origStatus,
      new_status: newStatus,
      manual_override: true,
      override_by: overrideBy,
      override_at: now,
      override_reason: overrideReason,
      previous_status_history_id: `hist_${lead.statusHistory.length}`,
      source: 'USER_ACTION',
    };

    const historyEntry: StatusHistoryEntry = {
      status: newStatus,
      source: 'MANUAL_OVERRIDE',
      timestamp: now,
      override_by: overrideBy,
      reason: overrideReason || `Manual promotion from ${origStatus} to ${newStatus}`,
      previous_status: origStatus,
    };

    lead.currentStatus = newStatus;
    lead.auditTrail.push(auditRecord);
    lead.statusHistory.push(historyEntry);
    lead.updatedAt = now;

    this.persistToDb();
    return lead;
  }

  /**
   * Bulk Pass / Status Override across multiple records
   */
  public bulkManualOverrideStatus(
    leadIds: string[],
    newStatus: FinalLeadStatus,
    overrideReason: string,
    overrideBy: string = 'User Action',
    workflow: WorkflowOrigin = 'INTERNAL'
  ): UnifiedLead[] {
    const updated: UnifiedLead[] = [];
    for (const id of leadIds) {
      if (this.leads.has(id)) {
        updated.push(this.manualOverrideStatus(id, newStatus, overrideReason, overrideBy, workflow));
      }
    }
    return updated;
  }

  /**
   * Retrieves leads with optional filtering by status, origin, and search term
   */
  public getLeads(filters?: {
    status?: FinalLeadStatus | 'ALL';
    origin?: 'INTERNAL' | 'EXTERNAL' | 'BOTH' | 'ALL';
    search?: string;
  }): UnifiedLead[] {
    if (this.leads.size === 0) {
      this.hydrateFromDb();
    }
    let list = Array.from(this.leads.values());

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter(l => l.currentStatus === filters.status);
    }

    if (filters?.origin && filters.origin !== 'ALL') {
      if (filters.origin === 'BOTH') {
        list = list.filter(l => l.originDisplay === 'BOTH');
      } else {
        list = list.filter(l => l.originDisplay === filters.origin || l.originDisplay === 'BOTH');
      }
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(l =>
        l.identity.company_name.toLowerCase().includes(q) ||
        l.identity.website.toLowerCase().includes(q) ||
        (l.internal?.normalized_data.industry || '').toLowerCase().includes(q) ||
        (l.internal?.normalized_data.country || '').toLowerCase().includes(q) ||
        (l.external?.current_data.industry || '').toLowerCase().includes(q)
      );
    }

    // Sort by updated timestamp desc
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getLeadById(id: string): UnifiedLead | undefined {
    return this.leads.get(id);
  }

  public clearLeads(): void {
    this.leads.clear();
    this.domainIndex.clear();
    this.nameIndex.clear();
    this.persistToDb();
  }

  public clear(): void {
    this.clearLeads();
  }

  public getAllLeads(): UnifiedLead[] {
    if (this.leads.size === 0) {
      this.hydrateFromDb();
    }
    return Array.from(this.leads.values());
  }

  public manualStatusOverride(
    leadId: string,
    newStatus: FinalLeadStatus,
    overrideReason: string,
    overrideBy: string = 'User Action',
    workflow: WorkflowOrigin = 'INTERNAL'
  ): UnifiedLead {
    return this.manualOverrideStatus(leadId, newStatus, overrideReason, overrideBy, workflow);
  }

  public bulkManualStatusOverride(
    leadIds: string[],
    newStatus: FinalLeadStatus,
    overrideReason: string,
    overrideBy: string = 'User Action',
    workflow: WorkflowOrigin = 'INTERNAL'
  ): UnifiedLead[] {
    return this.bulkManualOverrideStatus(leadIds, newStatus, overrideReason, overrideBy, workflow);
  }
}


export const unifiedLeadStore = UnifiedLeadStore.getInstance();
