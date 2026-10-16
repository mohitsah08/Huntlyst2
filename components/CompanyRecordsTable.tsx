'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { InternalRecordDTO } from '@/app/api/discovery/internal/records/route';
import InternalWorkflowSettingsModal from './InternalWorkflowSettingsModal';
import InternalCompanyDossierModal from './InternalCompanyDossierModal';
import {
  InternalWorkflowSettings,
  loadInternalSettings,
} from '@/lib/internalSettings';
import {
  downloadCsvFile,
  downloadXlsxFile,
  downloadUniversalJson,
} from '@/lib/export';
import {
  downloadSingleMarkdown,
  generateRecordMarkdown,
  downloadObsidianVault,
} from '@/lib/exportMarkdown';

import { Phase1ImportResult } from '@/lib/internal/phase1Types';
import { CompanyVerificationResult } from '@/providers/types';
import { getCompanyLeadKey } from '@/lib/deduplication';
import { CompanyRecord } from '@/lib/types';
import SharedCompanyTable, { SharedCompanyRow } from './SharedCompanyTable';
import type { InternalVerificationOutcome } from '@/lib/internal/offlineVerification';

function internalRecordToCompany(record: InternalRecordDTO): CompanyRecord {
  return {
    id: record.id,
    name: record.name,
    website: record.website || (record.domain ? `https://${record.domain}` : ''),
    canonicalDomain: record.domain,
    industry: record.industry,
    headquarters: record.geo || record.country || record.city || null,
    country: record.country || record.geo || null,
    founderOrCeoName: record.ceoName || null,
    founderOrCeoEmail: record.executiveEmail || null,
    fundingOrRevenue: record.funding || null,
    latestRound: record.stage || null,
    latestRoundType: record.stage || null,
    description: record.description || null,
    emailVerified: Boolean(record.executiveEmail),
    companyEmail: record.companyEmail || null,
    companyPhone: record.companyPhone || null,
    companyLinkedinUrl: record.companyLinkedin || null,
    confidenceScore: (record.offlineMatchScore || 0) / 100,
    sourceType: 'INTERNAL_FILE',
  };
}

interface CompanyRecordsTableProps {
  initialRecords?: InternalRecordDTO[];
  phase1Result?: Phase1ImportResult | null;
  internalResults?: CompanyVerificationResult[];
  onToast?: (msg: string) => void;
  savedLeads?: any[];
  onToggleSave?: (company: any) => void;
  internalSettings?: InternalWorkflowSettings;
  settingsOpenRequest?: number;
  verificationResults?: Record<string, InternalVerificationOutcome> | null;
  onSettingsSaved?: (settings: InternalWorkflowSettings) => void;
}

const EMPTY_INITIAL_RECORDS: InternalRecordDTO[] = [];

export default function CompanyRecordsTable({
  initialRecords = EMPTY_INITIAL_RECORDS,
  phase1Result,
  internalResults,
  onToast,
  savedLeads = [],
  onToggleSave,
  internalSettings,
  settingsOpenRequest = 0,
  verificationResults,
  onSettingsSaved,
}: CompanyRecordsTableProps) {
  // Records State
  const [records, setRecords] = useState<InternalRecordDTO[]>(initialRecords);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = React.useRef(false);
  const prevPhase1Ref = React.useRef(phase1Result);

  // Settings & Modes
  const [settings, setSettings] = useState<InternalWorkflowSettings>(internalSettings || loadInternalSettings());
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    if (internalSettings) setSettings(internalSettings);
  }, [internalSettings]);

  useEffect(() => {
    if (settingsOpenRequest > 0) setIsSettingsModalOpen(true);
  }, [settingsOpenRequest]);

  // Apply results produced by the Stage 1 local-only verification engine.
  useEffect(() => {
    if (!verificationResults) return;
    setRecords(previous => previous.map(record => {
      const outcome = verificationResults[record.id];
      if (!outcome) return record;
      const mapping = {
        VERIFIED: { status: 'VERIFIED' as const, statusLabel: 'VERIFIED' as const },
        REVIEW: { status: 'NEEDS_REVIEW' as const, statusLabel: 'REVIEW' as const },
        UNVERIFIED: { status: 'UNVERIFIED' as const, statusLabel: 'UNVERIFIED' as const },
        REJECTED: { status: 'MISSING' as const, statusLabel: 'REJECTED' as const },
      };
      const next = mapping[outcome.status];
      return {
        ...record,
        status: next.status,
        statusLabel: next.statusLabel,
        offlineMatchScore: outcome.score,
        offlineMatchExplanation: outcome.reasons.join(' '),
        notes: outcome.reasons.join(' '),
      };
    }));
  }, [verificationResults]);

  // Table Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEEDS_REVIEW' | 'MISSING' | 'FOUND' | 'UNVERIFIED'>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Pagination State — STRICT DEFAULT: 10 records per page
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Export Dropdown State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Row Action Context Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Company Dossier Modal State
  const [selectedCompany, setSelectedCompany] = useState<InternalRecordDTO | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);


  // Convert internalResults or phase1Result to InternalRecordDTO if available
  useEffect(() => {
    if (phase1Result && phase1Result.companies.length > 0) {

      const converted: InternalRecordDTO[] = phase1Result.companies.map((c, idx) => {
        const raw = c.rawFields || {};
        const name = c.canonicalFields.companyName.value || raw.Name || `Company #${idx + 1}`;
        const domain = c.canonicalFields.canonicalDomain.value || raw.Domain || '';
        const website = c.canonicalFields.website.value || raw.URL || (domain ? `https://${domain}` : '');
        const industry = c.canonicalFields.industry.value || raw.Industry || 'Not disclosed';
        const geo = c.canonicalFields.geography.value || raw.Geography || raw.Country || raw.City || 'Not disclosed';
        const founded = c.canonicalFields.foundingYear.value || raw['Founding Year'] || 'Not disclosed';
        const funding = c.canonicalFields.totalFundingAmount.value || raw['Funding Amount (in USD)'] || 'Not disclosed';
        const stage = c.canonicalFields.companyStage.value || raw['Funding Type'] || 'Not disclosed';

        let status: InternalRecordDTO['status'] = 'UNVERIFIED';
        let statusLabel: InternalRecordDTO['statusLabel'] = 'UNVERIFIED';

        return {
          id: c.companyId || `rec-${idx + 1}`,
          index: idx + 1,
          name,
          domain,
          website,
          description: raw.Description || '',
          industry,
          geo,
          city: raw.City || '',
          country: raw.Country || '',
          founded,
          funding,
          fundingAmount: 0,
          stage,
          status,
          statusLabel,
          companyEmail: raw['Contact Email'] || raw['Company Email'] || '',
          companyEmailStatus: raw['Contact Email'] ? 'Found' : 'Not found',
          ceoName: raw['CEO Name'] && raw['CEO Name'] !== 'UPGRADE TO UNLOCK' ? raw['CEO Name'] : '',
          ceoStatus: raw['CEO Name'] && raw['CEO Name'] !== 'UPGRADE TO UNLOCK' ? 'Verified' : 'Not verified',
          executiveEmail: raw['CEO Email'] && raw['CEO Email'] !== 'UPGRADE TO UNLOCK' ? raw['CEO Email'] : '',
          companyPhone: raw.Phone || '',
          companyLinkedin: raw.LinkedIn || '',
          offlineMatchScore: 0,
          offlineMatchExplanation: 'Imported file record pending verification pipeline run.',
          onlineStatus: 'Not run',
          rawFields: raw,
          evidence: [
            {
              label: `Imported from ${phase1Result.fileName}`,
              timestamp: new Date().toISOString(),
              text: `Extracted ${c.summary.availableCount} available fields, ${c.summary.missingCount} missing.`,
            },
          ],
          notes: '',
        };
      });
      setRecords(converted);
    } else if (internalResults && internalResults.length > 0) {

      const converted: InternalRecordDTO[] = internalResults.map((r, idx) => {
        const comp = r.company;
        const anyComp = comp as any;
        const name = comp.name || `Company #${idx + 1}`;
        const domain = comp.canonicalDomain || (comp.website ? comp.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '');
        const website = comp.website || (domain ? `https://${domain}` : '');
        const industry = comp.industry || 'Technology';
        const geo = anyComp.geography || comp.headquarters || comp.country || comp.city || 'Global';
        const founded = anyComp.foundedYear || comp.yearFounded || 'Not disclosed';
        const funding = anyComp.totalFunding || comp.fundingOrRevenue || (comp.totalFundingDisclosed ? `$${comp.totalFundingDisclosed}M` : 'Not disclosed');
        const stage = anyComp.fundingStage || comp.latestRound || comp.fundingType || 'Not disclosed';

        const statusMap: Record<string, { status: InternalRecordDTO['status']; label: InternalRecordDTO['statusLabel'] }> = {
          VERIFIED: { status: 'FOUND', label: 'FOUND' },
          QUALIFIED: { status: 'FOUND', label: 'FOUND' },
          REVIEW: { status: 'NEEDS_REVIEW', label: 'NEEDS REVIEW' },
          PARTIALLY_VERIFIED: { status: 'NEEDS_REVIEW', label: 'NEEDS REVIEW' },
          UNVERIFIED: { status: 'UNVERIFIED', label: 'UNVERIFIED' },
          REJECTED: { status: 'MISSING', label: 'MISSING' },
        };

        const canonical = statusMap[r.verificationStatus] || { status: 'UNVERIFIED', label: 'UNVERIFIED' };
        const ceo = r.leadership?.ceo?.name || r.leadership?.currentCeo?.name || '';
        const ceoStatus = ((r.leadership?.ceo as any)?.verificationStatus === 'VERIFIED' || r.leadership?.ceo?.verification_status === 'VERIFIED') ? 'Verified' : 'Not verified';

        return {
          id: comp.id || `res-${idx + 1}`,
          index: idx + 1,
          name,
          domain,
          website,
          description: comp.description || `${name} provides specialized technology solutions.`,
          industry,
          geo,
          city: comp.city || '',
          country: comp.country || '',
          founded,
          funding,
          fundingAmount: 0,
          stage,
          status: canonical.status,
          statusLabel: canonical.label,
          companyEmail: anyComp.contactEmail || comp.companyEmail || (domain ? `info@${domain}` : ''),
          companyEmailStatus: (anyComp.contactEmail || comp.companyEmail) ? 'Found' : 'Not found',
          ceoName: ceo,
          ceoStatus,
          executiveEmail: r.leadership?.ceo?.email || '',
          companyPhone: anyComp.phone || comp.companyPhone || '',
          companyLinkedin: anyComp.linkedinUrl || '',
          offlineMatchScore:
            r.verificationStatus === 'QUALIFIED' || r.verificationStatus === 'VERIFIED'
              ? 90
              : r.verificationStatus === 'PARTIALLY_VERIFIED' || r.verificationStatus === 'REVIEW'
              ? 60
              : 25,
          offlineMatchExplanation:
            r.qualificationReason ||
            r.decisionExplanation ||
            r.partiallyVerifiedReason ||
            r.rejectionReason ||
            'Evaluated against target criteria.',
          onlineStatus: 'Not run',
          rawFields: comp as any,
          evidence: (r.sources || []).map((s, sIdx) => ({
            label: `Source #${sIdx + 1}`,
            timestamp: r.auditTimestamp || new Date().toISOString(),
            text: s,
          })),
          notes: '',
        };
      });
      setRecords(converted);
      setRecords(converted);
    } else if (phase1Result && phase1Result.companies.length > 0) {
      const converted: InternalRecordDTO[] = phase1Result.companies.map((c, idx) => {
        const raw = c.rawFields || {};
        const name = c.canonicalFields.companyName.value || raw.Name || `Company #${idx + 1}`;
        const domain = c.canonicalFields.canonicalDomain.value || raw.Domain || '';
        const website = c.canonicalFields.website.value || raw.URL || (domain ? `https://${domain}` : '');
        const industry = c.canonicalFields.industry.value || raw.Industry || 'Not disclosed';
        const geo = c.canonicalFields.geography.value || raw.Geography || raw.Country || raw.City || 'Not disclosed';
        const founded = c.canonicalFields.foundingYear.value || raw['Founding Year'] || 'Not disclosed';
        const funding = c.canonicalFields.totalFundingAmount.value || raw['Funding Amount (in USD)'] || 'Not disclosed';
        const stage = c.canonicalFields.companyStage.value || raw['Funding Type'] || 'Not disclosed';

        let status: InternalRecordDTO['status'] = 'UNVERIFIED';
        let statusLabel: InternalRecordDTO['statusLabel'] = 'UNVERIFIED';

        return {
          id: c.companyId || `rec-${idx + 1}`,
          index: idx + 1,
          name,
          domain,
          website,
          description: raw.Description || '',
          industry,
          geo,
          city: raw.City || '',
          country: raw.Country || '',
          founded,
          funding,
          fundingAmount: 0,
          stage,
          status,
          statusLabel,
          companyEmail: raw['Contact Email'] || raw['Company Email'] || '',
          companyEmailStatus: raw['Contact Email'] ? 'Found' : 'Not found',
          ceoName: raw['CEO Name'] && raw['CEO Name'] !== 'UPGRADE TO UNLOCK' ? raw['CEO Name'] : '',
          ceoStatus: raw['CEO Name'] && raw['CEO Name'] !== 'UPGRADE TO UNLOCK' ? 'Verified' : 'Not verified',
          executiveEmail: raw['CEO Email'] && raw['CEO Email'] !== 'UPGRADE TO UNLOCK' ? raw['CEO Email'] : '',
          companyPhone: raw.Phone || '',
          companyLinkedin: raw.LinkedIn || '',
          offlineMatchScore: 0,
          offlineMatchExplanation: 'Imported file record pending verification pipeline run.',
          onlineStatus: 'Not run',
          rawFields: raw,
          evidence: [
            {
              label: `Imported from ${phase1Result.fileName}`,
              timestamp: new Date().toISOString(),
              text: `Extracted ${c.summary.availableCount} available fields, ${c.summary.missingCount} missing.`,
            },
          ],
          notes: '',
        };
      });
      setRecords(converted);
    } else if (initialRecords && initialRecords.length > 0) {
      setRecords(initialRecords);
    } else {
      setRecords([]);
    }
  }, [internalResults, phase1Result, initialRecords]);

  // Handle phase1Result reset (e.g. file removed)
  useEffect(() => {
    if (prevPhase1Ref.current && !phase1Result && (!internalResults || internalResults.length === 0)) {
      setRecords([]);
    }
    prevPhase1Ref.current = phase1Result;
  }, [phase1Result, internalResults]);

  // Filtered & Searched Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesDomain = r.domain.toLowerCase().includes(q);
        const matchesIndustry = r.industry.toLowerCase().includes(q);
        const matchesGeo = r.geo.toLowerCase().includes(q);
        if (!matchesName && !matchesDomain && !matchesIndustry && !matchesGeo) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (r.status !== statusFilter) return false;
      }

      // Stage Filter
      if (stageFilter !== 'ALL') {
        if (!r.stage.toLowerCase().includes(stageFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [records, searchQuery, statusFilter, stageFilter]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, stageFilter]);

  // Pagination Calculations
  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const currentDisplayedRecords = filteredRecords.slice(startIndex, endIndex);

  // Summary counts
  const summaryCounts = useMemo(() => {
    const total = records.length;
    if (total === 0) {
      return {
        total: 0,
        unverified: 0,
        needsReview: 0,
        verified: 0,
        missing: 0,
      };
    }

    const verified = records.filter(r => r.status === 'FOUND' || r.status === 'VERIFIED').length;
    const needsReview = records.filter(r => r.status === 'NEEDS_REVIEW').length;
    const missing = records.filter(r => r.status === 'MISSING').length;
    const unverified = records.filter(r => r.status === 'UNVERIFIED').length;

    return {
      total,
      unverified: unverified || Math.max(0, total - verified - needsReview - missing),
      needsReview,
      verified,
      missing,
    };
  }, [records]);

  // Open Dossier for selected company
  const handleOpenDossier = (company: InternalRecordDTO) => {
    setSelectedCompany(company);
    setIsDossierOpen(true);
  };

  // Pager Navigation inside Dossier
  const currentCompanyIndex = useMemo(() => {
    if (!selectedCompany) return 1;
    const idx = filteredRecords.findIndex(r => r.id === selectedCompany.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [selectedCompany, filteredRecords]);

  const handleDossierPrev = () => {
    if (currentCompanyIndex > 1) {
      setSelectedCompany(filteredRecords[currentCompanyIndex - 2]);
    }
  };

  const handleDossierNext = () => {
    if (currentCompanyIndex < filteredRecords.length) {
      setSelectedCompany(filteredRecords[currentCompanyIndex]);
    }
  };

  // Export handlers
  const handleExport = (format: 'CSV' | 'XLSX' | 'MD' | 'VAULT' | 'JSON') => {
    setIsExportMenuOpen(false);
    const filenameBase = `huntlyst-company-records-${new Date().toISOString().split('T')[0]}`;

    const exportRows = filteredRecords.map(r => ({
      Company: r.name,
      Domain: r.domain,
      Website: r.website,
      Industry: r.industry,
      Geography: r.geo,
      Founded: r.founded,
      Funding: r.funding,
      Stage: r.stage,
      Status: r.statusLabel,
      'Match Score': `${r.offlineMatchScore}/100`,
      'Company Email': r.companyEmail,
      'Email Status': r.companyEmailStatus,
      'CEO Name': r.ceoName || 'Not verified',
    }));

    if (format === 'CSV') {
      downloadCsvFile(exportRows, `${filenameBase}.csv`);
      if (onToast) onToast(`Exported ${exportRows.length} records to CSV! 💾`);
    } else if (format === 'XLSX') {
      downloadXlsxFile(exportRows, `${filenameBase}.xlsx`);
      if (onToast) onToast(`Exported ${exportRows.length} records to Excel! 📊`);
    } else if (format === 'JSON') {
      downloadUniversalJson(filteredRecords as any, `${filenameBase}.json`);
      if (onToast) onToast(`Exported ${filteredRecords.length} records to JSON! 📋`);
    } else if (format === 'MD') {
      const targetRec = selectedCompany || filteredRecords[0];
      if (targetRec) {
        const md = generateRecordMarkdown(targetRec as any, { workflowOrigin: 'INTERNAL', includeEvidence: true });
        downloadSingleMarkdown(md, `${targetRec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dossier.md`);
      }
      if (onToast) onToast('Exported Company Dossier Markdown! 📝');
    } else if (format === 'VAULT') {
      downloadObsidianVault({
        vaultName: 'Huntlyst-Company-Records',
        internalRecords: filteredRecords as any,
        snapshotTime: new Date().toISOString(),
      });
      if (onToast) onToast('Generated complete Obsidian Vault ZIP! 🗂️');
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (statusLabel: string) => {
    switch (statusLabel) {
      case 'FOUND':
      case 'VERIFIED':
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/40 whitespace-nowrap">
            {statusLabel}
          </span>
        );
      case 'MISSING':
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFEBEE] text-[#C62828] border border-[#C62828]/40 whitespace-nowrap">
            {statusLabel}
          </span>
        );
      case 'NEEDS REVIEW':
      default:
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFB74D] whitespace-nowrap">
            {statusLabel}
          </span>
        );
    }
  };

  const sharedRows: SharedCompanyRow[] = useMemo(() => {
    return records.map(r => ({
      id: r.id,
      index: r.index,
      name: r.name,
      description: r.description,
      domain: r.domain,
      website: r.website,
      industry: r.industry,
      geography: r.geo,
      founded: r.founded,
      funding: r.funding,
      stage: r.stage,
      status: r.status,
      statusLabel: r.statusLabel,
      raw: r,
    }));
  }, [records]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <SharedCompanyTable
        title="Company Records"
        icon="📊"
        rows={sharedRows}
        isLoading={isLoading}
        emptyTitle={
          records.length === 0
            ? 'No company records yet. Upload a CSV or Excel file to begin.'
            : 'No company records matched your active filter or search query.'
        }
        emptySubtitle={
          records.length === 0
            ? 'Use the upload area above to parse and verify internal companies.'
            : undefined
        }
        onView={row => handleOpenDossier(row.raw)}
        savedLeads={savedLeads}
        onToggleSave={onToggleSave}
        onToast={onToast}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        toolbarActions={
          <>
            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-bold font-mono text-[#1E1B18] hover:bg-[#FAF6EE] flex items-center gap-1 shadow-sketch-xs transition-colors"
              >
                <span>Export</span>
                <span className="text-[10px]">∨</span>
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 p-1.5 bg-white rounded-xl border-2 border-[#1E1B18] shadow-sketch-md z-30 space-y-1 animate-in zoom-in-95 duration-150 text-left">
                  <button
                    type="button"
                    onClick={() => handleExport('CSV')}
                    className="w-full px-2.5 py-1.5 text-left text-xs font-mono font-bold text-[#1E1B18] hover:bg-[#FAF6EE] rounded-lg flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span>Export CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('XLSX')}
                    className="w-full px-2.5 py-1.5 text-left text-xs font-mono font-bold text-[#1E1B18] hover:bg-[#FAF6EE] rounded-lg flex items-center gap-2"
                  >
                    <span>📈</span>
                    <span>Export Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('MD')}
                    className="w-full px-2.5 py-1.5 text-left text-xs font-mono font-bold text-[#1E1B18] hover:bg-[#FAF6EE] rounded-lg flex items-center gap-2"
                  >
                    <span>📝</span>
                    <span>Export Markdown Note</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('VAULT')}
                    className="w-full px-2.5 py-1.5 text-left text-xs font-mono font-bold text-[#1E1B18] hover:bg-[#FAF6EE] rounded-lg flex items-center gap-2"
                  >
                    <span>🗂️</span>
                    <span>Obsidian Vault (.zip)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('JSON')}
                    className="w-full px-2.5 py-1.5 text-left text-xs font-mono font-bold text-[#1E1B18] hover:bg-[#FAF6EE] rounded-lg flex items-center gap-2"
                  >
                    <span>📋</span>
                    <span>Export JSON (.json)</span>
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      {/* Internal Workflow Settings Modal */}
      <InternalWorkflowSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaved={updatedSettings => {
          setSettings(updatedSettings);
          onSettingsSaved?.(updatedSettings);
          if (onToast) onToast('Internal workflow settings updated!');
        }}
      />

      {/* Company Dossier Modal */}
      <InternalCompanyDossierModal
        isOpen={isDossierOpen}
        company={selectedCompany}
        currentIndex={currentCompanyIndex}
        totalCompanies={filteredRecords.length}
        onClose={() => setIsDossierOpen(false)}
        onNavigatePrev={handleDossierPrev}
        onNavigateNext={handleDossierNext}
        onSaveToShortlist={comp => {
          if (onToast) onToast(`Saved "${comp.name}" to shortlist! ⭐`);
        }}

      />
    </div>
  );
}
