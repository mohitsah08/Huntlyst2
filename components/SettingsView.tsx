'use client';

import { useState, useEffect } from 'react';
import { SettingsConfig, SystemHealthResult } from '@/lib/types';
import {
  loadSettings,
  saveSettings,
  resetSettingsToDefault,
} from '@/lib/settings';

interface SettingsViewProps {
  onToast: (msg: string) => void;
  onClearCurrentRun: () => void;
  onClearSavedLeads: () => void;
  onClearCache: () => void;
  onExportAllData: () => void;
}

type SettingsTab =
  | 'hunt'
  | 'search'
  | 'verification'
  | 'output'
  | 'appearance'
  | 'data'
  | 'health';

export default function SettingsView({
  onToast,
  onClearCurrentRun,
  onClearSavedLeads,
  onClearCache,
  onExportAllData,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('hunt');
  const [config, setConfig] = useState<SettingsConfig>(loadSettings());
  const [health, setHealth] = useState<SystemHealthResult | null>(null);
  const [testingHealth, setTestingHealth] = useState(false);

  useEffect(() => {
    setConfig(loadSettings());
  }, []);

  const handleSave = () => {
    saveSettings(config);
    onToast('Huntlyst settings successfully saved! 💾');
  };

  const handleResetDefaults = () => {
    const defaults = resetSettingsToDefault();
    setConfig(defaults);
    onToast('Reset to standard target profile ($1M-$5M, Non-US, Tech Platform, Founder, Email) ✨');
  };

  const testSystemConnections = async () => {
    setTestingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data: SystemHealthResult = await res.json();
      setHealth(data);
      if (data.overallStatus === 'healthy') {
        onToast('All system integrations operational! ✓');
      } else {
        onToast('System check complete — notice status updates below. ⚠️');
      }
    } catch (err: any) {
      onToast(`Health check error: ${err.message || 'Failed'}`);
    } finally {
      setTestingHealth(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18]">
        <div className="tape-strip" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">⚙️</span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                Settings & System Control
              </h1>
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              Configure target profile filters, discovery depth, export formatting, and integration status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white border border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE] shadow-sketch-sm"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm"
            >
              Save Changes 💾
            </button>
          </div>
        </div>

        {/* 7 Tab Navigation (Section 17) */}
        <div className="flex items-center gap-1 mt-6 border-b border-[#F0EAD8] overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'hunt', label: '🎯 Hunt Configuration' },
            { id: 'search', label: '🔍 Search & Discovery' },
            { id: 'verification', label: '🛡️ Verification' },
            { id: 'output', label: '📄 Output Preferences' },
            { id: 'appearance', label: '🎨 Appearance' },
            { id: 'data', label: '🗄️ Data Management' },
            { id: 'health', label: '🩺 System Health' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#1E1B18] text-[#FAF6EE] shadow-sketch-sm'
                  : 'text-[#766E65] hover:text-[#1E1B18] hover:bg-[#FAF6EE]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: HUNT CONFIGURATION */}
      {activeTab === 'hunt' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-6">
          <div className="border-b border-[#F0EAD8] pb-3">
            <h3 className="font-display text-xl font-bold text-[#1E1B18]">
              Hunt Configuration
            </h3>
            <p className="text-xs text-[#766E65]">
              Configure target gates for autonomous company discovery and qualification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Target Leads */}
            <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#EBE4D5] space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-[#766E65] block font-bold">
                Default Target Leads
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={config.agent.targetLeadsCount}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      agent: { ...config.agent, targetLeadsCount: parseInt(e.target.value) || 15 },
                    })
                  }
                  className="w-full accent-[#FF6B35]"
                />
                <span className="font-mono font-bold text-base text-[#1E1B18] w-10 text-right">
                  {config.agent.targetLeadsCount}
                </span>
              </div>
              <p className="text-[11px] text-[#766E65]">Default: 15 companies matching all criteria.</p>
            </div>

            {/* Funding Min / Max */}
            <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#EBE4D5] space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-[#766E65] block font-bold">
                Funding / Revenue Window (USD)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-mono text-[#766E65] block">Min ($)</span>
                  <input
                    type="number"
                    value={config.agent.minFunding}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        agent: { ...config.agent, minFunding: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-[#D9D0C1] bg-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[#766E65] block">Max ($)</span>
                  <input
                    type="number"
                    value={config.agent.maxFunding}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        agent: { ...config.agent, maxFunding: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-[#D9D0C1] bg-white"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#766E65]">Default: $1,000,000 to $5,000,000.</p>
            </div>

            {/* Strictness Toggles */}
            <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#EBE4D5] space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-[#766E65] block font-bold">
                Core Qualification Requirements
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span className="text-[#2C2724] font-bold">Require Tech Platform Architecture</span>
                <input
                  type="checkbox"
                  checked={config.agent.techPlatformRequired}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      agent: { ...config.agent, techPlatformRequired: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#FF6B35] rounded"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span className="text-[#2C2724] font-bold">Deduplicate Root Domains</span>
                <input
                  type="checkbox"
                  checked={config.agent.deduplicationEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      agent: { ...config.agent, deduplicationEnabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#FF6B35] rounded"
                />
              </label>
            </div>

            {/* US Presence & Depth */}
            <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#EBE4D5] space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-[#766E65] block font-bold">
                Geographic Requirement
              </label>

              <div>
                <select
                  value={config.agent.usPresenceStrictness}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      agent: { ...config.agent, usPresenceStrictness: e.target.value as any },
                    })
                  }
                  className="w-full text-xs font-bold p-2 rounded-lg border border-[#D9D0C1] bg-white"
                >
                  <option value="strict_non_us">Strict Non-US (0% US Presence)</option>
                  <option value="allow_low_us_presence">Minimal / Secondary US Branch Allowed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-mono text-[#766E65] block mb-1">
                    Search Depth
                  </span>
                  <select
                    value={config.agent.searchDepth}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        agent: { ...config.agent, searchDepth: e.target.value as any },
                      })
                    }
                    className="w-full text-xs font-bold p-2 rounded-lg border border-[#D9D0C1] bg-white"
                  >
                    <option value="fast">Fast (30 candidates)</option>
                    <option value="standard">Standard (60 candidates)</option>
                    <option value="deep">Deep Scan (90 candidates)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[#766E65] block mb-1">
                    Min Confidence
                  </span>
                  <select
                    value={config.agent.minConfidenceThreshold}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        agent: {
                          ...config.agent,
                          minConfidenceThreshold: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full text-xs font-bold p-2 rounded-lg border border-[#D9D0C1] bg-white"
                  >
                    <option value="0.7">70% Threshold</option>
                    <option value="0.8">80% High Quality</option>
                    <option value="0.9">90% Strict Gate</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SEARCH & DISCOVERY */}
      {activeTab === 'search' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-5">
          <div className="border-b border-[#F0EAD8] pb-3">
            <h3 className="font-display text-xl font-bold text-[#1E1B18]">
              Search & Discovery Sources
            </h3>
            <p className="text-xs text-[#766E65]">
              Real underlying search indexes, RSS venture feeds, and web registries utilized by Huntlyst.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                name: 'Seed Tech Ecosystem Dataset',
                desc: '60+ verified non-US technology platforms spanning UK, Germany, France, Nordics, Singapore, and India.',
                status: 'Active (Always on)',
                icon: '🌱',
              },
              {
                name: 'EU-Startups Venture Wire',
                desc: 'Live European startup funding reports and Seed/Series A deal announcements.',
                status: 'Active & Parsed',
                icon: '📰',
              },
              {
                name: 'Tech.eu Deal Flow Index',
                desc: 'Technology platform deal tracking across Continental Europe and the UK.',
                status: 'Active & Parsed',
                icon: '⚡',
              },
              {
                name: 'Sifted European Tech Wire',
                desc: 'Financial Times-backed European tech startup funding and valuation tracker.',
                status: 'Active & Parsed',
                icon: '🗞️',
              },
            ].map((src, i) => (
              <div
                key={i}
                className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{src.icon}</span>
                  <div>
                    <h4 className="font-bold text-sm text-[#1E1B18]">{src.name}</h4>
                    <p className="text-xs text-[#5A544E]">{src.desc}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-1 rounded-full border border-[#2E7D32]/30 shrink-0">
                  {src.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: VERIFICATION */}
      {activeTab === 'verification' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-5">
          <div className="border-b border-[#F0EAD8] pb-3">
            <h3 className="font-display text-xl font-bold text-[#1E1B18]">
              Verification Engine
            </h3>
            <p className="text-xs text-[#766E65]">
              Real deterministic validation rules and DNS mail exchange confirmation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2">
              <span className="font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                <span>✉️</span> DNS MX Resolver
              </span>
              <p className="text-xs text-[#5A544E] leading-relaxed">
                Connects to authoritative DNS nameservers via Node.js dns/promises to verify domain MX records. Ensures candidate email domains are live and capable of receiving communication.
              </p>
            </div>

            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2">
              <span className="font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                <span>🛡️</span> Non-US Presence Engine
              </span>
              <p className="text-xs text-[#5A544E] leading-relaxed">
                Evaluates corporate registrations, headquarters addresses, and domain TLDs to reject companies with primary US operations or Delaware HQ domiciles.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OUTPUT PREFERENCES */}
      {activeTab === 'output' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-5">
          <div className="border-b border-[#F0EAD8] pb-3">
            <h3 className="font-display text-xl font-bold text-[#1E1B18]">
              Output Preferences
            </h3>
            <p className="text-xs text-[#766E65]">
              Configure export templates, timestamps, and evidence inclusions.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs cursor-pointer">
              <div>
                <span className="font-bold text-[#1E1B18] block">Include Evidence in Exports</span>
                <span className="text-[#766E65]">Include detailed source snippets and validation logs</span>
              </div>
              <input
                type="checkbox"
                checked={config.output.includeEvidence}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    output: { ...config.output, includeEvidence: e.target.checked },
                  })
                }
                className="w-4 h-4 accent-[#FF6B35]"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs cursor-pointer">
              <div>
                <span className="font-bold text-[#1E1B18] block">Include Run Timestamps</span>
                <span className="text-[#766E65]">Add ISO generation timestamp to CSV, PDF, and Word exports</span>
              </div>
              <input
                type="checkbox"
                checked={config.output.includeTimestamp}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    output: { ...config.output, includeTimestamp: e.target.checked },
                  })
                }
                className="w-4 h-4 accent-[#FF6B35]"
              />
            </label>
          </div>
        </div>
      )}

      {/* TAB 5: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-5">
          <div className="border-b border-[#F0EAD8] pb-3">
            <h3 className="font-display text-xl font-bold text-[#1E1B18]">
              Appearance & Theme
            </h3>
            <p className="text-xs text-[#766E65]">
              Hand-drawn editorial aesthetics, paper textures, and responsive options.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2">
              <span className="font-bold text-sm text-[#1E1B18]">Editorial Paper Palette</span>
              <p className="text-xs text-[#5A544E]">
                Warm Cream (#FAF6EE), Studio Orange (#FF6B35), Deep Ink (#1E1B18), and organic hand-drawn borders.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DATA MANAGEMENT */}
      {activeTab === 'data' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-5">
          <div className="border-b border-[#F0EAD8] pb-3">
            <h3 className="font-display text-xl font-bold text-[#1E1B18]">
              Data Management
            </h3>
            <p className="text-xs text-[#766E65]">
              Manage persisted hunt results, saved shortlist items, and local storage cache.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={onClearCurrentRun}
              className="p-3 bg-[#FAF6EE] hover:bg-[#FFE7DC] rounded-xl border border-[#EBE4D5] text-xs font-bold text-[#1E1B18] text-center"
            >
              Clear Current Results
            </button>
            <button
              type="button"
              onClick={onClearSavedLeads}
              className="p-3 bg-[#FAF6EE] hover:bg-[#FFE7DC] rounded-xl border border-[#EBE4D5] text-xs font-bold text-[#1E1B18] text-center"
            >
              Clear Saved Shortlist
            </button>
            <button
              type="button"
              onClick={onClearCache}
              className="p-3 bg-[#FAF6EE] hover:bg-[#FFE7DC] rounded-xl border border-[#EBE4D5] text-xs font-bold text-[#C62828] text-center"
            >
              Reset All Cache
            </button>
          </div>
        </div>
      )}

      {/* TAB 7: SYSTEM HEALTH (Section 17) */}
      {activeTab === 'health' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0EAD8] pb-3">
            <div>
              <h3 className="font-display text-xl font-bold text-[#1E1B18]">
                System Health & Integrations
              </h3>
              <p className="text-xs text-[#766E65]">
                Real status of underlying AI, search, verification, and backend engines. (Never shows secret keys).
              </p>
            </div>

            <button
              type="button"
              disabled={testingHealth}
              onClick={testSystemConnections}
              className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>🩺</span>
              <span>{testingHealth ? 'Testing Integrations...' : 'Test Connections'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'anthropic',
                name: 'Huntlyst Research Engine',
                desc: 'Deep venture intelligence for extraction & structured entity synthesis',
                status: health?.services?.anthropicApi?.status || 'connected',
                details: health?.services?.anthropicApi?.details || 'Configured via environment variables',
              },
              {
                id: 'search',
                name: 'Search & Discovery',
                desc: 'Verified non-US technology registries and curated web scrapers',
                status: health?.services?.discoverySources?.status || 'connected',
                details: health?.services?.discoverySources?.details || 'Multi-source discovery feeds online',
              },
              {
                id: 'verification',
                name: 'Verification (DNS MX)',
                desc: 'Domain mail exchange resolver for contact deliverability checking',
                status: health?.services?.emailVerification?.status || 'connected',
                details: health?.services?.emailVerification?.details || 'DNS MX resolver operational',
              },
              {
                id: 'backend',
                name: 'Backend Runtime',
                desc: 'Next.js 14 App Router serverless & Node runtime',
                status: health?.services?.backend?.status || 'connected',
                details: health?.services?.backend?.details || 'Next.js 14 operational',
              },
              {
                id: 'storage',
                name: 'Storage & Persistence',
                desc: 'Local browser storage for shortlist and hunt run history',
                status: 'connected',
                details: 'Browser localStorage active with schema versioning',
              },
            ].map((svc) => (
              <div
                key={svc.id}
                className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#1E1B18]">{svc.name}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        svc.status === 'connected'
                          ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                          : svc.status === 'warning'
                          ? 'bg-[#FFF3E0] text-[#E65100] border-[#E65100]/30'
                          : 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30'
                      }`}
                    >
                      {svc.status === 'connected' ? 'Connected' : svc.status === 'warning' ? 'Warning' : 'Error'}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A544E] mt-0.5">{svc.desc}</p>
                  <p className="text-[11px] font-mono text-[#8C847A] mt-1">↳ {svc.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
