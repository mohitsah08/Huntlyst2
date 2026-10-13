'use client';

import { useState, useMemo, useEffect } from 'react';
import { CompanyRecord, RejectedCompanyRecord } from '@/lib/types';
import { CompanyVerificationResult } from '@/providers/types';
import {
  UniversalExportRecord,
  PipelineStageLabel,
  LeadStatusLabel,
  normalizeCompanyRecord,
  normalizeRejectedCompanyRecord,
  normalizeVerificationResult,
  filterExportRecords,
  formatSnapshotTime,
  downloadUniversalCsv,
  downloadUniversalXlsx,
  downloadUniversalJson,
  downloadPdfFile,
  downloadDocxFile,
  downloadSingleMarkdown,
  downloadCombinedMarkdown,
  downloadMarkdownZip,
  downloadObsidianVault,
  WorkflowSourceType,
} from '@/lib/export';
import { CompanyResearchProfile } from '@/lib/research/types';

export type ExportFormatType =
  | 'MD_SINGLE'
  | 'MD_COMBINED'
  | 'MD_ZIP'
  | 'OBSIDIAN_VAULT'
  | 'CSV'
  | 'XLSX'
  | 'JSON'
  | 'PDF'
  | 'DOCX';

export type ExportScopeType =
  | 'all'
  | 'selected'
  | 'filtered'
  | 'workflow_only'
  | 'all_workflows';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  // Flexible input sources
  records?: UniversalExportRecord[];
  companies?: CompanyRecord[];
  rejectedCompanies?: RejectedCompanyRecord[];
  stagedResults?: CompanyVerificationResult[];
  externalProfiles?: CompanyResearchProfile[];
  automationResults?: any[];
  // Contextual metadata
  initialStage?: PipelineStageLabel;
  initialStatus?: LeadStatusLabel;
  initialWorkflow?: 'all' | 'internal' | 'external' | 'automation';
  selectedIds?: string[];
  title?: string;
  subtitle?: string;
  huntId?: string;
  searchQuery?: string;
}

const ALL_STAGES: PipelineStageLabel[] = [
  'Stage 1: Internal Discovery',
  'Stage 2: External Discovery',
  'Stage 3: Research / Enrichment',
  'Stage 4: Qualification',
  'Stage 5: Verification',
  'Stage 6: Final Results',
];

const ALL_STATUSES: LeadStatusLabel[] = [
  'Approved',
  'Selected',
  'Rejected',
  'Under Review',
  'Unverified',
  'Partially Verified',
  'Duplicate',
  'Failed',
  'Pending',
];

export default function ExportModal({
  isOpen,
  onClose,
  onToast,
  records: directRecords,
  companies = [],
  rejectedCompanies = [],
  stagedResults = [],
  externalProfiles: initialExternalProfiles,
  automationResults: initialAutomationResults,
  initialStage,
  initialStatus,
  initialWorkflow = 'all',
  selectedIds = [],
  title,
  subtitle,
  huntId,
  searchQuery,
}: ExportModalProps) {
  // Snapshot timestamp generated once per modal open
  const snapshotTime = useMemo(() => formatSnapshotTime(), [isOpen]);

  // Active Workflow Selection (Requirement 1: Internal, External, Automation, or All combined)
  const [activeWorkflow, setActiveWorkflow] = useState<'all' | 'internal' | 'external' | 'automation'>(
    initialWorkflow
  );

  // Active Scope Selection
  const [scope, setScope] = useState<'all' | 'selected'>('all');

  // Internal Status Sub-filter (Requirement 3: Verified, Rejected, Unverified, Review)
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>('ALL');

  // External profiles fetched if needed
  const [fetchedExternalProfiles, setFetchedExternalProfiles] = useState<CompanyResearchProfile[]>(
    initialExternalProfiles || []
  );

  useEffect(() => {
    if (isOpen && (!initialExternalProfiles || initialExternalProfiles.length === 0)) {
      fetch('/api/research')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.profiles)) {
            setFetchedExternalProfiles(data.profiles);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialExternalProfiles]);

  // Combine and normalize all candidate records into UniversalExportRecord[]
  const allNormalizedRecords = useMemo(() => {
    if (directRecords && directRecords.length > 0) {
      return directRecords;
    }

    const unified: UniversalExportRecord[] = [];
    const seenIds = new Set<string>();

    // 1. Approved / Final Qualified Leads
    companies.forEach((c) => {
      const rec = normalizeCompanyRecord(c, 'Stage 6: Final Results', 'Approved', { huntId, searchQuery });
      if (!seenIds.has(rec.id)) {
        seenIds.add(rec.id);
        unified.push(rec);
      }
    });

    // 2. Rejected Candidates
    rejectedCompanies.forEach((rej) => {
      const rec = normalizeRejectedCompanyRecord(rej, 'Stage 4: Qualification', { huntId, searchQuery });
      if (!seenIds.has(rec.id)) {
        seenIds.add(rec.id);
        unified.push(rec);
      }
    });

    // 3. Staged Verification Results
    stagedResults.forEach((res) => {
      const rec = normalizeVerificationResult(res, initialStage || 'Stage 5: Verification', false, {
        huntId,
        searchQuery,
      });
      if (!seenIds.has(rec.id)) {
        seenIds.add(rec.id);
        unified.push(rec);
      }
    });

    // 4. Saved External Profiles
    fetchedExternalProfiles.forEach((p) => {
      const rec = normalizeCompanyRecord(
        {
          name: p.officialName,
          website: p.website,
          description: p.description,
          industry: p.primaryIndustry,
          fundingOrRevenue: p.funding.totalFundingUsd ? `$${p.funding.totalFundingUsd}` : null,
          totalFundingUsd: p.funding.totalFundingUsd,
          founderOrCeoName: p.leadership.ceo?.name || p.leadership.founders[0]?.name || null,
          founderOrCeoEmail: p.contacts.generalEmail || null,
          emailVerified: false,
          confidenceScore: p.researchCompletenessScore,
          sourceType: 'EXTERNAL_RESEARCH',
          country: p.headquarters.country,
          researchCompleteness: p.researchCompletenessScore,
          rawRecord: p,
        } as any,
        'Stage 3: Research / Enrichment',
        'Selected',
        { huntId, searchQuery }
      );
      rec.workflowOrigin = 'EXTERNAL';
      if (!seenIds.has(rec.id)) {
        seenIds.add(rec.id);
        unified.push(rec);
      }
    });

    return unified;
  }, [
    directRecords,
    companies,
    rejectedCompanies,
    stagedResults,
    fetchedExternalProfiles,
    initialStage,
    huntId,
    searchQuery,
  ]);

  // Multi-select Stage Filter
  const [selectedStages, setSelectedStages] = useState<PipelineStageLabel[]>(() => {
    if (initialStage) return [initialStage];
    return ALL_STAGES;
  });

  // Multi-select Status Filter
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatusLabel[]>(() => {
    if (initialStatus) return [initialStatus];
    return ALL_STATUSES;
  });

  // Advanced Filter Builder Toggle
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);

  // Inclusions
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Selected format for preview
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatType>('OBSIDIAN_VAULT');

  // Filtered dataset based on Workflow + Scope + Status + Stages
  const filteredRecords = useMemo(() => {
    let base = allNormalizedRecords;

    // 1. Workflow Partitioning
    if (activeWorkflow === 'internal') {
      base = base.filter((r) => r.workflowOrigin === 'INTERNAL' || r.sourceFile || r.sourceRow !== undefined);
      // If internal has no tagged rows, fallback to non-external
      if (base.length === 0 && allNormalizedRecords.length > 0) {
        base = allNormalizedRecords.filter((r) => r.workflowOrigin !== 'EXTERNAL');
      }
    } else if (activeWorkflow === 'external') {
      base = base.filter(
        (r) =>
          r.workflowOrigin === 'EXTERNAL' ||
          (r.rawRecord && r.rawRecord.primaryIndustry !== undefined) ||
          fetchedExternalProfiles.some((p) => p.officialName === r.companyName)
      );
      if (base.length === 0 && fetchedExternalProfiles.length > 0) {
        base = allNormalizedRecords.filter((r) => r.workflowOrigin === 'EXTERNAL');
      }
    } else if (activeWorkflow === 'automation') {
      base = base.filter((r) => r.workflowOrigin === 'AUTOMATION' || r.discoverySource?.includes('SEARCH'));
    }

    // 2. Internal Status Specific Filtering (Requirement 3)
    if (activeWorkflow === 'internal' && internalStatusFilter !== 'ALL') {
      base = base.filter((r) => {
        const st = (r.recordStatus || r.verificationStatus || '').toUpperCase();
        if (internalStatusFilter === 'VERIFIED') {
          return st === 'VERIFIED' || st === 'APPROVED';
        }
        if (internalStatusFilter === 'REVIEW') {
          return st === 'REVIEW' || st === 'UNDER REVIEW' || st === 'PARTIALLY VERIFIED';
        }
        if (internalStatusFilter === 'UNVERIFIED') {
          return st === 'UNVERIFIED';
        }
        if (internalStatusFilter === 'REJECTED') {
          return st === 'REJECTED';
        }
        return true;
      });
    }

    // 3. Scope Filtering
    if (scope === 'selected' && selectedIds.length > 0) {
      base = base.filter((r) => selectedIds.includes(r.id));
    }

    // 4. Standard Stage & Status Filters
    return filterExportRecords(base, {
      stages: selectedStages.length === ALL_STAGES.length ? undefined : selectedStages,
      statuses: selectedStatuses.length === ALL_STATUSES.length ? undefined : selectedStatuses,
    });
  }, [
    allNormalizedRecords,
    activeWorkflow,
    internalStatusFilter,
    scope,
    selectedIds,
    selectedStages,
    selectedStatuses,
    fetchedExternalProfiles,
  ]);

  if (!isOpen) return null;

  // Toggle stage selection
  const handleToggleStage = (st: PipelineStageLabel) => {
    setSelectedStages((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  // Toggle status selection
  const handleToggleStatus = (stat: LeadStatusLabel) => {
    setSelectedStatuses((prev) =>
      prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]
    );
  };

  // Export execution dispatcher
  const handleExport = async (format: ExportFormatType) => {
    if (filteredRecords.length === 0) {
      onToast('No records match your selected workflow and status filters.');
      return;
    }

    setIsExporting(format);
    const dateSlug = new Date().toISOString().split('T')[0];
    const exportOpts = {
      includeEvidence,
      includeTimestamp,
      snapshotTime,
      huntId: huntId || 'hunt-export',
      searchQuery: searchQuery || 'Target Profile Discovery',
      notes: title || `Huntlyst ${activeWorkflow.toUpperCase()} Research Dossier`,
    };

    try {
      if (format === 'MD_SINGLE') {
        const target = filteredRecords[0];
        downloadSingleMarkdown(target, `${target.companyName}.md`, exportOpts);
        onToast(`Exported "${target.companyName}" as Obsidian Markdown note! 📝`);
      } else if (format === 'MD_COMBINED') {
        downloadCombinedMarkdown(
          filteredRecords,
          `huntlyst-${activeWorkflow}-combined-${dateSlug}.md`,
          exportOpts
        );
        onToast(`Exported ${filteredRecords.length} records as combined Markdown report! 📄`);
      } else if (format === 'MD_ZIP') {
        await downloadMarkdownZip(
          filteredRecords,
          `huntlyst-${activeWorkflow}-notes-${dateSlug}.zip`,
          exportOpts
        );
        onToast(`Exported ${filteredRecords.length} notes in Markdown ZIP! 🗂️`);
      } else if (format === 'OBSIDIAN_VAULT') {
        // Vault option (Section 6: Complete Research Export)
        const isCombined = activeWorkflow === 'all';
        const internalRecs = isCombined
          ? filteredRecords.filter((r) => r.workflowOrigin === 'INTERNAL' || r.sourceFile)
          : activeWorkflow === 'internal'
          ? filteredRecords
          : [];
        const externalRecs = isCombined
          ? filteredRecords.filter((r) => r.workflowOrigin === 'EXTERNAL')
          : activeWorkflow === 'external'
          ? filteredRecords
          : [];
        const autoRecs = isCombined
          ? filteredRecords.filter((r) => r.workflowOrigin === 'AUTOMATION')
          : activeWorkflow === 'automation'
          ? filteredRecords
          : [];

        await downloadObsidianVault(
          {
            vaultName: `Huntlyst-Obsidian-${activeWorkflow.toUpperCase()}`,
            snapshotTime,
            internalRecords: internalRecs.length > 0 ? internalRecs : activeWorkflow === 'internal' ? filteredRecords : [],
            externalRecords: externalRecs.length > 0 ? externalRecs : activeWorkflow === 'external' ? filteredRecords : [],
            automationRecords: autoRecs.length > 0 ? autoRecs : activeWorkflow === 'automation' ? filteredRecords : [],
            internalStatuses:
              internalStatusFilter !== 'ALL' ? [internalStatusFilter] : undefined,
          },
          `huntlyst-obsidian-vault-${dateSlug}.zip`
        );
        onToast(`Generated complete Obsidian Vault (.zip) with ${filteredRecords.length} notes! 💎`);
      } else if (format === 'CSV') {
        downloadUniversalCsv(filteredRecords, `huntlyst-export-${dateSlug}.csv`, exportOpts);
        onToast(`Exported ${filteredRecords.length} records to spreadsheet CSV! 📊`);
      } else if (format === 'XLSX') {
        downloadUniversalXlsx(filteredRecords, `huntlyst-export-${dateSlug}.xlsx`, exportOpts);
        onToast(`Exported ${filteredRecords.length} records to multi-sheet Excel workbook! 📗`);
      } else if (format === 'JSON') {
        downloadUniversalJson(filteredRecords, `huntlyst-pipeline-export-${dateSlug}.json`, exportOpts);
        onToast(`Exported ${filteredRecords.length} records with complete JSON schema! 📦`);
      } else if (format === 'PDF') {
        downloadPdfFile(filteredRecords, `huntlyst-dossier-report-${dateSlug}.pdf`, exportOpts);
        onToast(`Generated executive PDF dossier report for ${filteredRecords.length} records! 📄`);
      } else if (format === 'DOCX') {
        await downloadDocxFile(filteredRecords, `huntlyst-discovery-report-${dateSlug}.docx`, exportOpts);
        onToast(`Generated editable Word document for ${filteredRecords.length} records! 📝`);
      }
      onClose();
    } catch (err: any) {
      onToast(`Export error: ${err.message || 'Failed to generate export file'}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Scope label for UI
  const scopeLabel =
    scope === 'selected' && selectedIds.length > 0
      ? `Selected Records Only (${selectedIds.length})`
      : `All Matching Records (${filteredRecords.length})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1E1B18]/65 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="paper-card bg-[#FFFDF9] max-w-3xl w-full rounded-2xl p-5 sm:p-7 relative shadow-sketch-lg border-2 border-[#1E1B18] space-y-5 my-6 max-h-[92vh] flex flex-col">
        {/* Tape decoration */}
        <div className="tape-strip" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#F0EAD8] pb-3.5 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📦</span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                {title || 'Universal Research Exporter'}
              </h3>
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              {subtitle ||
                'Export complete research intelligence across Internal, External, and Automation workflows into Obsidian Markdown, Excel, or CSV.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#766E65] hover:text-[#1E1B18] text-xl font-bold p-1 rounded hover:bg-[#FAF6EE]"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* 1. WORKFLOW TABS (Requirement 1: Independent or Combined) */}
          <div className="space-y-1.5">
            <span className="font-bold text-[#1E1B18] font-mono text-[11px] uppercase tracking-wider">
              1. Select Workflow:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setActiveWorkflow('all')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 ${
                  activeWorkflow === 'all'
                    ? 'bg-[#FFE0B2] border-[#1E1B18] shadow-sketch-xs text-[#1E1B18]'
                    : 'bg-white border-[#EBE4D5] text-[#766E65] hover:border-[#1E1B18]/40'
                }`}
              >
                <span>🌐</span>
                <span>All Combined</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveWorkflow('internal')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 ${
                  activeWorkflow === 'internal'
                    ? 'bg-[#E8F5E9] border-[#1E1B18] shadow-sketch-xs text-[#1E1B18]'
                    : 'bg-white border-[#EBE4D5] text-[#766E65] hover:border-[#1E1B18]/40'
                }`}
              >
                <span>📋</span>
                <span>Internal Discovery</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveWorkflow('external')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 ${
                  activeWorkflow === 'external'
                    ? 'bg-[#E3F2FD] border-[#1E1B18] shadow-sketch-xs text-[#1E1B18]'
                    : 'bg-white border-[#EBE4D5] text-[#766E65] hover:border-[#1E1B18]/40'
                }`}
              >
                <span>🔍</span>
                <span>External Research</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveWorkflow('automation')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 ${
                  activeWorkflow === 'automation'
                    ? 'bg-[#EDE7F6] border-[#1E1B18] shadow-sketch-xs text-[#1E1B18]'
                    : 'bg-white border-[#EBE4D5] text-[#766E65] hover:border-[#1E1B18]/40'
                }`}
              >
                <span>⚡</span>
                <span>Automation Runs</span>
              </button>
            </div>
          </div>

          {/* 2. INTERNAL STATUS SUB-FILTER (Requirement 3: Verified, Rejected, Unverified, Review) */}
          {activeWorkflow === 'internal' && (
            <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1E1B18] font-mono text-[11px] uppercase tracking-wider">
                  Filter Internal Records by Status:
                </span>
                <span className="text-[10px] font-mono text-[#766E65]">Zero re-verification during export</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {[
                  { key: 'ALL', label: 'All Statuses', icon: '•', color: 'bg-white text-[#1E1B18]' },
                  { key: 'VERIFIED', label: 'Verified Only', icon: '✓', color: 'bg-[#E8F5E9] text-[#2E7D32]' },
                  { key: 'REVIEW', label: 'Review Only', icon: '⚠', color: 'bg-[#FFF8E1] text-[#E65100]' },
                  { key: 'UNVERIFIED', label: 'Unverified Only', icon: '?', color: 'bg-[#FAF6EE] text-[#766E65]' },
                  { key: 'REJECTED', label: 'Rejected Only', icon: '✗', color: 'bg-[#FFEBEE] text-[#C62828]' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setInternalStatusFilter(s.key)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border text-center transition-all ${
                      internalStatusFilter === s.key
                        ? 'border-[#1E1B18] ring-2 ring-[#FF6B35]/40 font-black'
                        : 'border-[#D9D0C1] hover:border-[#1E1B18]/50'
                    } ${s.color}`}
                  >
                    <span>{s.icon} </span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. EXPORT SCOPE & STATS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#1E1B18] font-mono uppercase">Scope:</span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="w-3.5 h-3.5 text-[#FF6B35]"
                />
                <span>All Matching ({allNormalizedRecords.length})</span>
              </label>

              {selectedIds.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    className="w-3.5 h-3.5 text-[#FF6B35]"
                  />
                  <span>Selected Only ({selectedIds.length})</span>
                </label>
              )}
            </div>

            <div className="text-xs font-mono font-bold text-[#1E1B18]">
              Ready to Export: <span className="text-[#FF6B35] font-black">{filteredRecords.length}</span> records
            </div>
          </div>

          {/* 4. PRE-EXPORT SUMMARY BANNER (Requirement 1: Show workflow, count, format, scope) */}
          <div className="p-3 bg-[#FFF3E0] rounded-xl border-2 border-[#FFE0B2] text-xs font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[#766E65] uppercase font-bold text-[10px]">Active Export Configuration:</span>
              <span className="text-[#2E7D32] font-bold">✓ Ready for Obsidian &amp; Spreadsheet</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[#1E1B18]">
              <div>
                <span className="text-[#766E65] block text-[10px]">Workflow:</span>
                <span className="font-bold capitalize">{activeWorkflow} {activeWorkflow === 'internal' && internalStatusFilter !== 'ALL' ? `(${internalStatusFilter})` : ''}</span>
              </div>
              <div>
                <span className="text-[#766E65] block text-[10px]">Export Scope:</span>
                <span className="font-bold">{scope === 'selected' ? 'Selected' : 'All In View'}</span>
              </div>
              <div>
                <span className="text-[#766E65] block text-[10px]">Selected Format:</span>
                <span className="font-bold text-[#FF6B35]">{selectedFormat}</span>
              </div>
              <div>
                <span className="text-[#766E65] block text-[10px]">Records:</span>
                <span className="font-bold text-[#2E7D32]">{filteredRecords.length} records</span>
              </div>
            </div>
          </div>

          {/* 5. PRIMARY OBSIDIAN & MARKDOWN EXPORTS (Requirement 2 & 9) */}
          <div className="space-y-2">
            <span className="font-bold text-[#1E1B18] font-mono text-[11px] uppercase tracking-wider">
              Obsidian &amp; Markdown Formats (Direct Vault Import):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Obsidian Complete Vault ZIP */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('OBSIDIAN_VAULT');
                  handleExport('OBSIDIAN_VAULT');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-3.5 rounded-xl border-2 border-[#1E1B18] bg-[#EDE7F6] hover:bg-[#D1C4E9] text-left transition-all shadow-sketch-sm hover:shadow-sketch group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xl">🗂️</span>
                    <span className="text-[10px] font-mono font-bold bg-[#7E57C2] text-white px-2 py-0.5 rounded">
                      RECOMMENDED FOR OBSIDIAN
                    </span>
                  </div>
                  <div className="font-bold text-sm text-[#1E1B18]">Complete Obsidian Vault (.zip)</div>
                  <div className="font-sans text-[11px] text-[#4527A0] mt-1 leading-snug">
                    Organized multi-note archive with Index.md, README.md, Internal status folders, and wikilinks.
                  </div>
                </div>
                <div className="mt-3 pt-1.5 border-t border-[#D1C4E9] font-mono text-[11px] text-[#4527A0] font-bold">
                  {isExporting === 'OBSIDIAN_VAULT' ? 'Generating Vault Archive...' : 'Download Vault (.zip) →'}
                </div>
              </button>

              {/* Combined Markdown Report */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('MD_COMBINED');
                  handleExport('MD_COMBINED');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-3.5 rounded-xl border-2 border-[#1E1B18] bg-white hover:bg-[#FFF8E1] text-left transition-all shadow-sketch-xs hover:shadow-sketch group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xl">📝</span>
                    <span className="text-[10px] font-mono font-bold bg-[#FFA000] text-white px-2 py-0.5 rounded">
                      SINGLE FILE
                    </span>
                  </div>
                  <div className="font-bold text-sm text-[#1E1B18]">Combined Markdown Report (.md)</div>
                  <div className="font-sans text-[11px] text-[#5A544E] mt-1 leading-snug">
                    All {filteredRecords.length} companies formatted into one structured report with Table of Contents.
                  </div>
                </div>
                <div className="mt-3 pt-1.5 border-t border-[#F0EAD8] font-mono text-[11px] text-[#FF6B35] font-bold">
                  {isExporting === 'MD_COMBINED' ? 'Generating Report...' : 'Download Report (.md) →'}
                </div>
              </button>
            </div>

            {/* Additional Quick Markdown Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('MD_ZIP');
                  handleExport('MD_ZIP');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="px-3 py-2 rounded-xl border border-[#1E1B18] bg-white hover:bg-[#FAF6EE] text-left transition-all flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span>📦</span>
                  <span className="font-bold">Individual Notes (.zip)</span>
                </div>
                <span className="font-mono text-[10px] text-[#FF6B35] font-bold">ZIP of .md files →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('MD_SINGLE');
                  handleExport('MD_SINGLE');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="px-3 py-2 rounded-xl border border-[#1E1B18] bg-white hover:bg-[#FAF6EE] text-left transition-all flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span>📄</span>
                  <span className="font-bold">First Selected Note (.md)</span>
                </div>
                <span className="font-mono text-[10px] text-[#FF6B35] font-bold">Single .md file →</span>
              </button>
            </div>
          </div>

          {/* 6. SPREADSHEET, DOCUMENT & API FORMATS (Preserved 100%) */}
          <div className="space-y-2 pt-2 border-t border-[#F0EAD8]">
            <span className="font-bold text-[#1E1B18] font-mono text-[11px] uppercase tracking-wider">
              Spreadsheet, Document &amp; JSON Formats:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* CSV Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('CSV');
                  handleExport('CSV');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-2.5 rounded-xl border border-[#1E1B18] bg-white hover:bg-[#FFE7DC] text-left transition-all flex flex-col justify-between"
              >
                <div className="text-lg">📊</div>
                <div className="font-bold text-xs text-[#1E1B18] mt-1">Spreadsheet CSV</div>
                <span className="font-mono text-[10px] text-[#FF6B35] font-bold mt-1">.csv →</span>
              </button>

              {/* Excel Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('XLSX');
                  handleExport('XLSX');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-2.5 rounded-xl border border-[#1E1B18] bg-white hover:bg-[#E8F5E9] text-left transition-all flex flex-col justify-between"
              >
                <div className="text-lg">📗</div>
                <div className="font-bold text-xs text-[#1E1B18] mt-1">Excel Multi-Sheet</div>
                <span className="font-mono text-[10px] text-[#2E7D32] font-bold mt-1">.xlsx →</span>
              </button>

              {/* JSON Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('JSON');
                  handleExport('JSON');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-2.5 rounded-xl border border-[#1E1B18] bg-white hover:bg-[#EDE7F6] text-left transition-all flex flex-col justify-between"
              >
                <div className="text-lg">📦</div>
                <div className="font-bold text-xs text-[#1E1B18] mt-1">Full JSON Schema</div>
                <span className="font-mono text-[10px] text-[#5E35B1] font-bold mt-1">.json →</span>
              </button>

              {/* PDF Report Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('PDF');
                  handleExport('PDF');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-2.5 rounded-xl border border-[#1E1B18] bg-white hover:bg-[#FAF6EE] text-left transition-all flex flex-col justify-between"
              >
                <div className="text-lg">📄</div>
                <div className="font-bold text-xs text-[#1E1B18] mt-1">PDF Dossier</div>
                <span className="font-mono text-[10px] text-[#FF6B35] font-bold mt-1">.pdf →</span>
              </button>

              {/* Word Card */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFormat('DOCX');
                  handleExport('DOCX');
                }}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-2.5 rounded-xl border border-[#1E1B18] bg-white hover:bg-[#FAF6EE] text-left transition-all flex flex-col justify-between"
              >
                <div className="text-lg">📝</div>
                <div className="font-bold text-xs text-[#1E1B18] mt-1">Word Document</div>
                <span className="font-mono text-[10px] text-[#FF6B35] font-bold mt-1">.docx →</span>
              </button>
            </div>
          </div>

          {/* Export Inclusions */}
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#DED4C0] flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#3E3832]">
              <input
                type="checkbox"
                checked={includeEvidence}
                onChange={(e) => setIncludeEvidence(e.target.checked)}
                className="w-4 h-4 text-[#FF6B35] rounded border-[#2C2724]"
              />
              <span>Include audit evidence &amp; source URLs</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#3E3832]">
              <input
                type="checkbox"
                checked={includeTimestamp}
                onChange={(e) => setIncludeTimestamp(e.target.checked)}
                className="w-4 h-4 text-[#FF6B35] rounded border-[#2C2724]"
              />
              <span>Include point-in-time snapshot timestamp</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F0EAD8]">
          <span className="font-hand text-xs text-[#8C847A]">
            Directly compatible with Obsidian, Notion, Microsoft Excel &amp; CRMs.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="sketch-btn px-4 py-2 text-xs font-bold text-[#1E1B18] bg-white border border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
