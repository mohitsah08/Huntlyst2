'use client';

import React, { useState, useMemo } from 'react';
import { getCompanyLeadKey } from '@/lib/deduplication';
import { CompanyRecord } from '@/lib/types';

export interface SharedCompanyRow {
  id: string;
  index: number;
  name: string;
  description?: string | null;
  domain: string;
  website?: string | null;
  industry: string;
  geography: string;
  founded: string | number;
  funding: string;
  stage: string;
  status: string;
  statusLabel: string;
  raw: any;
}

export function renderSharedStatusBadge(statusLabel: string) {
  const norm = (statusLabel || '').toUpperCase();
  if (norm === 'FOUND' || norm === 'VERIFIED' || norm === 'QUALIFIED') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/40 whitespace-nowrap">
        {statusLabel}
      </span>
    );
  }
  if (norm === 'MISSING' || norm === 'REJECTED') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFEBEE] text-[#C62828] border border-[#C62828]/40 whitespace-nowrap">
        {statusLabel}
      </span>
    );
  }
  if (
    norm === 'NEEDS REVIEW' ||
    norm === 'NEEDS_REVIEW' ||
    norm === 'REVIEW' ||
    norm === 'PARTIALLY_VERIFIED' ||
    norm === 'PARTIALLY VERIFIED'
  ) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFB74D] whitespace-nowrap">
        {statusLabel}
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FAF6EE] text-[#766E65] border border-[#766E65]/30 whitespace-nowrap">
      {statusLabel || 'UNVERIFIED'}
    </span>
  );
}

export function sharedRowToCompanyRecord(row: SharedCompanyRow): CompanyRecord {
  if (row.raw && row.raw.company) {
    return row.raw.company;
  }
  if (row.raw && row.raw.officialName) {
    const p = row.raw;
    const geo = [p.headquarters?.city, p.headquarters?.stateOrRegion, p.headquarters?.country]
      .filter(Boolean)
      .join(', ');
    return {
      id: p.id,
      name: p.officialName,
      website: p.website || (p.canonicalDomain ? `https://${p.canonicalDomain}` : ''),
      canonicalDomain: p.canonicalDomain,
      industry: p.primaryIndustry || null,
      headquarters: geo || null,
      country: p.headquarters?.country || null,
      founderOrCeoName: p.leadership?.ceo?.name || p.leadership?.founders?.[0]?.name || null,
      founderOrCeoEmail: p.contacts?.generalEmail || null,
      fundingOrRevenue: row.funding !== 'Not disclosed' ? row.funding : null,
      latestRound: p.funding?.latestRoundType || null,
      description: p.description || null,
      emailVerified: false,
      confidenceScore: p.researchCompletenessScore ? p.researchCompletenessScore / 100 : 0.8,
      sourceType: 'FIRECRAWL_RESEARCH',
    };
  }
  return {
    id: row.id,
    name: row.name,
    website: row.website || (row.domain ? `https://${row.domain}` : ''),
    canonicalDomain: row.domain,
    industry: row.industry !== 'Not disclosed' ? row.industry : null,
    headquarters: row.geography !== 'Not disclosed' ? row.geography : null,
    country: row.geography !== 'Not disclosed' ? row.geography : null,
    founderOrCeoName: null,
    founderOrCeoEmail: null,
    fundingOrRevenue: row.funding !== 'Not disclosed' ? row.funding : null,
    latestRound: row.stage !== 'Not disclosed' ? row.stage : null,
    description: row.description || null,
    emailVerified: false,
    confidenceScore: 0.8,
    sourceType: 'INTERNAL_FILE',
  };
}

export interface SharedCompanyTableProps {
  // Title & Header info
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;

  // Data
  rows: SharedCompanyRow[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;

  // Selection
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, row: SharedCompanyRow) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;

  // Actions
  onView: (row: SharedCompanyRow) => void;
  savedLeads?: any[];
  onToggleSave?: (company: CompanyRecord) => void;
  onToast?: (msg: string) => void;

  // Toolbar & Custom Actions
  toolbarActions?: React.ReactNode;
  extraRowActions?: (row: SharedCompanyRow, closeMenu: () => void) => React.ReactNode;

  // External controlled search (optional)
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export default function SharedCompanyTable({
  title = 'Company Records',
  subtitle,
  icon = '📊',
  rows,
  isLoading = false,
  emptyTitle = 'No company records yet.',
  emptySubtitle = 'No research results yet. Start a search or research operation to discover companies.',
  selectable = false,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onView,
  savedLeads = [],
  onToggleSave,
  onToast,
  toolbarActions,
  extraRowActions,
  searchQuery: controlledSearchQuery,
  onSearchChange,
}: SharedCompanyTableProps) {
  // Local search state when not controlled
  const [internalSearch, setInternalSearch] = useState('');
  const activeSearch = controlledSearchQuery !== undefined ? controlledSearchQuery : internalSearch;

  const handleSearchChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalSearch(val);
    }
  };

  // Filter Popover State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEEDS_REVIEW' | 'MISSING' | 'FOUND' | 'UNVERIFIED'>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Pagination State — STRICT DEFAULT: 10 records per page
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Row Action Context Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filtered & Searched records
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. Search Query
      if (activeSearch.trim()) {
        const q = activeSearch.toLowerCase().trim();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesDomain = (r.domain || '').toLowerCase().includes(q);
        const matchesIndustry = (r.industry || '').toLowerCase().includes(q);
        const matchesGeo = (r.geography || '').toLowerCase().includes(q);
        const matchesStage = (r.stage || '').toLowerCase().includes(q);
        const matchesStatus = (r.statusLabel || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDomain && !matchesIndustry && !matchesGeo && !matchesStage && !matchesStatus) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const norm = (r.statusLabel || r.status || '').toUpperCase();
        if (statusFilter === 'FOUND' && !(norm === 'FOUND' || norm === 'VERIFIED' || norm === 'QUALIFIED')) {
          return false;
        }
        if (statusFilter === 'MISSING' && !(norm === 'MISSING' || norm === 'REJECTED')) {
          return false;
        }
        if (
          statusFilter === 'NEEDS_REVIEW' &&
          !(
            norm === 'NEEDS REVIEW' ||
            norm === 'NEEDS_REVIEW' ||
            norm === 'REVIEW' ||
            norm === 'PARTIALLY_VERIFIED' ||
            norm === 'PARTIALLY VERIFIED'
          )
        ) {
          return false;
        }
        if (statusFilter === 'UNVERIFIED' && !(norm === 'UNVERIFIED' || norm === '')) {
          return false;
        }
      }

      // 3. Stage Filter
      if (stageFilter !== 'ALL') {
        if (!r.stage || !r.stage.toLowerCase().includes(stageFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [rows, activeSearch, statusFilter, stageFilter]);

  // Reset pagination when filter/search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeSearch, statusFilter, stageFilter, rows.length]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    let unverified = 0;
    let needsReview = 0;
    let verified = 0;
    let missing = 0;

    for (const r of rows) {
      const norm = (r.statusLabel || r.status || '').toUpperCase();
      if (norm === 'FOUND' || norm === 'VERIFIED' || norm === 'QUALIFIED') {
        verified++;
      } else if (
        norm === 'NEEDS REVIEW' ||
        norm === 'NEEDS_REVIEW' ||
        norm === 'REVIEW' ||
        norm === 'PARTIALLY_VERIFIED' ||
        norm === 'PARTIALLY VERIFIED'
      ) {
        needsReview++;
      } else if (norm === 'MISSING' || norm === 'REJECTED') {
        missing++;
      } else {
        unverified++;
      }
    }

    return { total: rows.length, unverified, needsReview, verified, missing };
  }, [rows]);

  // Pagination calculation
  const totalRecords = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  const currentDisplayedRows = filteredRows.slice(startIndex, endIndex);

  // Selection helpers
  const isAllSelected = useMemo(() => {
    if (!selectable || !selectedIds || currentDisplayedRows.length === 0) return false;
    return currentDisplayedRows.every((r) => selectedIds.has(r.id) || selectedIds.has(r.name));
  }, [selectable, selectedIds, currentDisplayedRows]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      if (onDeselectAll) {
        onDeselectAll();
      } else if (onToggleSelect && selectedIds) {
        for (const r of currentDisplayedRows) {
          if (selectedIds.has(r.id) || selectedIds.has(r.name)) {
            onToggleSelect(r.id, r);
          }
        }
      }
    } else {
      if (onSelectAll) {
        onSelectAll();
      } else if (onToggleSelect && selectedIds) {
        for (const r of currentDisplayedRows) {
          if (!selectedIds.has(r.id) && !selectedIds.has(r.name)) {
            onToggleSelect(r.id, r);
          }
        }
      }
    }
  };

  const isRowSaved = (row: SharedCompanyRow) => {
    if (!savedLeads || savedLeads.length === 0) return false;
    const targetKey = getCompanyLeadKey({ name: row.name, website: row.website || row.domain });
    return savedLeads.some((s: any) => getCompanyLeadKey(s) === targetKey);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Table Card Container */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl border-2 border-[#1E1B18] shadow-sketch-sm overflow-hidden">
        {/* Card Header & Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[#E5E0D5] flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#FAF6EE]">
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B35] text-white flex items-center justify-center text-base shrink-0 shadow-sketch-xs">
              {icon}
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-[#1E1B18] leading-tight">
                {title} ({totalRecords})
              </h3>
              <p className="text-[11px] font-mono text-[#766E65] mt-0.5">
                {subtitle ||
                  `${summaryCounts.total} total rows • ${summaryCounts.unverified} unverified • ${summaryCounts.needsReview} needs review • ${summaryCounts.verified} verified`}
              </p>
            </div>
          </div>

          {/* Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* 1. Search */}
            <div className="relative min-w-[170px] sm:min-w-[200px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#766E65]">🔍</span>
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg border border-[#1E1B18] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF6B35] shadow-sketch-xs"
              />
              {activeSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#766E65] hover:text-[#1E1B18]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Filter Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`px-3 py-1.5 rounded-lg border border-[#1E1B18] text-xs font-bold font-mono flex items-center gap-1.5 transition-colors shadow-sketch-xs ${
                  statusFilter !== 'ALL' || stageFilter !== 'ALL'
                    ? 'bg-[#1E1B18] text-white'
                    : 'bg-white text-[#1E1B18] hover:bg-[#FAF6EE]'
                }`}
              >
                <span>∇</span>
                <span>Filter</span>
                {(statusFilter !== 'ALL' || stageFilter !== 'ALL') && (
                  <span className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                )}
              </button>

              {/* Filter Popover */}
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 p-3 bg-white rounded-xl border-2 border-[#1E1B18] shadow-sketch-md z-30 space-y-3 animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-1.5">
                    <span className="text-xs font-bold text-[#1E1B18]">Filter Records</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setStageFilter('ALL');
                      }}
                      className="text-[10px] font-mono text-[#FF6B35] hover:underline"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#766E65] block">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="w-full p-1.5 text-xs font-mono rounded border border-[#DCD6C9] bg-white"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="NEEDS_REVIEW">Needs Review</option>
                      <option value="MISSING">Missing / Rejected</option>
                      <option value="FOUND">Found / Verified</option>
                      <option value="UNVERIFIED">Unverified</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#766E65] block">Stage</label>
                    <select
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="w-full p-1.5 text-xs font-mono rounded border border-[#DCD6C9] bg-white"
                    >
                      <option value="ALL">All Stages</option>
                      <option value="Seed">Seed</option>
                      <option value="Series A">Series A</option>
                      <option value="Series B">Series B</option>
                      <option value="Series C">Series C</option>
                      <option value="Series D">Series D</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="w-full py-1 text-xs font-bold text-white bg-[#1E1B18] rounded-lg hover:bg-[#333]"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* Custom Toolbar Actions (Settings, Verify, Export, etc.) */}
            {toolbarActions}
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#FAF6EE] text-[#766E65] text-[11px] font-bold">
                {/* 1. # */}
                <th className="py-2.5 px-3 w-14 text-center">
                  {selectable ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        className="w-3.5 h-3.5 rounded text-[#FF6B35] focus:ring-[#FF6B35] cursor-pointer"
                        title="Select/Deselect All on this page"
                      />
                      <span>#</span>
                    </div>
                  ) : (
                    '#'
                  )}
                </th>

                {/* 2. Company */}
                <th className="py-2.5 px-3">Company</th>

                {/* 3. Domain */}
                <th className="py-2.5 px-3">Domain</th>

                {/* 4. Industry */}
                <th className="py-2.5 px-3">Industry</th>

                {/* 5. Geography */}
                <th className="py-2.5 px-3">Geography</th>

                {/* 6. Founded */}
                <th className="py-2.5 px-3">Founded</th>

                {/* 7. Funding */}
                <th className="py-2.5 px-3">Funding</th>

                {/* 8. Stage */}
                <th className="py-2.5 px-3">Stage</th>

                {/* 9. Status */}
                <th className="py-2.5 px-3">Status</th>

                {/* 10. Actions */}
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EAD8]">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs font-mono text-[#766E65]">
                    <span className="w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    Loading company records...
                  </td>
                </tr>
              ) : currentDisplayedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs font-mono text-[#766E65]">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[#1E1B18]">
                        {rows.length === 0
                          ? emptyTitle
                          : 'No company records matched your active filter or search query.'}
                      </div>
                      <div className="text-xs text-[#766E65]">
                        {rows.length === 0 ? (
                          emptySubtitle
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleSearchChange('');
                              setStatusFilter('ALL');
                              setStageFilter('ALL');
                            }}
                            className="text-[#FF6B35] font-bold underline hover:text-[#E55A2B]"
                          >
                            Reset search & filters
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                currentDisplayedRows.map((record) => {
                  const isSelected = Boolean(
                    selectedIds && (selectedIds.has(record.id) || selectedIds.has(record.name))
                  );
                  const isSaved = isRowSaved(record);

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-[#FFF8EE] transition-colors group cursor-default ${
                        isSelected ? 'bg-[#FFF9F2]' : ''
                      }`}
                    >
                      {/* 1. # */}
                      <td className="py-2.5 px-3 text-center text-[#766E65] font-bold">
                        {selectable ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect?.(record.id, record)}
                              className="w-3.5 h-3.5 rounded text-[#FF6B35] focus:ring-[#FF6B35] cursor-pointer"
                            />
                            <span>{record.index}</span>
                          </div>
                        ) : (
                          record.index
                        )}
                      </td>

                      {/* 2. Company */}
                      <td className="py-2.5 px-3 font-bold text-[#1E1B18] font-sans">
                        <div className="leading-tight">{record.name}</div>
                        {record.description && (
                          <div
                            className="text-[10px] text-[#766E65] font-mono font-normal truncate max-w-xs mt-0.5"
                            title={record.description}
                          >
                            {record.description}
                          </div>
                        )}
                      </td>

                      {/* 3. Domain */}
                      <td className="py-2.5 px-3 text-[#FF6B35] hover:underline cursor-pointer">
                        {record.domain ? (
                          <a
                            href={
                              record.website ||
                              (record.domain.startsWith('http') ? record.domain : `https://${record.domain}`)
                            }
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {record.domain}
                          </a>
                        ) : (
                          <span className="text-[#766E65] italic">Not found</span>
                        )}
                      </td>

                      {/* 4. Industry */}
                      <td className="py-2.5 px-3 text-[#5A544E]">
                        {record.industry || 'Not disclosed'}
                      </td>

                      {/* 5. Geography */}
                      <td className="py-2.5 px-3 text-[#5A544E]">
                        {record.geography || 'Not disclosed'}
                      </td>

                      {/* 6. Founded */}
                      <td className="py-2.5 px-3 text-[#5A544E]">
                        {record.founded || 'Not disclosed'}
                      </td>

                      {/* 7. Funding */}
                      <td className="py-2.5 px-3 font-bold text-[#1E1B18]">
                        {record.funding || 'Not disclosed'}
                      </td>

                      {/* 8. Stage (Cyan Pill) */}
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E0F7FA] text-[#00838F] border border-[#00838F]/30 whitespace-nowrap">
                          {record.stage || 'Not disclosed'}
                        </span>
                      </td>

                      {/* 9. Status Badge */}
                      <td className="py-2.5 px-3">{renderSharedStatusBadge(record.statusLabel)}</td>

                      {/* 10. Actions (View ↗ + Shortlist Star + Context Menu) */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onView(record)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold text-[#1E1B18] bg-white border border-[#1E1B18] hover:bg-[#FAF6EE] shadow-sketch-xs flex items-center gap-1 transition-colors"
                          >
                            <span>View</span>
                            <span>↗</span>
                          </button>

                          {onToggleSave && (
                            <button
                              type="button"
                              onClick={() => onToggleSave(sharedRowToCompanyRecord(record))}
                              className={`p-1 rounded-md border text-xs transition-colors ${
                                isSaved
                                  ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#FF6B35]'
                                  : 'bg-white border-[#D9D0C1] text-[#766E65] hover:bg-[#FAF6EE]'
                              }`}
                              title={isSaved ? 'Remove from Shortlist' : 'Save to Shortlist'}
                            >
                              {isSaved ? '⭐' : '☆'}
                            </button>
                          )}

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMenuId(activeMenuId === record.id ? null : record.id)
                              }
                              className="w-6 h-6 rounded flex items-center justify-center text-[#766E65] hover:text-[#1E1B18] hover:bg-white text-base"
                            >
                              ⋮
                            </button>

                            {activeMenuId === record.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 p-1 bg-white rounded-lg border border-[#1E1B18] shadow-sketch-md z-30 space-y-0.5 animate-in zoom-in-95 duration-100 text-left">
                                {record.domain && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(record.domain);
                                      setActiveMenuId(null);
                                      if (onToast) onToast(`Copied ${record.domain}! 📋`);
                                    }}
                                    className="w-full px-2 py-1 text-left text-[11px] font-mono hover:bg-[#FAF6EE] rounded text-[#1E1B18]"
                                  >
                                    Copy Domain
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    onView(record);
                                  }}
                                  className="w-full px-2 py-1 text-left text-[11px] font-mono hover:bg-[#FAF6EE] rounded text-[#1E1B18]"
                                >
                                  View Dossier
                                </button>
                                {record.domain && (
                                  <a
                                    href={
                                      record.website ||
                                      (record.domain.startsWith('http')
                                        ? record.domain
                                        : `https://${record.domain}`)
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => setActiveMenuId(null)}
                                    className="block w-full px-2 py-1 text-left text-[11px] font-mono hover:bg-[#FAF6EE] rounded text-[#1E1B18]"
                                  >
                                    Visit Website ↗
                                  </a>
                                )}
                                {onToggleSave && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onToggleSave(sharedRowToCompanyRecord(record));
                                    }}
                                    className="w-full px-2 py-1 text-left text-[11px] font-mono hover:bg-[#FAF6EE] rounded text-[#1E1B18]"
                                  >
                                    {isSaved ? 'Unsave from Shortlist' : 'Save to Shortlist ⭐'}
                                  </button>
                                )}
                                {extraRowActions && extraRowActions(record, () => setActiveMenuId(null))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer — STRICT: default 10 per page */}
        <div className="p-3 sm:p-4 border-t border-[#E5E0D5] bg-[#FAF6EE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono font-bold text-[#766E65]">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRowsPerPage(val);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded border border-[#1E1B18] bg-white text-[#1E1B18] focus:outline-none shadow-sketch-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Current Range and Total */}
          <div>
            {totalRecords > 0 ? (
              <span>
                {startIndex + 1}–{endIndex} of {totalRecords} rows
              </span>
            ) : (
              <span>0 of 0 rows</span>
            )}
          </div>

          {/* Pager Navigation Controls (< [1] [2] [3] ... [10] >) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="w-7 h-7 rounded border border-[#1E1B18] bg-white text-[#1E1B18] hover:bg-[#FAF6EE] disabled:opacity-30 flex items-center justify-center text-xs shadow-sketch-xs"
            >
              &lt;
            </button>

            {/* Dynamic Page Buttons */}
            {Array.from({ length: totalPages }).map((_, i) => {
              const pNum = i + 1;
              if (
                pNum === 1 ||
                pNum === totalPages ||
                (pNum >= currentPage - 1 && pNum <= currentPage + 1)
              ) {
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setCurrentPage(pNum)}
                    className={`w-7 h-7 rounded border border-[#1E1B18] text-xs font-mono font-bold shadow-sketch-xs transition-colors ${
                      currentPage === pNum
                        ? 'bg-[#1E1B18] text-white'
                        : 'bg-white text-[#1E1B18] hover:bg-[#FAF6EE]'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              } else if (pNum === currentPage - 2 || pNum === currentPage + 2) {
                return (
                  <span key={pNum} className="px-1 text-xs text-[#766E65]">
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="w-7 h-7 rounded border border-[#1E1B18] bg-white text-[#1E1B18] hover:bg-[#FAF6EE] disabled:opacity-30 flex items-center justify-center text-xs shadow-sketch-xs"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
