'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { HuntConfig, TVB_EVALUATION_CONFIG } from '@/lib/types';
import {
  TargetProfile,
  DEFAULT_TVB_TARGET_PROFILE,
  STANDARD_PRESETS,
  BUILTIN_SAVED_PROFILES,
  INDUSTRY_TAXONOMY,
  SUB_INDUSTRY_MAP,
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
import { COUNTRIES, searchCountries, CountryItem } from '@/lib/geography';

interface HuntConfigurationProps {
  initialConfig?: HuntConfig;
  isRunning: boolean;
  onLaunchHunt: (config: HuntConfig) => void;
}

export default function HuntConfiguration({
  initialConfig,
  isRunning,
  onLaunchHunt,
}: HuntConfigurationProps) {
  // Initialize target profile from initialConfig
  const [profile, setProfile] = useState<TargetProfile>(() => {
    if (initialConfig) {
      return huntConfigToTargetProfile(initialConfig);
    }
    return DEFAULT_TVB_TARGET_PROFILE;
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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'TECHNOLOGY & SOFTWARE': true,
    'AGRICULTURE & FOOD': true,
  });

  // Load custom presets from localStorage
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
      setProfile(huntConfigToTargetProfile(initialConfig));
    }
  }, [initialConfig]);

  // Current financial options based on currency
  const financialOptions = useMemo(() => {
    return getFinancialValuesForCurrency(profile.fundingCurrency);
  }, [profile.fundingCurrency]);

  // Dynamically exposed sub-industries for selected industries
  const availableSubIndustries = useMemo(() => {
    const subs = new Set<string>();
    for (const ind of profile.industries) {
      const mapped = SUB_INDUSTRY_MAP[ind] || [];
      for (const m of mapped) subs.add(m);
    }
    return Array.from(subs);
  }, [profile.industries]);

  // Filtered countries
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES.slice(0, 16);
    return searchCountries(countrySearch).slice(0, 16);
  }, [countrySearch]);

  // Filtered industries taxonomy
  const filteredTaxonomy = useMemo(() => {
    if (!industrySearch.trim()) return INDUSTRY_TAXONOMY;
    const q = industrySearch.toLowerCase();
    return INDUSTRY_TAXONOMY.map(cat => ({
      category: cat.category,
      industries: cat.industries.filter(ind => ind.toLowerCase().includes(q)),
    })).filter(cat => cat.industries.length > 0);
  }, [industrySearch]);

  // Handle Preset Loading
  const handleLoadPreset = (presetId: string) => {
    const stdFound = STANDARD_PRESETS.find(p => p.id === presetId);
    if (stdFound) {
      // Configuring standard industry preset while keeping geography independent
      setProfile(prev => ({
        ...stdFound,
        regions: prev.regions,
        countries: prev.countries,
        excludedCountries: prev.excludedCountries,
        usPresenceMode: prev.usPresenceMode,
      }));
      setSelectedPresetId(stdFound.id || 'custom');
      return;
    }

    const savedFound = savedProfiles.find(p => p.id === presetId);
    if (savedFound) {
      setProfile({ ...savedFound });
      setSelectedPresetId(savedFound.id || 'custom');
    }
  };

  // Handle Save Current Profile
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

    try {
      const customOnly = updated.filter(p => !BUILTIN_SAVED_PROFILES.some(b => b.id === p.id));
      localStorage.setItem('huntlyst_saved_target_profiles', JSON.stringify(customOnly));
    } catch {}
  };

  // Handle Duplicate Profile
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
  };

  // Handle Delete Profile
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

    try {
      const customOnly = updated.filter(p => !BUILTIN_SAVED_PROFILES.some(b => b.id === p.id));
      localStorage.setItem('huntlyst_saved_target_profiles', JSON.stringify(customOnly));
    } catch {}
  };

  // Handle Reset to TVB Evaluation Profile
  const handleReset = () => {
    setProfile({ ...DEFAULT_TVB_TARGET_PROFILE });
    setSelectedPresetId('tvb_eval_default');
  };

  // Launch Hunt with complete configuration
  const handleLaunch = () => {
    const finalHuntConfig = targetProfileToHuntConfig(profile);
    onLaunchHunt(finalHuntConfig);
  };

  // Industry Toggles
  const toggleIndustry = (ind: string) => {
    setProfile(prev => {
      const exists = prev.industries.includes(ind);
      const next = exists ? prev.industries.filter(i => i !== ind) : [...prev.industries, ind];
      return { ...prev, industries: next };
    });
  };

  const removeIndustry = (ind: string) => {
    setProfile(prev => ({
      ...prev,
      industries: prev.industries.filter(i => i !== ind),
    }));
  };

  const addCustomIndustry = () => {
    const trimmed = customIndustryInput.trim();
    if (!trimmed) return;
    if (!profile.industries.includes(trimmed)) {
      setProfile(prev => ({
        ...prev,
        industries: [...prev.industries, trimmed],
      }));
    }
    setCustomIndustryInput('');
  };

  // Sub-industry Toggles
  const toggleSubIndustry = (sub: string) => {
    setProfile(prev => {
      const exists = prev.subIndustries.includes(sub);
      const next = exists ? prev.subIndustries.filter(s => s !== sub) : [...prev.subIndustries, sub];
      return { ...prev, subIndustries: next };
    });
  };

  // Multi-select helper for string arrays
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

  const years = useMemo(() => getAvailableYears(), []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Banner & Profile Preset Selector */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 border-2 border-[#1E1B18] shadow-sketch-sm relative">
        <div className="tape-strip" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#F0EAD8]">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-2xl">🎯</span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                Customize Target Profile
              </h1>
              {selectedPresetId === 'tvb_eval_default' && (
                <span className="badge-tag bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35] text-[10px] font-bold px-2 py-0.5 rounded-md ml-1">
                  Assignment default
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              Select predefined targeting controls. Every setting directly instructs autonomous discovery and deterministic qualification.
            </p>
          </div>

          {/* Preset Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[#766E65]">Profile Preset:</span>
            <select
              value={selectedPresetId}
              onChange={e => handleLoadPreset(e.target.value)}
              className="bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2 rounded-xl border-2 border-[#1E1B18] shadow-sketch-xs focus:outline-none focus:border-[#FF6B35]"
            >
              <optgroup label="Standard Presets">
                {STANDARD_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="My Saved Profiles">
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
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D9D0C1] bg-white hover:bg-[#FAF6EE]"
              title="Duplicate Preset"
            >
              📑 Copy
            </button>
            {!BUILTIN_SAVED_PROFILES.some(b => b.id === selectedPresetId) &&
              !STANDARD_PRESETS.some(b => b.id === selectedPresetId) && (
              <button
                type="button"
                onClick={handleDeleteProfile}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#FFCDD2] bg-white text-[#C62828] hover:bg-[#FFEBEE]"
                title="Delete Custom Preset"
              >
                🗑
              </button>
            )}
          </div>
        </div>

        {/* Live Active Target Configuration Banner (Section 22) */}
        <div className="mt-4 p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex items-start gap-2.5">
          <span className="text-sm shrink-0 mt-0.5">📌</span>
          <div className="text-xs font-mono leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-[#FF6B35] mr-2">Target Profile:</span>
            <span className="text-[#1E1B18] font-semibold">{formatTargetSummary(profile)}</span>
          </div>
        </div>
      </div>

      {/* CENTRALIZED TARGET CUSTOMIZATION DESK (Section 17) */}
      <div className="space-y-6">

        {/* 1. TARGET COUNT & FINANCIAL RANGE */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
            <span className="text-lg">💰</span>
            <h2 className="font-display text-lg font-bold text-[#1E1B18]">Target Count & Financial Range</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Target Count */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Target Companies
              </label>
              <select
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
                    placeholder="Enter custom count"
                    value={profile.customTargetCount || 15}
                    onChange={e => setProfile(prev => ({ ...prev, customTargetCount: parseInt(e.target.value, 10) || 15 }))}
                    className="w-full bg-white text-xs font-bold font-mono px-3 py-1.5 rounded-lg border border-[#D9D0C1]"
                  />
                </div>
              )}
            </div>

            {/* Financial Metric */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Financial Metric
              </label>
              <select
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Currency
              </label>
              <select
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

            {/* Minimum & Maximum Selectors */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Range (Min → Max)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
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

        {/* 2. INDUSTRY / SECTOR (Section 3, 4, 5) */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏭</span>
              <h2 className="font-display text-lg font-bold text-[#1E1B18]">Industry & Sub-Industry Selection</h2>
              <span className="badge-tag bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32] text-[10px] font-bold px-2 py-0.5 rounded-md ml-1">
                Multi-Sector Ready
              </span>
            </div>

            <div className="text-xs font-mono text-[#766E65]">
              {profile.industries.length === 0 ? 'All Industries' : `${profile.industries.length} Selected`}
            </div>
          </div>

          {/* Selected Industries Chips */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#766E65]">
              Active Industry Filters:
            </div>
            <div className="flex items-center gap-1.5 flex-wrap min-h-[32px] p-2 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
              {profile.industries.length === 0 ? (
                <span className="text-xs italic text-[#8C847A] font-mono">
                  None selected (Hunting all sectors)
                </span>
              ) : (
                profile.industries.map(ind => (
                  <span
                    key={ind}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-[#1E1B18] text-[#FAF6EE]"
                  >
                    <span>{ind}</span>
                    <button
                      type="button"
                      onClick={() => removeIndustry(ind)}
                      className="text-[#FF6B35] hover:text-white font-bold ml-1 text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Search Bar + Custom Industry Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 relative">
              <span className="absolute left-3 top-2.5 text-xs text-[#766E65]">🔍</span>
              <input
                type="text"
                placeholder="Type to search predefined industries (e.g. Agriculture, Dairy, EV, Pharma)..."
                value={industrySearch}
                onChange={e => setIndustrySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] focus:bg-white text-[#1E1B18] outline-none"
              />
            </div>

            {/* Custom Industry Option */}
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Custom Industry..."
                value={customIndustryInput}
                onChange={e => setCustomIndustryInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomIndustry())}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] focus:bg-white text-[#1E1B18] outline-none"
              />
              <button
                type="button"
                onClick={addCustomIndustry}
                className="px-3 py-2 bg-[#1E1B18] text-white text-xs font-bold rounded-xl hover:bg-[#3E3832]"
              >
                + Add
              </button>
            </div>
          </div>

          {/* 16 Predefined Industry Categories Accordion / Grid */}
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {filteredTaxonomy.map(cat => {
              const isExpanded = expandedCategories[cat.category] || !!industrySearch.trim();
              const categorySelectedCount = cat.industries.filter(i => profile.industries.includes(i)).length;

              return (
                <div key={cat.category} className="border border-[#EBE4D5] rounded-xl bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategories(prev => ({
                        ...prev,
                        [cat.category]: !prev[cat.category],
                      }))
                    }
                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#FAF6EE] hover:bg-[#F5EEDD] text-left text-xs font-bold text-[#1E1B18] transition-colors"
                  >
                    <span className="font-mono">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      {categorySelectedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6B35] text-white">
                          {categorySelectedCount}
                        </span>
                      )}
                      <span className="text-xs text-[#766E65]">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {cat.industries.map(ind => {
                        const isChecked = profile.industries.includes(ind);
                        return (
                          <label
                            key={ind}
                            className={`flex items-center gap-2 text-xs p-1.5 rounded-lg border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#1E1B18] font-bold'
                                : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#5A544E] hover:bg-[#F5EEDD]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleIndustry(ind)}
                              className="accent-[#FF6B35] rounded"
                            />
                            <span className="truncate">{ind}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DYNAMICALLY EXPOSED SUB-INDUSTRIES (Section 5) */}
          {availableSubIndustries.length > 0 && (
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                  🌿 Dynamically Exposed Sub-Industries:
                </span>
                <span className="text-[10px] font-mono text-[#766E65]">
                  {profile.subIndustries.length} Sub-sectors active
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableSubIndustries.map(sub => {
                  const isChecked = profile.subIndustries.includes(sub);
                  return (
                    <label
                      key={sub}
                      className={`flex items-center gap-2 text-xs p-1.5 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-white border-[#1E1B18] text-[#1E1B18] font-bold shadow-sketch-xs'
                          : 'bg-[#F2ECE0] border-transparent text-[#766E65] hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSubIndustry(sub)}
                        className="accent-[#FF6B35] rounded"
                      />
                      <span className="truncate">{sub}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. COMPANY AGE & DATA FRESHNESS (Section 6 & 7) */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
            <span className="text-lg">⏱️</span>
            <h2 className="font-display text-lg font-bold text-[#1E1B18]">Company Age, Founded Year & Freshness</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Predefined Age */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Company Age
              </label>
              <select
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Data Freshness Window
              </label>
              <select
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

          {/* Activity Types (Selectable Options) */}
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                      isSelected
                        ? 'bg-[#1E1B18] text-white border-[#1E1B18] shadow-sketch-xs'
                        : 'bg-[#FAF6EE] text-[#5A544E] border-[#EBE4D5] hover:bg-white'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {act}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. COMPANY STAGE & COMPANY TYPE (Section 8 & 9) */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
            <span className="text-lg">📊</span>
            <h2 className="font-display text-lg font-bold text-[#1E1B18]">Company Stage & Organization Type</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stages */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65]">
                Company Stage (Multi-select)
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COMPANY_STAGE_OPTIONS.map(stg => {
                  const isChecked = profile.companyStages.includes(stg);
                  return (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => toggleArrayItem('companyStages', stg)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors ${
                        isChecked
                          ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#FF6B35]'
                          : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#766E65] hover:bg-white'
                      }`}
                    >
                      {isChecked ? '✓ ' : ''}{stg}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Types */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65]">
                Company Type (Multi-select)
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COMPANY_TYPE_OPTIONS.map(typ => {
                  const isChecked = profile.companyTypes.includes(typ);
                  return (
                    <button
                      key={typ}
                      type="button"
                      onClick={() => toggleArrayItem('companyTypes', typ)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors ${
                        isChecked
                          ? 'bg-[#1E1B18] border-[#1E1B18] text-[#FAF6EE]'
                          : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#766E65] hover:bg-white'
                      }`}
                    >
                      {isChecked ? '✓ ' : ''}{typ}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 5. GEOGRAPHY & US PRESENCE (Section 10 & 11) */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
            <span className="text-lg">🌍</span>
            <h2 className="font-display text-lg font-bold text-[#1E1B18]">Geography & US Presence Policy</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Region */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Target Region
              </label>
              <select
                value={profile.regions[0] || 'Global'}
                onChange={e => setProfile(prev => ({ ...prev, regions: [e.target.value] }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
              >
                {REGION_OPTIONS.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* US Presence */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                US Presence Rule
              </label>
              <select
                value={profile.usPresenceMode}
                onChange={e => setProfile(prev => ({ ...prev, usPresenceMode: e.target.value as any }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
              >
                {US_PRESENCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#8C847A] font-mono mt-1 block">
                {profile.usPresenceMode === 'unknown'
                  ? '⚠️ Unknown requires confirmed evidence; unverified will NOT pass.'
                  : 'Deterministically evaluated against evidence and headquarters.'}
              </span>
            </div>
          </div>

          {/* Searchable Multi-Select Countries */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65]">
              Target Countries (Searchable Multi-Select)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-[#766E65]">🔍</span>
              <input
                type="text"
                placeholder="Search countries (e.g. India, Germany, United Kingdom, Singapore)..."
                value={countrySearch}
                onChange={e => setCountrySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] focus:bg-white text-[#1E1B18] outline-none"
              />
            </div>

            {/* Selected Country Chips */}
            {profile.countries.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap p-2 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                {profile.countries.map(c => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-[#1E1B18] text-[#FAF6EE]"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => toggleCountry(c)}
                      className="text-[#FF6B35] hover:text-white font-bold ml-1 text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Country Choices */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 pt-1">
              {filteredCountries.map(c => {
                const isSelected = profile.countries.includes(c.name);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCountry(c.name)}
                    className={`p-1.5 rounded-lg text-xs font-mono truncate border text-left flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#1E1B18] font-bold'
                        : 'bg-white border-[#EBE4D5] text-[#5A544E] hover:bg-[#FAF6EE]'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 6. PEOPLE, EMAIL & SOCIAL (Section 12, 13, 14) */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
            <span className="text-lg">👥</span>
            <h2 className="font-display text-lg font-bold text-[#1E1B18]">Decision Makers, Email & Social Verification</h2>
          </div>

          {/* Decision Maker Roles */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65]">
              Decision Maker Roles (Multi-select)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {DECISION_MAKER_OPTIONS.map(role => {
                const isChecked = profile.contactPersonTypes.includes(role);
                return (
                  <label
                    key={role}
                    className={`flex items-center gap-2 text-xs p-2 rounded-lg border cursor-pointer ${
                      isChecked
                        ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#1E1B18] font-bold'
                        : 'bg-[#FAF6EE] border-[#EBE4D5] text-[#5A544E] hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleArrayItem('contactPersonTypes', role)}
                      className="accent-[#FF6B35] rounded"
                    />
                    <span className="truncate">{role}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* Professional Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Professional Email
              </label>
              <select
                value={profile.emailRequirement}
                onChange={e => setProfile(prev => ({ ...prev, emailRequirement: e.target.value as any }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
              >
                {EMAIL_REQUIREMENT_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Email Verification Level */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Verification Tier
              </label>
              <select
                value={profile.emailVerificationLevel}
                onChange={e => setProfile(prev => ({ ...prev, emailVerificationLevel: e.target.value as any }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
              >
                {EMAIL_VERIFICATION_LEVELS.map(lvl => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Social Requirement Mode */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Social Profile Requirement
              </label>
              <select
                value={profile.socialProfileMode}
                onChange={e => setProfile(prev => ({ ...prev, socialProfileMode: e.target.value as any }))}
                className="w-full bg-[#FAF6EE] text-xs font-bold font-mono text-[#1E1B18] px-3 py-2.5 rounded-xl border border-[#D9D0C1]"
              >
                <option value="Required">Required</option>
                <option value="Preferred">Preferred</option>
                <option value="Not Required">Not Required</option>
              </select>
            </div>
          </div>

          {/* Social Platforms checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${
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

        {/* 7. EMPLOYEES & SOURCES (Section 15 & 16) */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-3">
            <span className="text-lg">🔎</span>
            <h2 className="font-display text-lg font-bold text-[#1E1B18]">Employee Size & Research Sources</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee Count */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#766E65] mb-1.5">
                Employee Count
              </label>
              <select
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

        {/* BOTTOM ACTION BAR (Section 17) */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch flex flex-col sm:flex-row items-center justify-between gap-4">
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
              disabled={isRunning}
              className="flex-1 sm:flex-initial px-7 py-2.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] disabled:bg-[#8C847A] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm transition-transform active:translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>{isRunning ? 'Hunting Active...' : 'Run Hunt'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
