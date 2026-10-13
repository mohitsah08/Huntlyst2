'use client';

import React, { useState, useMemo } from 'react';
import {
  Phase1ImportResult,
  Phase1CompanyRecord,
  CanonicalFieldKey,
  FieldAvailabilityStatus,
} from '@/lib/internal/phase1Types';

interface InternalPhase1PreviewProps {
  importResult: Phase1ImportResult;
  onReset?: () => void;
  onProceedToVerification?: () => void;
}

const CANONICAL_FIELD_LABELS: Record<CanonicalFieldKey, string> = {
  companyName: 'Company Name',
  website: 'Website',
  canonicalDomain: 'Canonical Domain',
  industry: 'Industry / Sector',
  geography: 'Geography / Country',
  foundingYear: 'Founding Year',
  companyAge: 'Company Age',
  companyStage: 'Company Stage',
  totalFundingAmount: 'Total Funding',
  latestFundingRoundAmount: 'Latest Round Amount',
  fundingStage: 'Funding Stage / Round',
};

export function InternalPhase1Preview({
  importResult,
  onReset,
  onProceedToVerification,
}: InternalPhase1PreviewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | 'ready' | 'attention' | 'has_invalid' | 'has_ambiguous' | 'has_missing'
  >('all');
  const [showColumnMappings, setShowColumnMappings] = useState(false);
  const [showErrorsPanel, setShowErrorsPanel] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return importResult.companies.find(c => c.companyId === selectedCompanyId) || null;
  }, [selectedCompanyId, importResult.companies]);

  // Filtered companies based on search and filter tab
  const filteredCompanies = useMemo(() => {
    return importResult.companies.filter(c => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (c.canonicalFields.companyName.value || '').toLowerCase();
        const domain = (c.canonicalFields.canonicalDomain.value || '').toLowerCase();
        const industry = (c.canonicalFields.industry.value || '').toLowerCase();
        const geo = (c.canonicalFields.geography.value || '').toLowerCase();
        const matches = name.includes(q) || domain.includes(q) || industry.includes(q) || geo.includes(q);
        if (!matches) return false;
      }

      // Filter tabs
      if (filterMode === 'ready') {
        return c.summary.readiness === 'READY';
      }
      if (filterMode === 'attention') {
        return c.summary.readiness === 'ATTENTION_NEEDED';
      }
      if (filterMode === 'has_invalid') {
        return c.summary.invalidCount > 0;
      }
      if (filterMode === 'has_ambiguous') {
        return c.summary.ambiguousCount > 0;
      }
      if (filterMode === 'has_missing') {
        return c.summary.missingCount > 0;
      }
      return true;
    });
  }, [importResult.companies, searchQuery, filterMode]);

  const statusBadge = (status: FieldAvailabilityStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/30">
            <span>✓</span> Available
          </span>
        );
      case 'MISSING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5F5F5] text-[#757575] border border-[#757575]/30">
            <span>—</span> Missing
          </span>
        );
      case 'INVALID':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFEBEE] text-[#C62828] border border-[#C62828]/40 animate-pulse">
            <span>⚠</span> Invalid
          </span>
        );
      case 'AMBIGUOUS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFF8E1] text-[#B26A00] border border-[#B26A00]/40">
            <span>?</span> Ambiguous
          </span>
        );
    }
  };

  const readinessBadge = (readiness: Phase1CompanyRecord['summary']['readiness']) => {
    switch (readiness) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]">
            <span>✓</span> Ready
          </span>
        );
      case 'ATTENTION_NEEDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#FFF8E1] text-[#B26A00] border border-[#B26A00]">
            <span>⚠</span> Attention Needed
          </span>
        );
      case 'INCOMPLETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#FFEBEE] text-[#C62828] border border-[#C62828]">
            <span>✕</span> Incomplete
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Scope and Pipeline Banner */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0EAD8] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h3 className="font-display text-lg font-bold text-[#1E1B18]">
                Phase 1: File Import, Normalization & Company Preview
              </h3>
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              Deterministic in-browser preparation pipeline. Local execution only (0 external API calls). Target-profile matching and online verification are deferred to subsequent phases.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="sketch-btn px-3 py-1.5 text-xs font-mono font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border border-[#1E1B18] rounded-xl shadow-sketch-xs"
              >
                Upload New File
              </button>
            )}
          </div>
        </div>

        {/* Pipeline Execution Breadcrumbs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1 text-[11px] font-mono">
          {[
            { step: '1. Upload', done: true },
            { step: '2. Parse', done: true },
            { step: '3. Inspect', done: true },
            { step: '4. Map', done: true },
            { step: '5. Normalize', done: true },
            { step: '6. Classify', done: true },
            { step: '7. Preview', done: true },
            { step: '8. Summary', done: true },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center gap-1 p-1.5 rounded-lg border bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30 font-bold text-center"
            >
              <span>✓</span>
              <span>{item.step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* File Overview and Quality Metrics Card */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F0EAD8] pb-4">
          {/* File Meta */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-display font-bold text-base text-[#1E1B18]">
                {importResult.fileName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FF6B35] text-white border border-[#1E1B18]">
                {importResult.fileType}
              </span>
              <span className="text-xs font-mono text-[#766E65]">
                ({(importResult.fileSizeBytes / 1024).toFixed(1)} KB)
              </span>
            </div>
            <p className="text-xs font-mono text-[#766E65]">
              {importResult.totalRowsRead} total rows read • {importResult.emptyRowsSkipped} empty rows skipped • {importResult.detectedColumns.length} columns detected ({importResult.unmappedColumns.length} unmapped preserved)
            </p>
          </div>

          {/* Quick Action Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowColumnMappings(!showColumnMappings)}
              className="sketch-btn px-3 py-1.5 text-xs font-mono font-bold text-[#1E1B18] bg-[#FAF6EE] hover:bg-[#F0EAD8] border border-[#1E1B18] rounded-xl shadow-sketch-xs"
            >
              {showColumnMappings ? 'Hide Column Mapping ▲' : `Inspect Mappings (${importResult.columnMappings.length}) ▼`}
            </button>
            {importResult.errors.length > 0 && (
              <button
                type="button"
                onClick={() => setShowErrorsPanel(!showErrorsPanel)}
                className="sketch-btn px-3 py-1.5 text-xs font-mono font-bold text-[#C62828] bg-[#FFEBEE] hover:bg-[#FFCDD2] border border-[#C62828] rounded-xl shadow-sketch-xs"
              >
                {showErrorsPanel ? 'Hide Diagnostics ▲' : `View Diagnostics (${importResult.errors.length}) ▼`}
              </button>
            )}
          </div>
        </div>

        {/* Global Availability Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-[#2E7D32]/30 bg-[#E8F5E9] text-center space-y-0.5">
            <div className="text-lg font-bold font-mono text-[#2E7D32]">
              {importResult.globalSummary.totalAvailableFields}
            </div>
            <div className="text-[11px] font-mono font-bold text-[#2E7D32]">
              Available Fields (Valid)
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[#757575]/30 bg-[#F5F5F5] text-center space-y-0.5">
            <div className="text-lg font-bold font-mono text-[#616161]">
              {importResult.globalSummary.totalMissingFields}
            </div>
            <div className="text-[11px] font-mono font-bold text-[#616161]">
              Missing Fields (Empty)
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[#C62828]/30 bg-[#FFEBEE] text-center space-y-0.5">
            <div className="text-lg font-bold font-mono text-[#C62828]">
              {importResult.globalSummary.totalInvalidFields}
            </div>
            <div className="text-[11px] font-mono font-bold text-[#C62828]">
              Invalid Fields (Malformed)
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[#B26A00]/30 bg-[#FFF8E1] text-center space-y-0.5">
            <div className="text-lg font-bold font-mono text-[#B26A00]">
              {importResult.globalSummary.totalAmbiguousFields}
            </div>
            <div className="text-[11px] font-mono font-bold text-[#B26A00]">
              Ambiguous (Placeholders)
            </div>
          </div>
        </div>

        {/* Diagnostics / Parsing Warnings Drawer */}
        {showErrorsPanel && importResult.errors.length > 0 && (
          <div className="p-4 rounded-xl border-2 border-[#C62828] bg-[#FFEBEE] space-y-2">
            <h4 className="font-display font-bold text-xs text-[#C62828] uppercase tracking-wider">
              Parsing Diagnostics & Warnings ({importResult.errors.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono text-[#C62828]">
              {importResult.errors.map((err, idx) => (
                <div key={idx} className="p-2 bg-white rounded border border-[#C62828]/30 flex items-start gap-2">
                  <span>⚠️</span>
                  <div>
                    {err.rowNumber && <strong className="mr-1">Row #{err.rowNumber}:</strong>}
                    <span>{err.message}</span>
                    {err.rawSnippet && (
                      <div className="text-[10px] text-[#757575] mt-0.5 truncate">
                        Snippet: {err.rawSnippet}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Column Mapping Inspector Drawer */}
        {showColumnMappings && (
          <div className="p-4 rounded-xl border-2 border-[#1E1B18] bg-[#FAF6EE] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-bold text-xs text-[#1E1B18] uppercase tracking-wider">
                Column Header Mapping Inspection
              </h4>
              <span className="text-[11px] font-mono text-[#766E65]">
                {importResult.detectedColumns.length - importResult.unmappedColumns.length} mapped • {importResult.unmappedColumns.length} unmapped preserved
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono">
              {importResult.columnMappings.map((mapping, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    mapping.mappedField
                      ? 'bg-white border-[#2E7D32]/40 text-[#1E1B18]'
                      : 'bg-[#FFFDF9] border-[#DCD6C9] text-[#766E65]'
                  }`}
                >
                  <div className="truncate mr-2">
                    <span className="font-bold text-[#1E1B18]">{mapping.sourceColumn}</span>
                  </div>
                  <div>
                    {mapping.mappedField ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/30 whitespace-nowrap">
                        → {CANONICAL_FIELD_LABELS[mapping.mappedField] || mapping.mappedField}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5F5F5] text-[#757575] border border-[#757575]/30 whitespace-nowrap">
                        Preserved Unmapped
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-4 border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search companies by name, domain, industry, geography..."
              className="w-full pl-9 pr-3 py-2 text-xs font-mono border-2 border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
            <span className="absolute left-3 top-2.5 text-xs text-[#766E65]">🔍</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: `All (${importResult.companies.length})` },
              { id: 'ready', label: 'Ready' },
              { id: 'attention', label: 'Needs Attention' },
              { id: 'has_invalid', label: 'Has Invalid' },
              { id: 'has_ambiguous', label: 'Has Ambiguous' },
              { id: 'has_missing', label: 'Has Missing' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors ${
                  filterMode === tab.id
                    ? 'bg-[#1E1B18] text-white border-[#1E1B18]'
                    : 'bg-white text-[#1E1B18] border-[#DCD6C9] hover:bg-[#FAF6EE]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Company Preview Table */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl border-2 border-[#1E1B18] shadow-sketch-sm overflow-hidden">
        <div className="p-4 border-b border-[#F0EAD8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏢</span>
            <h4 className="font-display font-bold text-sm text-[#1E1B18]">
              Prepared Company Records ({filteredCompanies.length} of {importResult.companies.length})
            </h4>
          </div>
          <span className="text-xs font-mono text-[#766E65]">
            Click any row to inspect complete field audit & raw data
          </span>
        </div>

        {filteredCompanies.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="text-3xl">🔍</div>
            <p className="font-display font-bold text-sm text-[#1E1B18]">No companies match your filters</p>
            <p className="text-xs font-mono text-[#766E65]">Try clearing your search query or selecting &quot;All&quot;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#FAF6EE] border-b-2 border-[#1E1B18] text-[#1E1B18] font-bold">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Company Name</th>
                  <th className="py-2.5 px-3">Website / Domain</th>
                  <th className="py-2.5 px-3">Industry / Sector</th>
                  <th className="py-2.5 px-3">Geography</th>
                  <th className="py-2.5 px-3">Founded / Age</th>
                  <th className="py-2.5 px-3">Stage & Funding</th>
                  <th className="py-2.5 px-3 text-right">Readiness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EAD8]">
                {filteredCompanies.map(comp => {
                  const nameField = comp.canonicalFields.companyName;
                  const webField = comp.canonicalFields.website;
                  const domainField = comp.canonicalFields.canonicalDomain;
                  const indField = comp.canonicalFields.industry;
                  const geoField = comp.canonicalFields.geography;
                  const yearField = comp.canonicalFields.foundingYear;
                  const ageField = comp.canonicalFields.companyAge;
                  const fundingField = comp.canonicalFields.totalFundingAmount;
                  const stageField = comp.canonicalFields.companyStage;

                  const isSelected = selectedCompanyId === comp.companyId;

                  return (
                    <tr
                      key={comp.companyId}
                      onClick={() => setSelectedCompanyId(isSelected ? null : comp.companyId)}
                      className={`cursor-pointer transition-colors hover:bg-[#FAF6EE] ${
                        isSelected ? 'bg-[#FFF8E1] border-l-4 border-l-[#FF6B35]' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-[#766E65] font-bold">{comp.rowIndex}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#1E1B18]">
                          {nameField.value || <span className="text-[#C62828] italic">Unknown Entity</span>}
                        </div>
                        {nameField.status !== 'AVAILABLE' && (
                          <div className="mt-0.5">{statusBadge(nameField.status)}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {webField.value ? (
                          <span className="text-[#FF6B35] font-bold hover:underline truncate block max-w-[160px]">
                            {domainField.value || webField.value}
                          </span>
                        ) : (
                          statusBadge(webField.status)
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {indField.value ? (
                          <span className="truncate block max-w-[140px] text-[#1E1B18]">
                            {indField.value}
                          </span>
                        ) : (
                          statusBadge(indField.status)
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {geoField.value ? (
                          <span className="truncate block max-w-[130px] text-[#1E1B18]">
                            {geoField.value}
                          </span>
                        ) : (
                          statusBadge(geoField.status)
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {yearField.value ? (
                          <span className="text-[#1E1B18]">
                            {yearField.value} {ageField.value ? `(${ageField.value}y)` : ''}
                          </span>
                        ) : (
                          statusBadge(yearField.status)
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {fundingField.value ? (
                          <span className="font-bold text-[#2E7D32]">
                            {fundingField.value} {stageField.value ? `• ${stageField.value}` : ''}
                          </span>
                        ) : (
                          statusBadge(fundingField.status)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {readinessBadge(comp.summary.readiness)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Company Detailed Inspection Drawer */}
      {selectedCompany && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch space-y-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔍</span>
              <div>
                <h4 className="font-display font-bold text-base text-[#1E1B18]">
                  Detailed Field Audit: {selectedCompany.canonicalFields.companyName.value || `Row #${selectedCompany.rowIndex}`}
                </h4>
                <p className="text-xs font-mono text-[#766E65]">
                  Original Row #{selectedCompany.rowIndex} • {selectedCompany.summary.availableCount} Available • {selectedCompany.summary.missingCount} Missing • {selectedCompany.summary.invalidCount} Invalid • {selectedCompany.summary.ambiguousCount} Ambiguous
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCompanyId(null)}
              className="text-xs font-mono font-bold text-[#766E65] hover:text-[#1E1B18] px-2 py-1 bg-white border border-[#DCD6C9] rounded"
            >
              Close ✕
            </button>
          </div>

          {/* Canonical Fields Audit Table */}
          <div className="space-y-2">
            <h5 className="font-display font-bold text-xs uppercase tracking-wider text-[#1E1B18]">
              Standard Canonical Company Fields
            </h5>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-[#FAF6EE] border-b border-[#1E1B18] text-[#1E1B18] font-bold">
                    <th className="py-2 px-3">Canonical Field</th>
                    <th className="py-2 px-3">Normalized Value</th>
                    <th className="py-2 px-3">Availability Status</th>
                    <th className="py-2 px-3">Raw Source Value</th>
                    <th className="py-2 px-3">Issues / Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EAD8]">
                  {(Object.entries(selectedCompany.canonicalFields) as [CanonicalFieldKey, any][]).map(
                    ([key, field]) => (
                      <tr key={key} className="hover:bg-[#FAF6EE]">
                        <td className="py-2 px-3 font-bold text-[#1E1B18]">
                          {CANONICAL_FIELD_LABELS[key] || key}
                        </td>
                        <td className="py-2 px-3">
                          {field.normalizedDisplay || field.value !== null ? (
                            <span className="text-[#1E1B18] font-bold">
                              {field.normalizedDisplay || String(field.value)}
                            </span>
                          ) : (
                            <span className="text-[#757575] italic">null</span>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">{statusBadge(field.status)}</td>
                        <td className="py-2 px-3 text-[#766E65] max-w-[200px] truncate">
                          {field.rawValue !== undefined && field.rawValue !== null
                            ? String(field.rawValue)
                            : '—'}
                        </td>
                        <td className="py-2 px-3">
                          {field.issues && field.issues.length > 0 ? (
                            <ul className="list-disc list-inside text-[11px] text-[#C62828] space-y-0.5">
                              {field.issues.map((issue: string, idx: number) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-[#2E7D32] text-[11px]">✓ No issues</span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preserved Raw Source Fields (100% untouched) */}
          <div className="space-y-2 pt-2 border-t border-[#F0EAD8]">
            <div className="flex items-center justify-between">
              <h5 className="font-display font-bold text-xs uppercase tracking-wider text-[#1E1B18]">
                100% Preserved Source Fields (seed_data.raw_fields)
              </h5>
              <span className="text-[11px] font-mono text-[#766E65]">
                {Object.keys(selectedCompany.rawFields).length} raw columns preserved
              </span>
            </div>
            <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#DCD6C9] max-h-48 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                {Object.entries(selectedCompany.rawFields).map(([col, val], idx) => (
                  <div key={idx} className="p-2 bg-white rounded border border-[#E0D9CC] truncate">
                    <span className="font-bold text-[#1E1B18] block truncate">{col}:</span>
                    <span className="text-[#766E65] truncate block">
                      {val !== undefined && val !== null && String(val).trim() !== ''
                        ? String(val)
                        : '<empty>'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
