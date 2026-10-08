/**
 * Huntlyst Persistent Storage & Search Session Memory
 * 
 * Provides disk-persisted, indexed memory across API restarts and reloads:
 * 1. Global domain & company fingerprint deduplication index
 * 2. Search session tracking (targets, queries, stagnation counts, candidates)
 * 3. Saved leads and complete search history
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DbSearchSession,
  DbSearchTarget,
  DbSearchQuery,
  DbSearchResult,
  DbCompany,
  DbEvidence,
  DbSavedLead,
  DbSearchHistoryItem,
} from './types';
import { CompanyRecord, RejectedCompanyRecord } from '@/lib/types';
import { TargetProfile } from '@/lib/targetProfileData';

interface PersistedState {
  version: number;
  sessions: Record<string, DbSearchSession>;
  queries: DbSearchQuery[];
  results: DbSearchResult[];
  companies: Record<string, DbCompany>;
  evidence: DbEvidence[];
  savedLeads: Record<string, DbSavedLead>;
  history: DbSearchHistoryItem[];
  seenDomains: Record<string, number>; // canonical domain -> count
  seenFingerprints: Record<string, string>; // fingerprint -> timestamp
  unifiedLeads?: any[];
}

class HuntlystDatabaseStore {
  private static instance: HuntlystDatabaseStore;
  private stateFilePath: string;
  private state: PersistedState;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    const isVercel = Boolean(process.env.VERCEL);
    const dataDir = isVercel
      ? path.join('/tmp', '.huntlyst', 'data')
      : (process.env.HUNTLYST_DATA_DIR || path.join(process.cwd(), '.huntlyst', 'data'));

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[Huntlyst DB] Warning creating data directory:', err);
    }

    this.stateFilePath = path.join(dataDir, 'huntlyst_store.json');
    this.state = this.loadState();
  }

  public static getInstance(): HuntlystDatabaseStore {
    if (!HuntlystDatabaseStore.instance) {
      HuntlystDatabaseStore.instance = new HuntlystDatabaseStore();
    }
    return HuntlystDatabaseStore.instance;
  }

  private loadState(): PersistedState {
    try {
      let targetPath = this.stateFilePath;
      if (!fs.existsSync(targetPath)) {
        const repoSeedPath = path.join(process.cwd(), '.huntlyst', 'data', 'huntlyst_store.json');
        if (fs.existsSync(repoSeedPath)) {
          targetPath = repoSeedPath;
        }
      }

      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          version: parsed.version || 1,
          sessions: parsed.sessions || {},
          queries: parsed.queries || [],
          results: parsed.results || [],
          companies: parsed.companies || {},
          evidence: parsed.evidence || [],
          savedLeads: parsed.savedLeads || {},
          history: parsed.history || [],
          seenDomains: parsed.seenDomains || {},
          seenFingerprints: parsed.seenFingerprints || {},
          unifiedLeads: parsed.unifiedLeads || [],
        };
      }
    } catch (err) {
      console.warn('[Huntlyst DB] Error reading database file, initializing fresh store:', err);
    }

    return {
      version: 1,
      sessions: {},
      queries: [],
      results: [],
      companies: {},
      evidence: [],
      savedLeads: {},
      history: [],
      seenDomains: {},
      seenFingerprints: {},
      unifiedLeads: [],
    };
  }

  public saveNow(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Huntlyst DB] Failed to save state to disk:', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveNow();
    }, 200);
  }

  // --- SESSIONS ---
  public getOrCreateSession(
    sessionId: string,
    targetProfile: TargetProfile,
    targetLeads: number = 15
  ): DbSearchSession {
    if (this.state.sessions[sessionId]) {
      return this.state.sessions[sessionId];
    }

    const target: DbSearchTarget = {
      rawQuery: targetProfile.name || undefined,
      geography: {
        countries: targetProfile.countries || [],
        regions: targetProfile.regions || [],
        excludedCountries: targetProfile.excludedCountries || [],
        usPresenceMode: targetProfile.usPresenceMode || 'minimal_or_none',
      },
      funding: {
        min: targetProfile.fundingMin || 1_000_000,
        max: targetProfile.fundingMax || 5_000_000,
        currency: targetProfile.fundingCurrency || 'USD',
        mode: targetProfile.financialMetric,
      },
      industries: targetProfile.industries || [],
      subIndustries: targetProfile.subIndustries || [],
      companyStages: targetProfile.companyStages || [],
      targetCount: targetLeads,
    };

    const session: DbSearchSession = {
      id: sessionId,
      status: 'active',
      target,
      targetLeads,
      alreadyFoundCount: 0,
      qualifiedCount: 0,
      rejectedCount: 0,
      previouslySeenCount: 0,
      newCandidatesCount: 0,
      duplicatesRemovedCount: 0,
      sourcesSearched: [],
      stagnationCounter: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.sessions[sessionId] = session;
    this.scheduleSave();
    return session;
  }

  public getSession(sessionId: string): DbSearchSession | undefined {
    return this.state.sessions[sessionId];
  }

  public updateSession(sessionId: string, updates: Partial<DbSearchSession>): DbSearchSession {
    const existing = this.state.sessions[sessionId];
    if (!existing) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.state.sessions[sessionId] = updated;
    this.scheduleSave();
    return updated;
  }

  public listSessions(): DbSearchSession[] {
    return Object.values(this.state.sessions).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // --- QUERIES ---
  public recordQuery(query: DbSearchQuery): void {
    this.state.queries.push(query);
    if (this.state.queries.length > 1000) {
      this.state.queries = this.state.queries.slice(-800);
    }
    this.scheduleSave();
  }

  public getSessionQueries(sessionId: string): DbSearchQuery[] {
    return this.state.queries.filter((q) => q.sessionId === sessionId);
  }

  // --- DEDUPLICATION & SEEN DOMAINS ---
  public isDomainPreviouslySeen(domain: string): boolean {
    const clean = domain.toLowerCase().trim();
    return (this.state.seenDomains[clean] || 0) > 0;
  }

  public isFingerprintSeen(fingerprint: string): boolean {
    return Boolean(this.state.seenFingerprints[fingerprint]);
  }

  public markDomainSeen(domain: string, fingerprint?: string): void {
    const clean = domain.toLowerCase().trim();
    this.state.seenDomains[clean] = (this.state.seenDomains[clean] || 0) + 1;
    if (fingerprint) {
      this.state.seenFingerprints[fingerprint] = new Date().toISOString();
    }
    this.scheduleSave();
  }

  public getAllSeenDomains(): string[] {
    return Object.keys(this.state.seenDomains);
  }

  // --- CANDIDATES & RESULTS ---
  public recordResult(result: DbSearchResult): void {
    this.state.results.push(result);
    this.markDomainSeen(result.canonicalDomain, result.fingerprint);
    if (this.state.results.length > 2000) {
      this.state.results = this.state.results.slice(-1500);
    }
    this.scheduleSave();
  }

  // --- SAVED LEADS ---
  public saveLead(company: CompanyRecord, notes?: string, tags?: string[]): DbSavedLead {
    const key = (company.website || company.name).toLowerCase().trim();
    const item: DbSavedLead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company,
      savedAt: new Date().toISOString(),
      notes,
      tags,
    };
    this.state.savedLeads[key] = item;
    this.scheduleSave();
    return item;
  }

  public getSavedLeads(): CompanyRecord[] {
    return Object.values(this.state.savedLeads).map((l) => l.company);
  }

  public removeSavedLead(nameOrWebsite: string): void {
    const key = nameOrWebsite.toLowerCase().trim();
    delete this.state.savedLeads[key];
    // Also remove by matching company website or name
    for (const [k, v] of Object.entries(this.state.savedLeads)) {
      if (
        v.company.name.toLowerCase() === key ||
        v.company.website?.toLowerCase() === key
      ) {
        delete this.state.savedLeads[k];
      }
    }
    this.scheduleSave();
  }

  // --- SEARCH HISTORY ---
  public recordHistory(item: DbSearchHistoryItem): void {
    this.state.history.unshift(item);
    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(0, 100);
    }
    this.scheduleSave();
  }

  public getSearchHistory(): DbSearchHistoryItem[] {
    return this.state.history;
  }

  // --- UNIFIED LEADS ---
  public getUnifiedLeadsRaw(): any[] {
    return this.state.unifiedLeads || [];
  }

  public saveUnifiedLeadsRaw(leads: any[]): void {
    this.state.unifiedLeads = leads;
    this.saveNow();
  }
}

export const dbStore = HuntlystDatabaseStore.getInstance();
