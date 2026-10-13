'use client';

import { useState, useMemo } from 'react';
import { CompanyRecord } from '@/lib/types';
import { downloadCsvFile, downloadPdfFile, downloadDocxFile } from '@/lib/export';
import { calculateHuntScore } from '@/lib/rank';
import HuntlystLogo from './HuntlystLogo';

interface SavedLeadsViewProps {
  savedLeads: CompanyRecord[];
  onRemoveLead: (name: string) => void;
  onViewLead: (company: CompanyRecord) => void;
  onToast: (msg: string) => void;
  onNavigateToDiscovery: () => void;
}

type SortField = 'name' | 'huntScore' | 'sector' | 'location' | 'funding';

export default function SavedLeadsView({
  savedLeads,
  onRemoveLead,
  onViewLead,
  onToast,
  onNavigateToDiscovery,
}: SavedLeadsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedFunding, setSelectedFunding] = useState('ALL');
  const [selectedConfidence, setSelectedConfidence] = useState('ALL');
  const [verifiedContactOnly, setVerifiedContactOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('huntScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Extract unique filter options
  const sectors = useMemo(() => {
    const set = new Set<string>();
    savedLeads.forEach((c) => {
      const s = c.industry || c.sector;
      if (s) set.add(s);
    });
    return Array.from(set);
  }, [savedLeads]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    savedLeads.forEach((c) => {
      const l = c.country || c.location;
      if (l) set.add(l);
    });
    return Array.from(set);
  }, [savedLeads]);

  // Filtered and sorted leads
  const filteredLeads = useMemo(() => {
    return savedLeads
      .filter((c) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          !searchQuery ||
          c.name.toLowerCase().includes(query) ||
          (c.founderOrCeoName && c.founderOrCeoName.toLowerCase().includes(query)) ||
          (c.founder?.name && c.founder.name.toLowerCase().includes(query)) ||
          ((c.industry || c.sector) && (c.industry || c.sector)!.toLowerCase().includes(query)) ||
          ((c.country || c.location) && (c.country || c.location)!.toLowerCase().includes(query)) ||
          (c.founderOrCeoEmail && c.founderOrCeoEmail.toLowerCase().includes(query)) ||
          (c.email?.address && c.email.address.toLowerCase().includes(query));

        const sector = c.industry || c.sector;
        const matchesSector = selectedSector === 'ALL' || sector === selectedSector;

        const country = c.country || c.location;
        const matchesCountry = selectedCountry === 'ALL' || country === selectedCountry;

        const score = c.huntScore || calculateHuntScore(c).score;
        const matchesConfidence =
          selectedConfidence === 'ALL' ||
          (selectedConfidence === 'HIGH' && score >= 85) ||
          (selectedConfidence === 'PERFECT' && score >= 95);

        const matchesVerifiedContact = !verifiedContactOnly || (c.emailVerified || c.email?.status === 'verified');

        return matchesSearch && matchesSector && matchesCountry && matchesConfidence && matchesVerifiedContact;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortField === 'huntScore') {
          valA = a.huntScore || calculateHuntScore(a).score;
          valB = b.huntScore || calculateHuntScore(b).score;
        } else if (sortField === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortField === 'sector') {
          valA = (a.industry || a.sector || '').toLowerCase();
          valB = (b.industry || b.sector || '').toLowerCase();
        } else if (sortField === 'location') {
          valA = (a.country || a.location || '').toLowerCase();
          valB = (b.country || b.location || '').toLowerCase();
        } else {
          valA = a.fundingOrRevenue || '';
          valB = b.fundingOrRevenue || '';
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [
    savedLeads,
    searchQuery,
    selectedSector,
    selectedCountry,
    selectedConfidence,
    verifiedContactOnly,
    sortField,
    sortAsc,
  ]);

  // Bulk Selection Handlers
  const handleToggleSelect = (name: string) => {
    setSelectedLeads((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((c) => c.name));
    }
  };

  // Bulk Export Handlers
  const handleExport = async (format: 'CSV' | 'PDF' | 'DOCX', targetLeads: CompanyRecord[]) => {
    if (targetLeads.length === 0) {
      onToast('No leads selected to export.');
      return;
    }
    setIsExporting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const count = targetLeads.length;

      if (format === 'CSV') {
        downloadCsvFile(targetLeads, `huntlyst-shortlist-${today}.csv`);
        onToast(`Exported ${count} shortlist leads as CSV! 📥`);
      } else if (format === 'PDF') {
        downloadPdfFile(targetLeads, `huntlyst-shortlist-${today}.pdf`);
        onToast(`Exported ${count} shortlist leads as PDF! 📄`);
      } else if (format === 'DOCX') {
        await downloadDocxFile(targetLeads, `huntlyst-shortlist-${today}.docx`);
        onToast(`Exported ${count} shortlist leads as Word doc! 📝`);
      }
    } catch (err: any) {
      onToast(`Export error: ${err.message || 'Failed'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCompanies = savedLeads.filter((c) => selectedLeads.includes(c.name));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 relative shadow-sketch-sm border-2 border-[#1E1B18]">
        <div className="tape-strip" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">⭐</span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                Your shortlist
              </h1>
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              {savedLeads.length} bookmarked {savedLeads.length === 1 ? 'company' : 'companies'} saved
              for strategic evaluation and outreach.
            </p>
          </div>

          {savedLeads.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={isExporting}
                onClick={() =>
                  handleExport('CSV', selectedCompanies.length > 0 ? selectedCompanies : filteredLeads)
                }
                className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white border-2 border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE] shadow-sketch-sm"
              >
                📥 Export {selectedCompanies.length > 0 ? `(${selectedCompanies.length})` : 'All'} CSV
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() =>
                  handleExport('PDF', selectedCompanies.length > 0 ? selectedCompanies : filteredLeads)
                }
                className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white border-2 border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE] shadow-sketch-sm"
              >
                📄 Export PDF
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() =>
                  handleExport('DOCX', selectedCompanies.length > 0 ? selectedCompanies : filteredLeads)
                }
                className="sketch-btn px-3 py-1.5 text-xs font-bold text-white bg-[#FF6B35] border-2 border-[#1E1B18] rounded-xl hover:bg-[#E85D26] shadow-sketch-sm"
              >
                📝 Export Word
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty State (Section 22) */}
      {savedLeads.length === 0 ? (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-10 sm:p-14 text-center border-2 border-[#1E1B18] shadow-sketch-sm space-y-4 max-w-xl mx-auto">
          <div className="flex justify-center mx-auto">
            <HuntlystLogo size="lg" state="idle" showWordmark={false} />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-2xl font-bold text-[#1E1B18]">
              Your shortlist is empty.
            </h3>
            <p className="text-sm text-[#5A544E] leading-relaxed">
              Save companies worth coming back to from your discovery results.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToDiscovery}
              className="sketch-btn px-5 py-2.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm inline-flex items-center gap-2"
            >
              <span>▶</span> Start a Hunt
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar: Search & Filters (Section 14) */}
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-4 border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-2.5 text-xs text-[#766E65]">🔍</span>
                <input
                  type="text"
                  placeholder="Search shortlist by company, founder, sector, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] focus:bg-white text-[#1E1B18] outline-none font-sans"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Sector filter */}
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] outline-none"
                >
                  <option value="ALL">All Sectors</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Country filter */}
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] outline-none"
                >
                  <option value="ALL">All Countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Confidence filter */}
                <select
                  value={selectedConfidence}
                  onChange={(e) => setSelectedConfidence(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] outline-none"
                >
                  <option value="ALL">All Scores</option>
                  <option value="HIGH">Score 85+ (High Fit)</option>
                  <option value="PERFECT">Score 95+ (Exceptional)</option>
                </select>

                {/* Verified contact checkbox toggle */}
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={verifiedContactOnly}
                    onChange={(e) => setVerifiedContactOnly(e.target.checked)}
                    className="accent-[#FF6B35]"
                  />
                  <span>Verified Email Only</span>
                </label>
              </div>
            </div>

            {/* Selection & Sorting Ribbon */}
            <div className="flex items-center justify-between border-t border-[#F0EAD8] pt-3 text-xs font-mono text-[#766E65]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="hover:text-[#1E1B18] font-bold underline"
                >
                  {selectedLeads.length === filteredLeads.length
                    ? 'Deselect All'
                    : `Select All (${filteredLeads.length})`}
                </button>
                {selectedLeads.length > 0 && (
                  <span className="text-[#FF6B35] font-bold">
                    {selectedLeads.length} selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span>Sort by:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (sortField === 'huntScore') setSortAsc(!sortAsc);
                    else {
                      setSortField('huntScore');
                      setSortAsc(false);
                    }
                  }}
                  className={`font-bold ${sortField === 'huntScore' ? 'text-[#FF6B35]' : 'text-[#1E1B18]'}`}
                >
                  Hunt Score {sortField === 'huntScore' ? (sortAsc ? '▲' : '▼') : ''}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    if (sortField === 'name') setSortAsc(!sortAsc);
                    else {
                      setSortField('name');
                      setSortAsc(true);
                    }
                  }}
                  className={`font-bold ${sortField === 'name' ? 'text-[#FF6B35]' : 'text-[#1E1B18]'}`}
                >
                  Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                </button>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLeads.map((company) => {
              const isSelected = selectedLeads.includes(company.name);
              const { score } = calculateHuntScore(company);
              const founder = company.founderOrCeoName || company.founder?.name || 'Leadership';
              const email = company.founderOrCeoEmail || company.email?.address;
              const isEmailVerified = company.emailVerified || company.email?.status === 'verified';

              return (
                <div
                  key={company.name}
                  className={`paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 transition-all space-y-3.5 flex flex-col justify-between ${
                    isSelected ? 'border-[#FF6B35] shadow-sketch-orange' : 'border-[#1E1B18] shadow-sketch-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(company.name)}
                          className="accent-[#FF6B35] w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <h4 className="font-display text-xl font-bold text-[#1E1B18] leading-tight">
                            {company.name}
                          </h4>
                          <span className="text-[11px] font-mono text-[#766E65]">
                            📍 {company.country || company.location || 'Non-US Hub'} • 🏷️ {company.industry || company.sector || 'Tech'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35]/30">
                          {score} / 100
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#4A443D] line-clamp-2 leading-relaxed font-sans">
                      {company.description || 'Technology platform validated against target criteria.'}
                    </p>
                  </div>

                  {/* Leadership & Contact row */}
                  <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs space-y-1 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-[#766E65]">Founder:</span>
                      <span className="font-bold text-[#1E1B18]">{founder}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#766E65]">Contact:</span>
                      <span className={isEmailVerified ? 'text-[#2E7D32] font-bold' : 'text-[#8C847A]'}>
                        {email || 'Pending verification'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#766E65]">Funding:</span>
                      <span className="font-bold text-[#1E1B18]">{company.fundingOrRevenue || '$1M–$5M'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => onViewLead(company)}
                      className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] rounded-xl border border-[#1E1B18] shadow-sketch-sm flex items-center gap-1.5"
                    >
                      <span>🔍</span> View Details
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveLead(company.name)}
                      className="text-xs font-mono text-[#C62828] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
