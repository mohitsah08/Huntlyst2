'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { HuntConfig } from '@/lib/types';
import {
  TargetProfile,
  DEFAULT_TVB_TARGET_PROFILE,
  STANDARD_PRESETS,
  BUILTIN_SAVED_PROFILES,
  HIERARCHICAL_SECTORS,
  HierarchicalSector,
  TriState,
  getSectorSelectionState,
  getGlobalSelectionState,
  getAllTaxonomySubSectors,
  getConciseIndustrySummary,
  TARGET_COUNT_OPTIONS,
  FINANCIAL_METRICS,
  CURRENCY_OPTIONS,
  getFinancialValuesForCurrency,
  COMPANY_AGE_OPTIONS,
  getAvailableYears,
  DATA_FRESHNESS_OPTIONS,
  ACTIVITY_TYPES,
  COMPANY_STAGE_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  REGION_OPTIONS,
  US_PRESENCE_OPTIONS,
  DECISION_MAKER_OPTIONS,
  EMAIL_REQUIREMENT_OPTIONS,
  EMAIL_VERIFICATION_LEVELS,
  COMPANY_SOCIAL_OPTIONS,
  PERSON_SOCIAL_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  RESEARCH_SOURCES_OPTIONS,
  formatTargetSummary,
  targetProfileToHuntConfig,
  huntConfigToTargetProfile,
} from '@/lib/targetProfileData';
import { COUNTRIES, searchCountries } from '@/lib/geography';

interface HuntConfigurationProps {
  initialConfig?: HuntConfig;
  isRunning: boolean;
  onLaunchHunt: (config: HuntConfig) => void;
  onClose?: () => void;
}

/**
 * Accessible Tri-State Checkbox
 * Renders standard native checkbox with physical indeterminate property & ARIA aria-checked="mixed"
 */
function TriStateCheckbox({
  state,
  onChange,
  id,
  ariaLabel,
  className = '',
}: {
  state: TriState;
  onChange: () => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === 'partial';
    }
  }, [state]);

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={state === 'all'}
      aria-checked={state === 'partial' ? 'mixed' : state === 'all'}
      aria-label={ariaLabel}
      onChange={onChange}
      className={`w-4 h-4 rounded border-2 border-[#1E1B18] text-[#FF6B35] accent-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/40 cursor-pointer transition-colors ${className}`}
    />
  );
}

export default function HuntConfiguration({
  initialConfig,
  isRunning,
  onLaunchHunt,
  onClose,
}: HuntConfigurationProps) {
  // Initialize target profile from initialConfig
  const [profile, setProfile] = useState<TargetProfile>(() => {
    if (initialConfig) {
      return huntConfigToTargetProfile(initialConfig);
    }
    return DEFAULT_TVB_TARGET_PROFILE;
  });

  // Track initial snapshot for dirty state detection
  const [initialSnapshot, setInitialSnapshot] = useState<string>(() => {
    const p = initialConfig ? huntConfigToTargetProfile(initialConfig) : DEFAULT_TVB_TARGET_PROFILE;
    return JSON.stringify(p);
  });

  // Saved presets state
  const [savedProfiles, setSavedProfiles] = useState<TargetProfile[]>(BUILTIN_SAVED_PROFILES);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    initialConfig?.targetProfile?.id || initialConfig?.id || 'tvb_eval_default'
  );

  // Search & filter states
  const [industrySearch, setIndustrySearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [customIndustryInput, setCustomIndustryInput] = useState('');

  // Expand/collapse states for sectors
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({
    technology: true,
    finance: false,
    healthcare: false,
    agriculture: false,
  });

  // Load custom presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('huntlyst_saved_target_profiles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedProfiles([
            ...BUILTIN_SAVED_PROFILES,
            ...parsed.filter((p: any) => !BUILTIN_SAVED_PROFILES.some(b => b.id === p.id)),
          ]);
        }
      }
    } catch {}
  }, []);

  // Update when initialConfig changes externally
  useEffect(() => {
    if (initialConfig) {
      const converted = huntConfigToTargetProfile(initialConfig);
      setProfile(converted);
      setInitialSnapshot(JSON.stringify(converted));
    }
  }, [initialConfig]);

  // Dirty state calculation
  const isDirty = useMemo(() => {
    return JSON.stringify(profile) !== initialSnapshot;
  }, [profile, initialSnapshot]);

  // Financial options based on currency
  const financialOptions = useMemo(() => {
    return getFinancialValuesForCurrency(profile.fundingCurrency);
  }, [profile.fundingCurrency]);

  // Filtered countries
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES.slice(0, 16);
    return searchCountries(countrySearch).slice(0, 16);
  }, [countrySearch]);

  // Available years
  const years = useMemo(() => getAvailableYears(), []);

  // -------------------------------------------------------------
  // HIERARCHICAL INDUSTRY SELECTION LOGIC
  // -------------------------------------------------------------
  const selectedSubSectors = useMemo(() => {
    return profile.subIndustries || [];
  }, [profile.subIndustries]);

  const customIndustries = useMemo(() => {
    return profile.customIndustry ? [profile.customIndustry] : [];
  }, [profile.customIndustry]);

  // Global selection state across all 16 sectors
  const globalIndustryState = useMemo<TriState>(() => {
    return getGlobalSelectionState(selectedSubSectors);
  }, [selectedSubSectors]);

  // Concise industry summary
  const industrySummary = useMemo(() => {
    return getConciseIndustrySummary(selectedSubSectors, customIndustries);
  }, [selectedSubSectors, customIndustries]);

  // Synchronize profile.industries & profile.subIndustries together
  const updateIndustrySelections = (newSubSectors: string[], newCustomIndustries?: string[]) => {
    const uniqueSubs = Array.from(new Set(newSubSectors));

    // Determine which sectors have selected sub-sectors
    const activeSectors: string[] = [];
    for (const sec of HIERARCHICAL_SECTORS) {
      const hasAny = sec.subSectors.some(s => uniqueSubs.includes(s));
      if (hasAny) {
        activeSectors.push(sec.name);
      }
    }

    const nextCustom = newCustomIndustries !== undefined ? newCustomIndustries : customIndustries;

    setProfile(prev => ({
      ...prev,
      industries: activeSectors,
      subIndustries: uniqueSubs,
      customIndustry: nextCustom[0] || undefined,
      industrySelection: {
        allIndustries: getGlobalSelectionState(uniqueSubs) === 'all',
        sectors: HIERARCHICAL_SECTORS.reduce((acc, sec) => {
          const state = getSectorSelectionState(sec, uniqueSubs);
          acc[sec.id] = {
            all: state === 'all',
            subIndustries: sec.subSectors.filter(s => uniqueSubs.includes(s)),
          };
          return acc;
        }, {} as Record<string, { all: boolean; subIndustries: string[] }>),
      },
    }));
  };

  // Toggle Global "All Industries"
  const handleToggleGlobalAll = () => {
    if (globalIndustryState === 'all') {
      // Clear all
      updateIndustrySelections([]);
    } else {
      // Select all 16 sectors and all subsectors
      const allSubs = getAllTaxonomySubSectors();
      updateIndustrySelections(allSubs);
    }
  };

  // Clear all industries action
  const handleClearAllIndustries = () => {
    updateIndustrySelections([], []);
  };

  // Toggle Sector "All [Sector]"
  const handleToggleSector = (sector: HierarchicalSector) => {
    const currentState = getSectorSelectionState(sector, selectedSubSectors);
    if (currentState === 'all') {
      // Deselect all sub-sectors in this sector
      const nextSubs = selectedSubSectors.filter(s => !sector.subSectors.includes(s));
      updateIndustrySelections(nextSubs);
    } else {
      // Select all sub-sectors in this sector, preserving other sectors
      const combined = [...selectedSubSectors, ...sector.subSectors];
      updateIndustrySelections(combined);
    }
  };

  // Clear specific sector
  const handleClearSector = (sector: HierarchicalSector) => {
    const nextSubs = selectedSubSectors.filter(s => !sector.subSectors.includes(s));
    updateIndustrySelections(nextSubs);
  };

  // Toggle individual sub-sector
  const handleToggleSubSector = (subSector: string) => {
    if (selectedSubSectors.includes(subSector)) {
      updateIndustrySelections(selectedSubSectors.filter(s => s !== subSector));
    } else {
      updateIndustrySelections([...selectedSubSectors, subSector]);
    }
  };

  // Add Custom Industry
  const handleAddCustomIndustry = () => {
    const trimmed = customIndustryInput.trim();
    if (!trimmed) return;
    if (!customIndustries.includes(trimmed)) {
      updateIndustrySelections(selectedSubSectors, [trimmed]);
    }
    setCustomIndustryInput('');
  };

  // Remove Custom Industry
  const handleRemoveCustomIndustry = (customName: string) => {
    updateIndustrySelections(selectedSubSectors, customIndustries.filter(c => c !== customName));
  };

  // Search filtering logic across both sector name and sub-sectors
  const searchResults = useMemo(() => {
    const q = industrySearch.trim().toLowerCase();
    if (!q) return null;

    const results: Array<{
      sector: HierarchicalSector;
      isSectorMatch: boolean;
      matchingSubSectors: string[];
    }> = [];

    for (const sector of HIERARCHICAL_SECTORS) {
      const isSectorMatch = sector.name.toLowerCase().includes(q);
      const matchingSubSectors = sector.subSectors.filter(s => s.toLowerCase().includes(q));

      if (isSectorMatch || matchingSubSectors.length > 0) {
        results.push({
          sector,
          isSectorMatch,
          matchingSubSectors: isSectorMatch ? sector.subSectors : matchingSubSectors,
        });
      }
    }

    return results;
  }, [industrySearch]);

  // -------------------------------------------------------------
  // PRESET MANAGEMENT
  // -------------------------------------------------------------
  const handleLoadPreset = (presetId: string) => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes in your target profile. Do you want to discard them and load this preset?'
      );
      if (!confirmDiscard) return;
    }

    const stdFound = STANDARD_PRESETS.find(p => p.id === presetId);
    if (stdFound) {
      const updated: TargetProfile = {
        ...stdFound,
        regions: profile.regions,
        countries: profile.countries,
        excludedCountries: profile.excludedCountries,
        usPresenceMode: profile.usPresenceMode,
      };
      setProfile(updated);
      setInitialSnapshot(JSON.stringify(updated));
      setSelectedPresetId(stdFound.id || 'custom');
      return;
    }

    const savedFound = savedProfiles.find(p => p.id === presetId);
    if (savedFound) {
      setProfile({ ...savedFound });
      setInitialSnapshot(JSON.stringify(savedFound));
      setSelectedPresetId(savedFound.id || 'custom');
    }
  };

  const handleSaveProfile = () => {
    const name = prompt('Enter a name for this Target Profile:', profile.name || 'Custom Target Profile');
    if (!name) return;

    const newProfile: TargetProfile = {
      ...profile,
      id: `profile_${Date.now()}`,
      name,
    };

    const updated = [...savedProfiles, newProfile];
    setSavedProfiles(updated);
    setSelectedPresetId(newProfile.id!);
    setProfile(newProfile);
    setInitialSnapshot(JSON.stringify(newProfile));

    try {
      const customOnly = updated.filter(p => !BUILTIN_SAVED_PROFILES.some(b => b.id === p.id));
      localStorage.setItem('huntlyst_saved_target_profiles', JSON.stringify(customOnly));
    } catch {}
  };

  const handleDuplicateProfile = () => {
    const copyName = `${profile.name || 'Profile'} (Copy)`;
    const duplicated: TargetProfile = {
      ...profile,
      id: `profile_${Date.now()}`,
      name: copyName,
    };
    const updated = [...savedProfiles, duplicated];
    setSavedProfiles(updated);
    setSelectedPresetId(duplicated.id!);
    setProfile(duplicated);
    setInitialSnapshot(JSON.stringify(duplicated));
  };

  const handleDeleteProfile = () => {
    if (
      BUILTIN_SAVED_PROFILES.some(b => b.id === selectedPresetId) ||
      STANDARD_PRESETS.some(b => b.id === selectedPresetId)
    ) {
      alert('Standard presets and default profiles cannot be deleted.');
      return;
    }
    if (!confirm('Are you sure you want to delete this custom profile?')) return;

    const updated = savedProfiles.filter(p => p.id !== selectedPresetId);
    setSavedProfiles(updated);
    setSelectedPresetId('tvb_eval_default');
    setProfile(DEFAULT_TVB_TARGET_PROFILE);
    setInitialSnapshot(JSON.stringify(DEFAULT_TVB_TARGET_PROFILE));

    try {
      const customOnly = updated.filter(p => !BUILTIN_SAVED_PROFILES.some(b => b.id === p.id));
      localStorage.setItem('huntlyst_saved_target_profiles', JSON.stringify(customOnly));
    } catch {}
  };

  const handleReset = () => {
    if (isDirty) {
      const confirmReset = window.confirm(
        'Are you sure you want to reset all criteria to the TVB Evaluation default profile?'
      );
      if (!confirmReset) return;
    }
    setProfile({ ...DEFAULT_TVB_TARGET_PROFILE });
    setInitialSnapshot(JSON.stringify(DEFAULT_TVB_TARGET_PROFILE));
    setSelectedPresetId('tvb_eval_default');
  };

  // -------------------------------------------------------------
  // VALIDATION LOGIC
  // -------------------------------------------------------------
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (profile.targetCount === 'Custom' && (!profile.customTargetCount || profile.customTargetCount < 1)) {
      errors.push('Custom target count must be at least 1.');
    }
    if (profile.fundingMin > profile.fundingMax) {
      errors.push('Minimum financial range cannot exceed maximum range.');
    }
    if (profile.foundedFrom && profile.foundedTo && profile.foundedFrom > profile.foundedTo) {
      errors.push("Founded 'From' year cannot be later than 'To' year.");
    }
    if (
      profile.employeeCountPreset === 'Custom' &&
      profile.employeeMin &&
      profile.employeeMax &&
      profile.employeeMin > profile.employeeMax
    ) {
      errors.push('Minimum employee count cannot exceed maximum employee count.');
    }
    return errors;
  }, [profile]);

  const isValid = validationErrors.length === 0;

  const handleLaunch = () => {
    if (!isValid) {
      alert(`Please resolve configuration errors before running:\n\n• ${validationErrors.join('\n• ')}`);
      return;
    }
    const finalHuntConfig = targetProfileToHuntConfig(profile);
    onLaunchHunt(finalHuntConfig);
  };

  // Generic array item toggler for other sections
  const toggleArrayItem = <K extends keyof TargetProfile>(key: K, item: string) => {
    setProfile(prev => {
      const current = Array.isArray(prev[key]) ? (prev[key] as unknown as string[]) : [];
      if (item === 'Any' || item === 'Not Required') {
        return { ...prev, [key]: [item] };
      }
      let filtered = current.filter(i => i !== 'Any' && i !== 'Not Required');
      if (filtered.includes(item)) {
        filtered = filtered.filter(i => i !== item);
      } else {
        filtered.push(item);
      }
      return { ...prev, [key]: filtered.length === 0 ? ['Any'] : filtered };
    });
  };

  // Country Toggles
  const toggleCountry = (countryName: string) => {
    setProfile(prev => {
      const exists = prev.countries.includes(countryName);
      const next = exists ? prev.countries.filter(c => c !== countryName) : [...prev.countries, countryName];
      return { ...prev, countries: next };
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20">
      {/* ----------------------------------------------------------- */}
      {/* TOP BANNER & PRESET MANAGEMENT DESK */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 sm:p-7 border-2 border-[#1E1B18] shadow-sketch-sm relative">
        <div className="tape-strip" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#F0EAD8]">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-2xl" aria-hidden="true">🎯</span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                Customize Target Profile
              </h1>

              {selectedPresetId === 'tvb_eval_default' && (
                <span className="badge-tag bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35] text-[10px] font-bold px-2 py-0.5 rounded-md">
                  Assignment default
                </span>
              )}

              {isDirty && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E65100]" />
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              Configure deterministic targeting parameters for multi-source autonomous discovery and qualification.
            </p>
          </div>

          {/* Preset Selector & Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[#766E65]">Preset:</span>
            <select
              value={selectedPresetId}
              onChange={e => handleLoadPreset(e.target.value)}
              aria-label="Target Profile Preset"
              className="bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2 rounded-xl border-2 border-[#1E1B18] shadow-sketch-xs focus:outline-none focus:border-[#FF6B35]"
            >
              <optgroup label="Standard Presets">
                {STANDARD_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Saved Profiles">
                {savedProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </select>

            <button
              type="button"
              onClick={handleDuplicateProfile}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D9D0C1] bg-white hover:bg-[#FAF6EE] text-[#1E1B18] transition-colors"
              title="Duplicate Preset"
            >
              📑 Copy
            </button>

            {!BUILTIN_SAVED_PROFILES.some(b => b.id === selectedPresetId) &&
              !STANDARD_PRESETS.some(b => b.id === selectedPresetId) && (
              <button
                type="button"
                onClick={handleDeleteProfile}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#FFCDD2] bg-white text-[#C62828] hover:bg-[#FFEBEE] transition-colors"
                title="Delete Custom Preset"
              >
                🗑
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-8 h-8 rounded-full border-2 border-[#1E1B18] flex items-center justify-center font-bold text-[#1E1B18] hover:bg-[#FAF6EE] ml-1 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Live Active Target Configuration Banner */}
        <div className="mt-4 p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex items-start gap-2.5">
          <span className="text-sm shrink-0 mt-0.5" aria-hidden="true">📌</span>
          <div className="text-xs font-mono leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-[#FF6B35] mr-2">Target Profile:</span>
            <span className="text-[#1E1B18] font-semibold">{formatTargetSummary(profile)}</span>
          </div>
        </div>

        {/* Validation Warning Notice if any */}
        {!isValid && (
          <div className="mt-3 p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl text-xs font-mono text-[#C62828] space-y-1">
            <div className="font-bold">⚠️ Please fix configuration errors:</div>
            {validationErrors.map((err, i) => (
              <div key={i} className="pl-4">• {err}</div>
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 1. TARGET COUNT & FINANCIAL RANGE */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
          <span className="text-lg" aria-hidden="true">💰</span>
          <h2 className="font-display text-lg font-bold text-[#1E1B18]">Target Count & Financial Range</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Target Count */}
          <div>
            <label htmlFor="tp-target-count" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Target Companies
            </label>
            <select
              id="tp-target-count"
              value={profile.targetCount}
              onChange={e => {
                const val = e.target.value === 'Custom' ? 'Custom' : parseInt(e.target.value, 10);
                setProfile(prev => ({ ...prev, targetCount: val }));
              }}
              className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1] focus:outline-none focus:border-[#FF6B35]"
            >
              {TARGET_COUNT_OPTIONS.map(cnt => (
                <option key={cnt} value={cnt}>
                  {cnt} companies
                </option>
              ))}
              <option value="Custom">Custom...</option>
            </select>

            {profile.targetCount === 'Custom' && (
              <div className="mt-2">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  placeholder="Count (1–5000)"
                  value={profile.customTargetCount || 15}
                  onChange={e => setProfile(prev => ({ ...prev, customTargetCount: parseInt(e.target.value, 10) || 15 }))}
                  className="w-full bg-white text-xs font-bold font-mono px-3 py-1.5 rounded-lg border border-[#D9D0C1]"
                />
              </div>
            )}
          </div>

          {/* Financial Metric */}
          <div>
            <label htmlFor="tp-financial-metric" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Financial Metric
            </label>
            <select
              id="tp-financial-metric"
              value={profile.financialMetric}
              onChange={e => setProfile(prev => ({ ...prev, financialMetric: e.target.value as any }))}
              className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1] focus:outline-none focus:border-[#FF6B35]"
            >
              {FINANCIAL_METRICS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Selector */}
          <div>
            <label htmlFor="tp-currency" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Currency
            </label>
            <select
              id="tp-currency"
              value={profile.fundingCurrency}
              onChange={e => {
                const newCur = e.target.value;
                const newVals = getFinancialValuesForCurrency(newCur);
                setProfile(prev => ({
                  ...prev,
                  fundingCurrency: newCur,
                  fundingMin: newVals[3]?.value || newVals[0].value,
                  fundingMax: newVals[5]?.value || newVals[newVals.length - 1].value,
                }));
              }}
              className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1] focus:outline-none focus:border-[#FF6B35]"
            >
              {CURRENCY_OPTIONS.map(c => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min -> Max Range */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Range (Min → Max)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Minimum funding"
                value={profile.fundingMin}
                onChange={e => setProfile(prev => ({ ...prev, fundingMin: parseInt(e.target.value, 10) }))}
                className="bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-2 py-2 rounded-xl border border-[#D9D0C1]"
              >
                {financialOptions.map(opt => (
                  <option key={`min-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Maximum funding"
                value={profile.fundingMax}
                onChange={e => setProfile(prev => ({ ...prev, fundingMax: parseInt(e.target.value, 10) }))}
                className="bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-2 py-2 rounded-xl border border-[#D9D0C1]"
              >
                {financialOptions.map(opt => (
                  <option key={`max-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 2. INDUSTRY & SUB-INDUSTRY HIERARCHICAL SELECTION */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
        {/* Header & Global Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#F0EAD8] pb-4 gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xl" aria-hidden="true">🏭</span>
            <div>
              <h2 className="font-display text-lg font-bold text-[#1E1B18]">
                Industry & Sub-Industry Selection
              </h2>
              <p className="text-xs text-[#766E65] font-mono">
                Select specific sub-sectors or entire categories. Targets search query formulations and venture scoring.
              </p>
            </div>
          </div>

          {/* Quick Actions & Status Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
                globalIndustryState === 'all'
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]'
                  : selectedSubSectors.length > 0
                  ? 'bg-[#FFE7DC] text-[#FF6B35] border-[#FF6B35]'
                  : 'bg-[#FAF6EE] text-[#766E65] border-[#D9D0C1]'
              }`}
            >
              {globalIndustryState === 'all'
                ? 'All Industries'
                : selectedSubSectors.length > 0
                ? `${profile.industries.length} ${profile.industries.length === 1 ? 'sector' : 'sectors'} · ${selectedSubSectors.length} sub-sectors`
                : 'No industries selected'}
            </span>

            {/* Quick Action: Select All Industries */}
            <button
              type="button"
              onClick={handleToggleGlobalAll}
              className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl border transition-colors ${
                globalIndustryState === 'all'
                  ? 'bg-[#1E1B18] text-white border-[#1E1B18]'
                  : 'bg-[#FAF6EE] text-[#1E1B18] border-[#1E1B18] hover:bg-[#F2ECE0]'
              }`}
            >
              {globalIndustryState === 'all' ? '✓ All Industries Selected' : 'Select All Industries'}
            </button>

            {/* Quick Action: Clear All */}
            {(selectedSubSectors.length > 0 || customIndustries.length > 0) && (
              <button
                type="button"
                onClick={handleClearAllIndustries}
                className="px-3 py-1.5 text-xs font-bold font-mono rounded-xl border border-[#D9D0C1] bg-white text-[#766E65] hover:text-[#C62828] hover:border-[#FFCDD2] transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Concise Active Selection Summary Chips (Section 8 & 9) */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#766E65] flex items-center justify-between">
            <span>Active Selection Summary:</span>
            <span className="text-[10px] font-mono text-[#8C847A] font-normal">
              Click ✕ to remove • Click chip to inspect sector
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap min-h-[38px] p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
            {industrySummary.chips.length === 0 ? (
              <span className="text-xs italic text-[#8C847A] font-mono">
                No sector filters active (Hunting across all sectors)
              </span>
            ) : (
              industrySummary.chips.map(chip => (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono bg-[#1E1B18] text-[#FAF6EE] shadow-sketch-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (chip.sectorId) {
                        setExpandedSectors(prev => ({ ...prev, [chip.sectorId!]: true }));
                      }
                    }}
                    className="hover:text-[#FF6B35] transition-colors text-left"
                    title={chip.sectorId ? `Expand ${chip.label}` : chip.label}
                  >
                    {chip.label}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (chip.type === 'all_industries') {
                        handleClearAllIndustries();
                      } else if (chip.sectorId) {
                        const sec = HIERARCHICAL_SECTORS.find(s => s.id === chip.sectorId);
                        if (sec) handleClearSector(sec);
                      } else if (chip.type === 'custom') {
                        handleRemoveCustomIndustry(chip.label);
                      }
                    }}
                    aria-label={`Remove ${chip.label}`}
                    className="text-[#FF6B35] hover:text-white font-bold ml-1 text-sm leading-none p-0.5"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Search Bar & Custom Industry Input */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <span className="absolute left-3 top-2.5 text-xs text-[#766E65]" aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Search sectors or sub-sectors (e.g. Cybersecurity, Fintech, EV, AI)..."
              value={industrySearch}
              onChange={e => setIndustrySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] focus:bg-white text-[#1E1B18] outline-none focus:border-[#FF6B35] transition-colors"
            />
            {industrySearch && (
              <button
                type="button"
                onClick={() => setIndustrySearch('')}
                className="absolute right-3 top-2 text-xs text-[#766E65] hover:text-[#1E1B18]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Custom Industry Option */}
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Add custom niche..."
              value={customIndustryInput}
              onChange={e => setCustomIndustryInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomIndustry())}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] focus:bg-white text-[#1E1B18] outline-none focus:border-[#FF6B35]"
            />
            <button
              type="button"
              onClick={handleAddCustomIndustry}
              className="px-3 py-2 bg-[#1E1B18] text-white text-xs font-bold rounded-xl hover:bg-[#3E3832] transition-colors"
            >
              + Add
            </button>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* HIERARCHICAL SECTOR CARDS (16 Predefined Sectors) */}
        {/* --------------------------------------------------------- */}
        {searchResults !== null ? (
          /* Search Results View with Parent Hierarchy Context */
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            <div className="text-xs font-mono text-[#766E65] pb-1">
              Found matches in {searchResults.length} {searchResults.length === 1 ? 'sector' : 'sectors'}:
            </div>

            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-[#8C847A] bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                No matching industries or sub-sectors found for "{industrySearch}". You can add it as a custom niche above.
              </div>
            ) : (
              searchResults.map(({ sector, matchingSubSectors, isSectorMatch }) => {
                const sectorState = getSectorSelectionState(sector, selectedSubSectors);
                const selectedCount = sector.subSectors.filter(s => selectedSubSectors.includes(s)).length;

                return (
                  <div key={sector.id} className="border border-[#EBE4D5] rounded-xl bg-white overflow-hidden shadow-sketch-xs">
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#FAF6EE] border-b border-[#EBE4D5]">
                      <div className="flex items-center gap-2.5">
                        <TriStateCheckbox
                          state={sectorState}
                          onChange={() => handleToggleSector(sector)}
                          ariaLabel={`Select all ${sector.name}`}
                        />
                        <span className="text-xs font-bold font-mono text-[#1E1B18]">{sector.name}</span>
                        {isSectorMatch && (
                          <span className="text-[10px] bg-[#FFE7DC] text-[#FF6B35] px-1.5 py-0.5 rounded font-mono font-bold">
                            Sector match
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[#766E65]">
                          {selectedCount}/{sector.subSectors.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleSector(sector)}
                          className="text-[11px] font-mono text-[#FF6B35] font-bold hover:underline"
                        >
                          {sectorState === 'all' ? 'Deselect Sector' : `Select All ${sector.name}`}
                        </button>
                      </div>
                    </div>

                    {/* Matching Sub-sectors */}
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-white">
                      {matchingSubSectors.map(sub => {
                        const isChecked = selectedSubSectors.includes(sub);
                        return (
                          <label
                            key={sub}
                            className={`flex items-center gap-2 text-xs p-2 rounded-lg border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#1E1B18] font-bold shadow-sketch-xs'
                                : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#5A544E] hover:bg-[#F5EEDD]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSubSector(sub)}
                              className="accent-[#FF6B35] rounded w-3.5 h-3.5 cursor-pointer"
                            />
                            <div className="truncate">
                              <span className="text-[10px] text-[#8C847A] block leading-none font-mono">
                                {sector.name} →
                              </span>
                              <span className="truncate">{sub}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Normal Collapsible 16-Sector Hierarchy View */
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {HIERARCHICAL_SECTORS.map(sector => {
              const sectorState = getSectorSelectionState(sector, selectedSubSectors);
              const selectedCount = sector.subSectors.filter(s => selectedSubSectors.includes(s)).length;
              const isExpanded = !!expandedSectors[sector.id];

              return (
                <div
                  key={sector.id}
                  className="border border-[#EBE4D5] rounded-xl bg-white overflow-hidden transition-shadow hover:border-[#D9D0C1]"
                >
                  {/* Sector Header with Tri-state Checkbox and Actions */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#FAF6EE] hover:bg-[#F5EEDD] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <TriStateCheckbox
                        state={sectorState}
                        onChange={() => handleToggleSector(sector)}
                        ariaLabel={`Select all ${sector.name}`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSectors(prev => ({
                            ...prev,
                            [sector.id]: !prev[sector.id],
                          }))
                        }
                        aria-expanded={isExpanded}
                        className="text-left flex items-center gap-2 text-xs font-bold font-mono text-[#1E1B18] focus:outline-none"
                      >
                        <span>{sector.name}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Count badge */}
                      {selectedCount > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            sectorState === 'all'
                              ? 'bg-[#2E7D32] text-white'
                              : 'bg-[#FF6B35] text-white'
                          }`}
                        >
                          {sectorState === 'all' ? 'All selected' : `${selectedCount}/${sector.subSectors.length}`}
                        </span>
                      )}

                      {/* Sector-level Quick Action */}
                      <button
                        type="button"
                        onClick={() => handleToggleSector(sector)}
                        className="text-[11px] font-mono text-[#766E65] hover:text-[#FF6B35] transition-colors hidden sm:inline"
                      >
                        {sectorState === 'all' ? 'Clear' : `All ${sector.name}`}
                      </button>

                      {/* Accordion Toggle Chevron */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSectors(prev => ({
                            ...prev,
                            [sector.id]: !prev[sector.id],
                          }))
                        }
                        aria-label={isExpanded ? `Collapse ${sector.name}` : `Expand ${sector.name}`}
                        className="text-xs text-[#766E65] p-1 hover:text-[#1E1B18]"
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Sub-sectors Grid */}
                  {isExpanded && (
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-white border-t border-[#F0EAD8]">
                      {sector.subSectors.map(sub => {
                        const isChecked = selectedSubSectors.includes(sub);
                        return (
                          <label
                            key={sub}
                            className={`flex items-center gap-2 text-xs p-2 rounded-lg border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#1E1B18] font-bold shadow-sketch-xs'
                                : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#5A544E] hover:bg-[#F5EEDD]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSubSector(sub)}
                              className="accent-[#FF6B35] rounded w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="truncate">{sub}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 3. COMPANY AGE & DATA FRESHNESS */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
          <span className="text-lg" aria-hidden="true">⏱️</span>
          <h2 className="font-display text-lg font-bold text-[#1E1B18]">Company Age, Founded Year & Freshness</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Predefined Age */}
          <div>
            <label htmlFor="tp-company-age" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Company Age
            </label>
            <select
              id="tp-company-age"
              value={profile.companyAge}
              onChange={e => setProfile(prev => ({ ...prev, companyAge: e.target.value }))}
              className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
            >
              {COMPANY_AGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Founded Year Range (From -> To) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Founded Year Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Founded from year"
                value={profile.foundedFrom || 2020}
                onChange={e => setProfile(prev => ({ ...prev, foundedFrom: parseInt(e.target.value, 10) }))}
                className="bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-2 py-2 rounded-xl border border-[#D9D0C1]"
              >
                {years.map(y => (
                  <option key={`from-${y}`} value={y}>
                    From: {y}
                  </option>
                ))}
              </select>

              <select
                aria-label="Founded to year"
                value={profile.foundedTo || new Date().getFullYear()}
                onChange={e => setProfile(prev => ({ ...prev, foundedTo: parseInt(e.target.value, 10) }))}
                className="bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-2 py-2 rounded-xl border border-[#D9D0C1]"
              >
                {years.map(y => (
                  <option key={`to-${y}`} value={y}>
                    To: {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data Freshness */}
          <div>
            <label htmlFor="tp-freshness-window" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Data Freshness Window
            </label>
            <select
              id="tp-freshness-window"
              value={profile.freshnessWindow}
              onChange={e => setProfile(prev => ({ ...prev, freshnessWindow: e.target.value }))}
              className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
            >
              {DATA_FRESHNESS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Activity Types */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#766E65]">
            Target Recent Activity Signals:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {ACTIVITY_TYPES.map(act => {
              const isSelected = profile.activityTypes.includes(act);
              return (
                <button
                  key={act}
                  type="button"
                  onClick={() => toggleArrayItem('activityTypes', act)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-[#1E1B18] text-[#FAF6EE] border-[#1E1B18] shadow-sketch-xs'
                      : 'bg-[#FAF6EE] text-[#5A544E] border-[#EBE4D5] hover:bg-[#F2ECE0]'
                  }`}
                >
                  {isSelected ? '✓ ' : ''}{act}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 4. COMPANY STAGE & COMPANY TYPE */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
          <span className="text-lg" aria-hidden="true">🌱</span>
          <h2 className="font-display text-lg font-bold text-[#1E1B18]">Company Stage & Company Type</h2>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#766E65] block mb-2">
              Company Stages (Multi-select):
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {COMPANY_STAGE_OPTIONS.map(stg => {
                const isChecked = profile.companyStages.includes(stg);
                return (
                  <button
                    key={stg}
                    type="button"
                    onClick={() => toggleArrayItem('companyStages', stg)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-colors ${
                      isChecked
                        ? 'bg-[#FF6B35] text-white border-[#FF6B35] font-bold shadow-sketch-xs'
                        : 'bg-[#FAF6EE] text-[#5A544E] border-[#EBE4D5] hover:bg-[#F2ECE0]'
                    }`}
                  >
                    {isChecked ? '✓ ' : ''}{stg}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#766E65] block mb-2">
              Company Types:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {COMPANY_TYPE_OPTIONS.map(tp => {
                const isChecked = profile.companyTypes.includes(tp);
                return (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => toggleArrayItem('companyTypes', tp)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-colors ${
                      isChecked
                        ? 'bg-[#1E1B18] text-[#FAF6EE] border-[#1E1B18] font-bold shadow-sketch-xs'
                        : 'bg-[#FAF6EE] text-[#5A544E] border-[#EBE4D5] hover:bg-[#F2ECE0]'
                    }`}
                  >
                    {isChecked ? '✓ ' : ''}{tp}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 5. GEOGRAPHY & US PRESENCE POLICY */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
          <span className="text-lg" aria-hidden="true">🌍</span>
          <h2 className="font-display text-lg font-bold text-[#1E1B18]">Geography & Non-US Presence Criteria</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Regions & US Presence Mode */}
          <div className="space-y-4">
            <div>
              <label htmlFor="tp-us-presence" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                US Presence Policy (Non-US Requirement)
              </label>
              <select
                id="tp-us-presence"
                value={profile.usPresenceMode}
                onChange={e => setProfile(prev => ({ ...prev, usPresenceMode: e.target.value as any }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
              >
                {US_PRESENCE_OPTIONS.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label} ({u.badge})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#766E65] block mb-2">
                Target Regions:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {REGION_OPTIONS.map(reg => {
                  const isChecked = profile.regions.includes(reg);
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => toggleArrayItem('regions', reg)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-colors ${
                        isChecked
                          ? 'bg-[#1E1B18] text-[#FAF6EE] border-[#1E1B18] font-bold'
                          : 'bg-[#FAF6EE] text-[#5A544E] border-[#EBE4D5] hover:bg-[#F2ECE0]'
                      }`}
                    >
                      {isChecked ? '✓ ' : ''}{reg}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Target Countries Search & Multi-select */}
          <div className="space-y-3">
            <label htmlFor="tp-country-search" className="block text-xs font-bold uppercase tracking-wider text-[#766E65]">
              Target Specific Countries ({profile.countries.length} Selected)
            </label>

            <input
              id="tp-country-search"
              type="text"
              placeholder="Search countries (e.g. Germany, India, Singapore)..."
              value={countrySearch}
              onChange={e => setCountrySearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-[#1E1B18]"
            />

            {/* Selected Country tags */}
            {profile.countries.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto p-2 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                {profile.countries.map(c => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded bg-white border border-[#D9D0C1]"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => toggleCountry(c)}
                      aria-label={`Remove ${c}`}
                      className="text-[#FF6B35] font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Country Candidates */}
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {filteredCountries.map(c => {
                const isSelected = profile.countries.includes(c.name);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCountry(c.name)}
                    className={`flex items-center justify-between text-left text-xs p-1.5 rounded border transition-colors ${
                      isSelected
                        ? 'bg-[#FFE7DC] border-[#FF6B35] font-bold text-[#1E1B18]'
                        : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#5A544E] hover:bg-white'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-[#8C847A] font-mono">{c.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 6. DECISION MAKERS, EMAIL & VERIFICATION */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
          <span className="text-lg" aria-hidden="true">👤</span>
          <h2 className="font-display text-lg font-bold text-[#1E1B18]">Decision Makers, Email & Social Verification</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Roles */}
          <div className="md:col-span-2 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#766E65] block">
              Target Decision-Maker Roles:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {DECISION_MAKER_OPTIONS.map(role => {
                const isChecked = profile.contactPersonTypes.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleArrayItem('contactPersonTypes', role)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                      isChecked
                        ? 'bg-[#1E1B18] text-[#FAF6EE] border-[#1E1B18] font-bold'
                        : 'bg-[#FAF6EE] text-[#5A544E] border-[#EBE4D5] hover:bg-[#F2ECE0]'
                    }`}
                  >
                    {isChecked ? '✓ ' : ''}{role}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email Requirements */}
          <div className="space-y-4">
            <div>
              <label htmlFor="tp-email-req" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Email Requirement
              </label>
              <select
                id="tp-email-req"
                value={profile.emailRequirement}
                onChange={e => setProfile(prev => ({ ...prev, emailRequirement: e.target.value as any }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2 rounded-xl border border-[#D9D0C1]"
              >
                {EMAIL_REQUIREMENT_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tp-email-verification-level" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Verification Tier
              </label>
              <select
                id="tp-email-verification-level"
                value={profile.emailVerificationLevel}
                onChange={e => setProfile(prev => ({ ...prev, emailVerificationLevel: e.target.value as any }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2 rounded-xl border border-[#D9D0C1]"
              >
                {EMAIL_VERIFICATION_LEVELS.map(lvl => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Social Requirements */}
        <div className="pt-2 border-t border-[#F0EAD8] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#766E65] block mb-1.5">
              Company Social Profiles:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {COMPANY_SOCIAL_OPTIONS.map(s => {
                const isChecked = profile.companySocialRequirements.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleArrayItem('companySocialRequirements', s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                      isChecked
                        ? 'bg-[#1E1B18] border-[#1E1B18] text-white font-bold'
                        : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#766E65] hover:bg-white'
                    }`}
                  >
                    {isChecked ? '✓ ' : ''}{s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#766E65] block mb-1.5">
              Person Social Profiles:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {PERSON_SOCIAL_OPTIONS.map(s => {
                const isChecked = profile.personSocialRequirements.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleArrayItem('personSocialRequirements', s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                      isChecked
                        ? 'bg-[#1E1B18] border-[#1E1B18] text-white font-bold'
                        : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#766E65] hover:bg-white'
                    }`}
                  >
                    {isChecked ? '✓ ' : ''}{s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 7. EMPLOYEES & SOURCES */}
      {/* ----------------------------------------------------------- */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
          <span className="text-lg" aria-hidden="true">🔎</span>
          <h2 className="font-display text-lg font-bold text-[#1E1B18]">Employee Size & Research Sources</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee Count */}
          <div>
            <label htmlFor="tp-employee-count" className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Employee Count
            </label>
            <select
              id="tp-employee-count"
              value={profile.employeeCountPreset}
              onChange={e => setProfile(prev => ({ ...prev, employeeCountPreset: e.target.value }))}
              className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
            >
              {EMPLOYEE_COUNT_OPTIONS.map(cnt => (
                <option key={cnt} value={cnt}>
                  {cnt} employees
                </option>
              ))}
            </select>

            {profile.employeeCountPreset === 'Custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="number"
                  placeholder="Min employees"
                  value={profile.employeeMin || 10}
                  onChange={e => setProfile(prev => ({ ...prev, employeeMin: parseInt(e.target.value, 10) }))}
                  className="bg-white text-xs font-bold font-mono px-3 py-1.5 rounded-lg border border-[#D9D0C1]"
                />
                <input
                  type="number"
                  placeholder="Max employees"
                  value={profile.employeeMax || 500}
                  onChange={e => setProfile(prev => ({ ...prev, employeeMax: parseInt(e.target.value, 10) }))}
                  className="bg-white text-xs font-bold font-mono px-3 py-1.5 rounded-lg border border-[#D9D0C1]"
                />
              </div>
            )}
          </div>

          {/* Sources selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
              Research Sources (Multi-select)
            </label>
            <div className="max-h-36 overflow-y-auto pr-1 space-y-1 bg-[#FAF6EE] p-2 rounded-xl border border-[#EBE4D5]">
              {RESEARCH_SOURCES_OPTIONS.map(src => {
                const isChecked = profile.selectedSources.includes(src);
                return (
                  <label
                    key={src}
                    className="flex items-center gap-2 text-xs p-1 rounded hover:bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleArrayItem('selectedSources', src)}
                      className="accent-[#FF6B35] rounded"
                    />
                    <span className="truncate text-[#5A544E]">{src}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* BOTTOM STICKY ACTION BAR */}
      {/* ----------------------------------------------------------- */}
      <div className="sticky bottom-4 z-20 paper-card bg-[#FFFDF9]/95 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border-2 border-[#1E1B18] shadow-sketch flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-[#766E65] bg-[#FAF6EE] hover:bg-[#EBE4D5] rounded-xl border border-[#D9D0C1] transition-colors"
        >
          ↺ Reset to TVB Default
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleSaveProfile}
            className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18] shadow-sketch-xs transition-transform active:translate-y-0.5"
          >
            💾 Save Profile
          </button>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={isRunning || !isValid}
            className={`flex-1 sm:flex-initial px-7 py-2.5 text-xs font-bold text-white rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm transition-transform active:translate-y-0.5 flex items-center justify-center gap-2 ${
              isRunning || !isValid
                ? 'bg-[#8C847A] cursor-not-allowed opacity-75'
                : 'bg-[#FF6B35] hover:bg-[#F05820]'
            }`}
            title={!isValid ? validationErrors.join(' | ') : 'Launch autonomous hunt'}
          >
            <span>🚀</span>
            <span>{isRunning ? 'Hunting Active...' : 'Run Hunt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
