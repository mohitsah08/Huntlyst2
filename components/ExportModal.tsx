'use client';

import { useState, useMemo } from 'react';
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
} from '@/lib/export';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  // Flexible input sources
  records?: UniversalExportRecord[];
  companies?: CompanyRecord[];
  rejectedCompanies?: RejectedCompanyRecord[];
  stagedResults?: CompanyVerificationResult[];
  // Contextual metadata
  initialStage?: PipelineStageLabel;
  initialStatus?: LeadStatusLabel;
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
  initialStage,
  initialStatus,
  selectedIds = [],
  title,
  subtitle,
  huntId,
  searchQuery,
}: ExportModalProps) {
  // Snapshot timestamp generated once per modal open
  const snapshotTime = useMemo(() => formatSnapshotTime(), [isOpen]);

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
      const rec = normalizeVerificationResult(res, initialStage || 'Stage 5: Verification', false, { huntId, searchQuery });
      if (!seenIds.has(rec.id)) {
        seenIds.add(rec.id);
        unified.push(rec);
      }
    });

    return unified;
  }, [directRecords, companies, rejectedCompanies, stagedResults, initialStage, huntId, searchQuery]);

  // Scope filter: 'all' | 'selected'
  const [scope, setScope] = useState<'all' | 'selected'>('all');

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

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    let base = allNormalizedRecords;

    if (scope === 'selected' && selectedIds.length > 0) {
      base = base.filter((r) => selectedIds.includes(r.id));
    }

    return filterExportRecords(base, {
      stages: selectedStages.length === ALL_STAGES.length ? undefined : selectedStages,
      statuses: selectedStatuses.length === ALL_STATUSES.length ? undefined : selectedStatuses,
    });
  }, [allNormalizedRecords, scope, selectedIds, selectedStages, selectedStatuses]);

  // Counts by status in the filtered export set
  const countsBreakdown = useMemo(() => {
    const counts = {
      total: filteredRecords.length,
      approved: 0,
      rejected: 0,
      review: 0,
      unverified: 0,
      other: 0,
    };

    filteredRecords.forEach((r) => {
      if (r.recordStatus === 'Approved' || r.recordStatus === 'Selected') counts.approved++;
      else if (r.recordStatus === 'Rejected') counts.rejected++;
      else if (r.recordStatus === 'Under Review' || r.recordStatus === 'Partially Verified') counts.review++;
      else if (r.recordStatus === 'Unverified') counts.unverified++;
      else counts.other++;
    });

    return counts;
  }, [filteredRecords]);

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

  // Export handlers
  const handleExport = async (format: 'CSV' | 'XLSX' | 'JSON' | 'PDF' | 'DOCX') => {
    if (filteredRecords.length === 0) {
      onToast('No records match your selected stage and status filters.');
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
    };

    try {
      if (format === 'CSV') {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1E1B18]/65 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="paper-card bg-[#FFFDF9] max-w-2xl w-full rounded-2xl p-5 sm:p-7 relative shadow-sketch-lg border-2 border-[#1E1B18] space-y-5 my-6 max-h-[92vh] flex flex-col">
        {/* Tape decoration */}
        <div className="tape-strip" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#F0EAD8] pb-3.5 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📦</span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                {title || 'Export Discovery Data'}
              </h3>
            </div>
            <p className="font-sans text-xs text-[#766E65] mt-1">
              {subtitle || 'Full fidelity export across all pipeline stages, evaluation statuses, and audit trails.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border-[1.5px] border-[#2C2724] bg-white hover:bg-[#F0EAD8] flex items-center justify-center font-bold text-sm shadow-[1px_2px_0px_#2C2724]"
            aria-label="Close export modal"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* Scope Selector (All vs Selected) */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-[#FAF6EE] p-1.5 rounded-xl border border-[#DED4C0] text-xs">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all ${
                  scope === 'all'
                    ? 'bg-[#1E1B18] text-white shadow-sketch-xs'
                    : 'text-[#766E65] hover:text-[#1E1B18]'
                }`}
              >
                All Discovered Records ({allNormalizedRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('selected')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all ${
                  scope === 'selected'
                    ? 'bg-[#FF6B35] text-white shadow-sketch-xs'
                    : 'text-[#766E65] hover:text-[#1E1B18]'
                }`}
              >
                Selected Rows Only ({selectedIds.length})
              </button>
            </div>
          )}

          {/* Real-time Live Count Breakdown Banner (Section 61 & 69) */}
          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18] shadow-sketch-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-[#1E1B18] flex items-center gap-1.5">
                <span>🎯</span>
                <span>Records to Export: {countsBreakdown.total}</span>
              </span>
              <span className="font-mono text-[10px] text-[#766E65] bg-white px-2 py-0.5 rounded-full border border-[#D9D0C1]">
                Snapshot: {snapshotTime}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="bg-white p-2 rounded-lg border border-[#C8E6C9] flex items-center justify-between">
                <span className="text-[#2E7D32] font-bold">Approved</span>
                <span className="font-bold text-[#2E7D32]">{countsBreakdown.approved}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#FFCDD2] flex items-center justify-between">
                <span className="text-[#C62828] font-bold">Rejected</span>
                <span className="font-bold text-[#C62828]">{countsBreakdown.rejected}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#FFE082] flex items-center justify-between">
                <span className="text-[#F57F17] font-bold">Under Review</span>
                <span className="font-bold text-[#F57F17]">{countsBreakdown.review}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#E0E0E0] flex items-center justify-between">
                <span className="text-[#616161] font-bold">Unverified</span>
                <span className="font-bold text-[#616161]">{countsBreakdown.unverified}</span>
              </div>
            </div>
          </div>

          {/* Filter Builder Accordion (Section 60 & 68 - Progressive Disclosure) */}
          <div className="border border-[#DED4C0] rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowFilterBuilder(!showFilterBuilder)}
              className="w-full px-4 py-2.5 bg-[#FAF6EE] flex items-center justify-between text-xs font-bold text-[#1E1B18] hover:bg-[#F2ECE0] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span>⚙️</span>
                <span>Filter by Pipeline Stage &amp; Status</span>
                {(selectedStages.length < ALL_STAGES.length || selectedStatuses.length < ALL_STATUSES.length) && (
                  <span className="px-2 py-0.2 rounded-full bg-[#FF6B35] text-white text-[10px] font-mono">
                    Filtered
                  </span>
                )}
              </div>
              <span className="text-[#766E65]">{showFilterBuilder ? '▲ Hide' : '▼ Customize'}</span>
            </button>

            {showFilterBuilder && (
              <div className="p-4 space-y-4 text-xs border-t border-[#DED4C0] bg-[#FFFDF9]">
                {/* Stage Filters */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E1B18] font-mono text-[11px] uppercase tracking-wider">
                      Pipeline Stages:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedStages(selectedStages.length === ALL_STAGES.length ? [] : ALL_STAGES)}
                      className="text-[10px] text-[#FF6B35] hover:underline font-bold"
                    >
                      {selectedStages.length === ALL_STAGES.length ? 'Clear Stages' : 'Select All Stages'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ALL_STAGES.map((st) => (
                      <label key={st} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-[#FAF6EE]">
                        <input
                          type="checkbox"
                          checked={selectedStages.includes(st)}
                          onChange={() => handleToggleStage(st)}
                          className="w-4 h-4 text-[#FF6B35] rounded border-[#2C2724]"
                        />
                        <span className="text-xs text-[#3E3832]">{st}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status Filters */}
                <div className="space-y-2 pt-2 border-t border-[#F0EAD8]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E1B18] font-mono text-[11px] uppercase tracking-wider">
                      Lead Statuses:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses(['Approved', 'Selected'])}
                        className="text-[10px] text-[#2E7D32] hover:underline font-bold"
                      >
                        Approved Only
                      </button>
                      <span className="text-[#D9D0C1]">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses(['Rejected'])}
                        className="text-[10px] text-[#C62828] hover:underline font-bold"
                      >
                        Rejected Only
                      </button>
                      <span className="text-[#D9D0C1]">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses(selectedStatuses.length === ALL_STATUSES.length ? [] : ALL_STATUSES)}
                        className="text-[10px] text-[#FF6B35] hover:underline font-bold"
                      >
                        All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {ALL_STATUSES.map((stat) => (
                      <label key={stat} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-[#FAF6EE]">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(stat)}
                          onChange={() => handleToggleStatus(stat)}
                          className="w-4 h-4 text-[#FF6B35] rounded border-[#2C2724]"
                        />
                        <span className="text-xs text-[#3E3832]">{stat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Formats Grid (5 Options - Section 54-57) */}
          <div className="space-y-2">
            <span className="font-bold text-[#1E1B18] font-mono text-[11px] uppercase tracking-wider">
              Choose Export Format:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* CSV Card */}
              <button
                type="button"
                onClick={() => handleExport('CSV')}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-3.5 rounded-xl border-[1.8px] border-[#2C2724] bg-white hover:bg-[#FFE7DC] hover:border-[#FF6B35] text-left transition-all shadow-sketch-xs hover:shadow-sketch group flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">📊</div>
                  <div className="font-bold text-xs text-[#1E1B18]">CSV Spreadsheet</div>
                  <div className="font-sans text-[10px] text-[#5A544E] mt-0.5 leading-tight">
                    Clean RFC-4180 format with UTF-8 BOM, all reasons &amp; criteria.
                  </div>
                </div>
                <div className="mt-3 pt-1.5 border-t border-[#F0EAD8] font-mono text-[10px] text-[#FF6B35] font-bold">
                  {isExporting === 'CSV' ? 'Exporting...' : 'Download .csv →'}
                </div>
              </button>

              {/* Excel Card */}
              <button
                type="button"
                onClick={() => handleExport('XLSX')}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-3.5 rounded-xl border-[1.8px] border-[#2C2724] bg-white hover:bg-[#E8F5E9] hover:border-[#2E7D32] text-left transition-all shadow-sketch-xs hover:shadow-sketch group flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">📗</div>
                  <div className="font-bold text-xs text-[#1E1B18]">Excel Workbook</div>
                  <div className="font-sans text-[10px] text-[#5A544E] mt-0.5 leading-tight">
                    Multi-sheet workbook (All, Approved, Rejected, Audit, Evidence).
                  </div>
                </div>
                <div className="mt-3 pt-1.5 border-t border-[#F0EAD8] font-mono text-[10px] text-[#2E7D32] font-bold">
                  {isExporting === 'XLSX' ? 'Exporting...' : 'Download .xlsx →'}
                </div>
              </button>

              {/* JSON Card */}
              <button
                type="button"
                onClick={() => handleExport('JSON')}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-3.5 rounded-xl border-[1.8px] border-[#2C2724] bg-white hover:bg-[#EDE7F6] hover:border-[#5E35B1] text-left transition-all shadow-sketch-xs hover:shadow-sketch group flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">📦</div>
                  <div className="font-bold text-xs text-[#1E1B18]">JSON Full Schema</div>
                  <div className="font-sans text-[10px] text-[#5A544E] mt-0.5 leading-tight">
                    Complete nested pipeline structure for developers &amp; APIs.
                  </div>
                </div>
                <div className="mt-3 pt-1.5 border-t border-[#F0EAD8] font-mono text-[10px] text-[#5E35B1] font-bold">
                  {isExporting === 'JSON' ? 'Exporting...' : 'Download .json →'}
                </div>
              </button>

              {/* PDF Report Card */}
              <button
                type="button"
                onClick={() => handleExport('PDF')}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-3 rounded-xl border border-[#D9D0C1] bg-white hover:bg-[#FAF6EE] text-left transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  <div>
                    <div className="font-bold text-xs text-[#1E1B18]">PDF Dossier Report</div>
                    <div className="font-sans text-[10px] text-[#766E65]">Executive discovery report</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[#FF6B35] font-bold">.pdf →</span>
              </button>

              {/* Word Card */}
              <button
                type="button"
                onClick={() => handleExport('DOCX')}
                disabled={filteredRecords.length === 0 || !!isExporting}
                className="p-3 rounded-xl border border-[#D9D0C1] bg-white hover:bg-[#FAF6EE] text-left transition-all flex items-center justify-between sm:col-span-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📝</span>
                  <div>
                    <div className="font-bold text-xs text-[#1E1B18]">Word Document (.docx)</div>
                    <div className="font-sans text-[10px] text-[#766E65]">Editable formatted report with company dossiers</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[#FF6B35] font-bold">.docx →</span>
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
            Compatible with Microsoft Excel, Google Sheets, Notion &amp; CRM ingestion.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-sketch-secondary px-4 py-1.5 text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
