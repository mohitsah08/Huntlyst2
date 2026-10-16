'use client';

import React, { useState, useEffect } from 'react';
import {
  InternalWorkflowSettings,
  loadInternalSettings,
  saveInternalSettings,
  resetInternalSettings,
  DEFAULT_INTERNAL_SETTINGS,
} from '@/lib/internalSettings';

interface InternalWorkflowSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: InternalWorkflowSettings) => void;
}

type TabType =
  | 'target'
  | 'search'
  | 'verification'
  | 'mapping'
  | 'weights'
  | 'export'
  | 'advanced';

export default function InternalWorkflowSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: InternalWorkflowSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('target');
  const [settings, setSettings] = useState<InternalWorkflowSettings>(DEFAULT_INTERNAL_SETTINGS);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(loadInternalSettings());
      setIsSavedFeedback(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveInternalSettings(settings);
    setIsSavedFeedback(true);
    if (onSaved) onSaved(settings);
    setTimeout(() => {
      setIsSavedFeedback(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    const defaults = resetInternalSettings();
    setSettings(defaults);
  };

  const removeIndustry = (ind: string) => {
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        industries: prev.targetProfile.industries.filter(i => i !== ind),
      },
    }));
  };

  const addIndustry = (val: string) => {
    if (!val.trim()) return;
    if (settings.targetProfile.industries.includes(val.trim())) return;
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        industries: [...prev.targetProfile.industries, val.trim()],
      },
    }));
  };

  const removeSubIndustry = (value: string) => {
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        subIndustries: (prev.targetProfile.subIndustries || []).filter(item => item !== value),
      },
    }));
  };

  const addSubIndustry = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned || (settings.targetProfile.subIndustries || []).includes(cleaned)) return;
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        subIndustries: [...(prev.targetProfile.subIndustries || []), cleaned],
      },
    }));
  };

  const removeGeography = (value: string) => {
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        geographies: (prev.targetProfile.geographies || []).filter(item => item !== value),
      },
    }));
  };

  const addGeography = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned || (settings.targetProfile.geographies || []).includes(cleaned)) return;
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        geographies: [...(prev.targetProfile.geographies || []), cleaned],
      },
    }));
  };

  const removeStage = (st: string) => {
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        stages: prev.targetProfile.stages.filter(s => s !== st),
      },
    }));
  };

  const addStage = (val: string) => {
    if (!val.trim()) return;
    if (settings.targetProfile.stages.includes(val.trim())) return;
    setSettings(prev => ({
      ...prev,
      targetProfile: {
        ...prev.targetProfile,
        stages: [...prev.targetProfile.stages, val.trim()],
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="paper-card bg-[#FFFDF9] rounded-2xl border-2 border-[#1E1B18] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E0D5] flex items-center justify-between bg-[#FAF6EE]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#1E1B18] shadow-sketch-xs flex items-center justify-center text-lg">
              ⚙️
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#1E1B18] leading-tight">
                Internal Workflow Settings
              </h2>
              <p className="text-xs text-[#766E65] font-mono mt-0.5">
                Configure how the discovery, verification and target matching works for Internal workflow.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[#DCD6C9] hover:bg-white flex items-center justify-center text-[#766E65] hover:text-[#1E1B18] text-base transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body with Left Sidebar Tabs */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[460px]">
          {/* Vertical Tabs Sidebar */}
          <div className="w-full md:w-56 p-3 bg-[#FAF6EE] border-b md:border-b-0 md:border-r border-[#E5E0D5] flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
            {[
              { id: 'target', label: 'Target Profile', icon: '🎯' },
              { id: 'search', label: 'Search & Sources', icon: '🔍' },
              { id: 'verification', label: 'Verification Rules', icon: '✔️' },
              { id: 'mapping', label: 'Field Mapping', icon: '📋' },
              { id: 'weights', label: 'Scoring Weights', icon: '⚖️' },
              { id: 'export', label: 'Export & Output', icon: '📦' },
              { id: 'advanced', label: 'Advanced', icon: '⚙️' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all shrink-0 md:shrink ${
                  activeTab === tab.id
                    ? 'bg-white text-[#FF6B35] border-2 border-[#1E1B18] shadow-sketch-xs'
                    : 'text-[#5A544E] hover:text-[#1E1B18] hover:bg-white/60'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#FFFDF9] space-y-5">
            {/* TAB 1: Target Profile */}
            {activeTab === 'target' && (
              <div className="space-y-4">
                {/* Internal Profile Card */}
                <div className="p-5 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-4 relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      <div>
                        <h3 className="font-display font-bold text-sm text-[#1E1B18]">
                          Target Profile (Internal)
                        </h3>
                        <p className="text-[11px] font-mono text-[#766E65]">
                          Set your target criteria for company discovery and matching.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Funding Range */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-[#1E1B18] block">
                      Funding Range (USD)
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        value={settings.targetProfile.fundingMin}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            targetProfile: {
                              ...prev.targetProfile,
                              fundingMin: Number(e.target.value),
                            },
                          }))
                        }
                        className="px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                      >
                        <option value={100_000}>100K</option>
                        <option value={500_000}>500K</option>
                        <option value={1_000_000}>1.0M</option>
                        <option value={2_000_000}>2.0M</option>
                        <option value={5_000_000}>5.0M</option>
                        <option value={10_000_000}>10.0M</option>
                      </select>
                      <span className="text-xs font-bold text-[#766E65]">to</span>
                      <select
                        value={settings.targetProfile.fundingMax}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            targetProfile: {
                              ...prev.targetProfile,
                              fundingMax: Number(e.target.value),
                            },
                          }))
                        }
                        className="px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                      >
                        <option value={1_000_000}>1.0M</option>
                        <option value={2_000_000}>2.0M</option>
                        <option value={5_000_000}>5.0M</option>
                        <option value={10_000_000}>10.0M</option>
                        <option value={50_000_000}>50.0M</option>
                        <option value={100_000_000}>100.0M</option>
                      </select>
                    </div>
                  </div>


                  {/* Funding basis: configured range applies to the selected funding measure. */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Funding Range Applies To</label>
                    <select
                      value={settings.targetProfile.fundingBasis || 'total'}
                      onChange={e => setSettings(prev => ({ ...prev, targetProfile: { ...prev.targetProfile, fundingBasis: e.target.value as 'total' | 'latestRound' } }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono"
                    >
                      <option value="total">Total funding raised</option>
                      <option value="latestRound">Latest funding round</option>
                    </select>
                  </div>

                  {/* Annual Revenue */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Annual Revenue Range (USD, optional)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" min="0" value={settings.targetProfile.revenueMin ?? ''} placeholder="Minimum"
                        onChange={e => setSettings(prev => ({ ...prev, targetProfile: { ...prev.targetProfile, revenueMin: e.target.value === '' ? null : Number(e.target.value) } }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono" />
                      <input type="number" min="0" value={settings.targetProfile.revenueMax ?? ''} placeholder="Maximum"
                        onChange={e => setSettings(prev => ({ ...prev, targetProfile: { ...prev.targetProfile, revenueMax: e.target.value === '' ? null : Number(e.target.value) } }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono" />
                    </div>
                    <p className="text-[10px] text-[#766E65] font-mono">Leave both fields blank to skip revenue matching.</p>
                  </div>

                  {/* Sub-industry */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Sub-industry</label>
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-[#DCD6C9] bg-[#FAF6EE] min-h-[38px]">
                      {(settings.targetProfile.subIndustries || []).map(ind => (
                        <span key={ind} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white text-[#1E1B18] border border-[#1E1B18]">
                          <span>{ind}</span>
                          <button type="button" onClick={() => removeSubIndustry(ind)} className="text-[#766E65] hover:text-[#C62828] text-xs font-bold">✕</button>
                        </span>
                      ))}
                      <input type="text" placeholder="+ Add sub-industry..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubIndustry((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
                        className="bg-transparent text-xs font-mono outline-none px-1 flex-1 min-w-[120px]" />
                    </div>
                  </div>

                  {/* Geography */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Target Geography</label>
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-[#DCD6C9] bg-[#FAF6EE] min-h-[38px]">
                      {(settings.targetProfile.geographies || []).map(place => (
                        <span key={place} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white text-[#1E1B18] border border-[#1E1B18]">
                          <span>{place}</span>
                          <button type="button" onClick={() => removeGeography(place)} className="text-[#766E65] hover:text-[#C62828] text-xs font-bold">✕</button>
                        </span>
                      ))}
                      <input type="text" placeholder="+ Add country, group, or continent..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGeography((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
                        className="bg-transparent text-xs font-mono outline-none px-1 flex-1 min-w-[150px]" />
                    </div>
                    <p className="text-[10px] text-[#766E65] font-mono">No geography filter is applied while this list is empty.</p>
                  </div>

                  {/* Company age */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Company Age (years, optional)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" min="0" value={settings.targetProfile.minCompanyAge ?? ''} placeholder="Minimum years"
                        onChange={e => setSettings(prev => ({ ...prev, targetProfile: { ...prev.targetProfile, minCompanyAge: e.target.value === '' ? null : Number(e.target.value) } }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono" />
                      <input type="number" min="0" value={settings.targetProfile.maxCompanyAge ?? ''} placeholder="Maximum years"
                        onChange={e => setSettings(prev => ({ ...prev, targetProfile: { ...prev.targetProfile, maxCompanyAge: e.target.value === '' ? null : Number(e.target.value) } }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono" />
                    </div>
                  </div>

                  {/* Website Requirement */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Company Website</label>
                    <select value={settings.targetProfile.websiteRequirement || 'Optional'}
                      onChange={e => setSettings(prev => ({ ...prev, targetProfile: { ...prev.targetProfile, websiteRequirement: e.target.value as 'Required' | 'Optional' | 'Not Required' } }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono">
                      <option value="Required">Required</option>
                      <option value="Optional">Optional</option>
                      <option value="Not Required">Not required</option>
                    </select>
                  </div>

                  {/* Required information */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#1E1B18] block">Required Fields</label>
                    <p className="text-[10px] text-[#766E65] font-mono">Company name and domain are always required. Executive, email, and active-status requirements use their dedicated settings.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { key: 'companyName', label: 'Company name', locked: true },
                        { key: 'domain', label: 'Company domain', locked: true },
                        { key: 'industry', label: 'Industry' },
                        { key: 'geography', label: 'Geography' },
                        { key: 'revenue', label: 'Annual revenue' },
                        { key: 'funding', label: 'Funding amount' },
                        { key: 'stage', label: 'Company stage' },
                        { key: 'companyAge', label: 'Founding year / company age' },
                        { key: 'website', label: 'Company website' },
                      ].map(field => {
                        const checked = field.locked || (settings.targetProfile.requiredFields || []).includes(field.key);
                        return (
                          <label key={field.key} className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E0D5] bg-[#FAF6EE] text-[11px] font-mono">
                            <input type="checkbox" checked={checked} disabled={field.locked}
                              onChange={e => setSettings(prev => {
                                const current = prev.targetProfile.requiredFields || [];
                                const next = e.target.checked ? Array.from(new Set([...current, field.key])) : current.filter(value => value !== field.key);
                                return { ...prev, targetProfile: { ...prev.targetProfile, requiredFields: next } };
                              })}
                              className="accent-[#FF6B35]" />
                            <span>{field.label}{field.locked ? ' (always required)' : ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mandatory vs optional matching criteria */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#1E1B18] block">Mandatory Matching Rules</label>
                    <p className="text-[10px] text-[#766E65] font-mono">A definite mismatch rejects only when that criterion is marked mandatory. Missing required values become UNVERIFIED; ambiguity becomes REVIEW.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { key: 'industry', label: 'Industry match' },
                        { key: 'geography', label: 'Geography match' },
                        { key: 'revenue', label: 'Revenue range' },
                        { key: 'funding', label: 'Funding range' },
                        { key: 'stage', label: 'Company stage' },
                        { key: 'companyAge', label: 'Company age' },
                        { key: 'website', label: 'Website requirement' },
                      ].map(field => (
                        <label key={field.key} className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E0D5] bg-white text-[11px] font-mono">
                          <input type="checkbox" checked={(settings.targetProfile.mandatoryCriteria || []).includes(field.key)}
                            onChange={e => setSettings(prev => {
                              const current = prev.targetProfile.mandatoryCriteria || [];
                              const next = e.target.checked ? Array.from(new Set([...current, field.key])) : current.filter(value => value !== field.key);
                              return { ...prev, targetProfile: { ...prev.targetProfile, mandatoryCriteria: next } };
                            })}
                            className="accent-[#FF6B35]" />
                          <span>{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Industry / Sector Tags */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">
                      Industry / Sector
                    </label>
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-[#DCD6C9] bg-[#FAF6EE] min-h-[38px]">
                      {settings.targetProfile.industries.map(ind => (
                        <span
                          key={ind}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white text-[#1E1B18] border border-[#1E1B18] shadow-sketch-xs"
                        >
                          <span>{ind}</span>
                          <button
                            type="button"
                            onClick={() => removeIndustry(ind)}
                            className="text-[#766E65] hover:text-[#C62828] text-xs font-bold"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="+ Add industry..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addIndustry((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="bg-transparent text-xs font-mono outline-none px-1 flex-1 min-w-[90px]"
                      />
                    </div>
                  </div>

                  {/* Stage Tags */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">
                      Stage
                    </label>
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-[#DCD6C9] bg-[#FAF6EE] min-h-[38px]">
                      {settings.targetProfile.stages.map(st => (
                        <span
                          key={st}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#E0F7FA] text-[#00838F] border border-[#00838F]/40 shadow-sketch-xs"
                        >
                          <span>{st}</span>
                          <button
                            type="button"
                            onClick={() => removeStage(st)}
                            className="text-[#00838F] hover:text-[#C62828] text-xs font-bold"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="+ Add stage..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addStage((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="bg-transparent text-xs font-mono outline-none px-1 flex-1 min-w-[90px]"
                      />
                    </div>
                  </div>

                  {/* Executive Required */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">
                      Executive Required
                    </label>
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-[#1E1B18] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.targetProfile.executiveRequired.ceo}
                          onChange={e =>
                            setSettings(prev => ({
                              ...prev,
                              targetProfile: {
                                ...prev.targetProfile,
                                executiveRequired: {
                                  ...prev.targetProfile.executiveRequired,
                                  ceo: e.target.checked,
                                },
                              },
                            }))
                          }
                          className="rounded border-[#1E1B18] text-[#FF6B35] focus:ring-[#FF6B35]"
                        />
                        <span>CEO</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs font-bold text-[#1E1B18] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.targetProfile.executiveRequired.cofounder}
                          onChange={e =>
                            setSettings(prev => ({
                              ...prev,
                              targetProfile: {
                                ...prev.targetProfile,
                                executiveRequired: {
                                  ...prev.targetProfile.executiveRequired,
                                  cofounder: e.target.checked,
                                },
                              },
                            }))
                          }
                          className="rounded border-[#1E1B18] text-[#FF6B35] focus:ring-[#FF6B35]"
                        />
                        <span>Co-founder</span>
                      </label>

                      <select
                        value={settings.targetProfile.executiveRequired.role}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            targetProfile: {
                              ...prev.targetProfile,
                              executiveRequired: {
                                ...prev.targetProfile.executiveRequired,
                                role: e.target.value,
                              },
                            },
                          }))
                        }
                        className="px-2.5 py-1 rounded-md border border-[#DCD6C9] bg-white text-xs font-mono font-bold"
                      >
                        <option value="Founder">Founder</option>
                        <option value="Executive">Executive</option>
                        <option value="Managing Director">Managing Director</option>
                      </select>
                    </div>
                  </div>

                  {/* Email Requirement & Freshness Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1E1B18] block">
                        Email Requirement
                      </label>
                      <select
                        value={settings.targetProfile.emailRequirement}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            targetProfile: {
                              ...prev.targetProfile,
                              emailRequirement: e.target.value as any,
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold"
                      >
                        <option value="Required">Required</option>
                        <option value="Optional">Optional</option>
                        <option value="Not Required">Not Required</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#1E1B18] block">
                        Freshness (Last)
                      </label>
                      <select
                        value={settings.targetProfile.freshness}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            targetProfile: {
                              ...prev.targetProfile,
                              freshness: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold"
                      >
                        <option value="7 days">7 days</option>
                        <option value="14 days">14 days</option>
                        <option value="30 days">30 days</option>
                        <option value="60 days">60 days</option>
                        <option value="90 days">90 days</option>
                        <option value="Any">Any time</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Search & Sources */}
            {activeTab === 'search' && (
              <div className="p-5 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                  <span>🔍</span> Candidate Search & Source Providers
                </h3>
                <p className="text-xs font-mono text-[#766E65]">
                  Select the active providers used for candidate discovery and live web enrichment.
                </p>
                <div className="space-y-2.5 pt-2">
                  {[
                    { key: 'localFile', label: 'Local Candidate File (CSV / XLSX / MD)', desc: 'Primary in-browser input parsed with 0 external API calls.' },
                    { key: 'curatedDirectory', label: 'Curated Venture Tech Directory', desc: 'Pre-verified directory of tech platform companies.' },
                    { key: 'webSearch', label: 'Open Web Search (Firecrawl / DuckDuckGo)', desc: 'Autonomous discovery of company platforms and executives.' },
                    { key: 'fundingWires', label: 'RSS Venture Funding Dispatches', desc: 'Real-time funding announcements and press wires.' },
                  ].map(source => (
                    <label
                      key={source.key}
                      className="flex items-start gap-3 p-3 rounded-xl border border-[#E5E0D5] bg-[#FAF6EE] cursor-pointer hover:bg-white transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={(settings.searchSources as any)[source.key]}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            searchSources: {
                              ...prev.searchSources,
                              [source.key]: e.target.checked,
                            },
                          }))
                        }
                        className="mt-0.5 rounded border-[#1E1B18] text-[#FF6B35] focus:ring-[#FF6B35]"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#1E1B18]">{source.label}</div>
                        <div className="text-[11px] text-[#766E65] font-mono mt-0.5">{source.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Verification Rules */}
            {activeTab === 'verification' && (
              <div className="p-5 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                  <span>✔️</span> Deterministic Verification Rules
                </h3>
                <p className="text-xs font-mono text-[#766E65]">
                  Enforce strict qualification gates and real-time deliverability checks.
                </p>
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E5E0D5] bg-[#FAF6EE] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.verificationRules.requireDnsMx}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          verificationRules: { ...prev.verificationRules, requireDnsMx: e.target.checked },
                        }))
                      }
                      className="mt-0.5 rounded border-[#1E1B18] text-[#FF6B35]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#1E1B18]">Strict DNS MX Mail Server Verification</div>
                      <div className="text-[11px] text-[#766E65] font-mono mt-0.5">Physical lookup of valid MX DNS records before confirming email status.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E5E0D5] bg-[#FAF6EE] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.verificationRules.allowAcceptAll}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          verificationRules: { ...prev.verificationRules, allowAcceptAll: e.target.checked },
                        }))
                      }
                      className="mt-0.5 rounded border-[#1E1B18] text-[#FF6B35]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#1E1B18]">Allow Accept-All / Catch-All Servers with Warning</div>
                      <div className="text-[11px] text-[#766E65] font-mono mt-0.5">Tag catch-all mail servers as REVIEW rather than instant failure.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E5E0D5] bg-[#FAF6EE] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.verificationRules.strictNonUs}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          verificationRules: { ...prev.verificationRules, strictNonUs: e.target.checked },
                        }))
                      }
                      className="mt-0.5 rounded border-[#1E1B18] text-[#FF6B35]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#1E1B18]">Enforce Strict Non-US Headquarters</div>
                      <div className="text-[11px] text-[#766E65] font-mono mt-0.5">Filter out entities with headquarters located within the United States.</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 4: Field Mapping */}
            {activeTab === 'mapping' && (
              <div className="p-5 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                  <span>📋</span> Canonical Field Mapping
                </h3>
                <p className="text-xs font-mono text-[#766E65]">
                  Map source file headers to canonical Huntlyst schema keys.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {Object.entries(settings.fieldMapping).map(([k, v]) => (
                    <div key={k} className="p-2.5 rounded-lg border border-[#E5E0D5] bg-[#FAF6EE] space-y-1">
                      <span className="text-[11px] font-mono font-bold text-[#766E65] uppercase">{k}</span>
                      <input
                        type="text"
                        value={v}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            fieldMapping: { ...prev.fieldMapping, [k]: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded border border-[#DCD6C9] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: Scoring Weights */}
            {activeTab === 'weights' && (
              <div className="p-5 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                  <span>⚖️</span> Qualification Scoring Weights
                </h3>
                <p className="text-xs font-mono text-[#766E65]">
                  Adjust the relative point weight of each criterion toward the 0-100 match score.
                </p>
                <div className="space-y-3 pt-2">
                  {Object.entries(settings.scoringWeights).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 p-2.5 rounded-lg border border-[#E5E0D5] bg-[#FAF6EE]">
                      <span className="text-xs font-bold text-[#1E1B18] capitalize">{k} Match Weight</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={50}
                          value={v}
                          onChange={e =>
                            setSettings(prev => ({
                              ...prev,
                              scoringWeights: { ...prev.scoringWeights, [k]: Number(e.target.value) },
                            }))
                          }
                          className="w-28 sm:w-40 accent-[#FF6B35]"
                        />
                        <span className="text-xs font-mono font-bold text-[#FF6B35] w-8 text-right">{v}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: Export & Output */}
            {activeTab === 'export' && (
              <div className="p-5 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                  <span>📦</span> Export & Output Settings
                </h3>
                <p className="text-xs font-mono text-[#766E65]">
                  Configure default formats, metadata, and evidence preservation options.
                </p>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Default Export Format</label>
                    <select
                      value={settings.exportOutput.defaultFormat}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          exportOutput: { ...prev.exportOutput, defaultFormat: e.target.value as any },
                        }))
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold"
                    >
                      <option value="CSV">CSV (.csv)</option>
                      <option value="XLSX">Excel (.xlsx)</option>
                      <option value="Markdown">Obsidian Markdown (.md)</option>
                      <option value="JSON">JSON (.json)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs font-bold text-[#1E1B18] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.exportOutput.includeEvidence}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          exportOutput: { ...prev.exportOutput, includeEvidence: e.target.checked },
                        }))
                      }
                      className="rounded border-[#1E1B18] text-[#FF6B35]"
                    />
                    <span>Include Provenance, URLs & Verification Evidence in Exports</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-bold text-[#1E1B18] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.exportOutput.includeRawData}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          exportOutput: { ...prev.exportOutput, includeRawData: e.target.checked },
                        }))
                      }
                      className="rounded border-[#1E1B18] text-[#FF6B35]"
                    />
                    <span>Preserve 100% of Raw Input Columns and Unmapped Fields</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 7: Advanced */}
            {activeTab === 'advanced' && (
              <div className="p-5 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-4">
                <h3 className="font-display font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                  <span>⚙️</span> Advanced Pipeline Configuration
                </h3>
                <p className="text-xs font-mono text-[#766E65]">
                  Fine-tune batch execution limits, local cache rules, and timeout intervals.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Batch Page Size</label>
                    <input
                      type="number"
                      value={settings.advanced.batchSize}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          advanced: { ...prev.advanced, batchSize: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1E1B18] block">Timeout (Seconds)</label>
                    <input
                      type="number"
                      value={settings.advanced.timeoutSeconds}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          advanced: { ...prev.advanced, timeoutSeconds: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E5E0D5] bg-[#FAF6EE] flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-bold text-[#1E1B18] bg-white border border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE] shadow-sketch-xs transition-colors"
          >
            Reset to Default
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="sketch-btn px-6 py-2.5 text-xs font-bold text-white bg-[#FF6B35] border-2 border-[#1E1B18] rounded-xl hover:bg-[#E55A2B] shadow-sketch-sm flex items-center gap-2 transition-all"
          >
            {isSavedFeedback ? (
              <>
                <span>✓</span>
                <span>Settings Saved!</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
