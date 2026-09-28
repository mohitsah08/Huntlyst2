'use client';

import { useState } from 'react';
import { SettingsConfig } from '@/lib/types';

interface RunAgentViewProps {
  config: SettingsConfig;
  isRunning: boolean;
  currentStep: number;
  currentMessage: string;
  logs: { time: string; text: string; stage?: string }[];
  candidatesFound: number;
  qualifiedCount: number;
  onStartDiscovery: (params: {
    targetLeads: number;
    sectors: string[];
    depth: 'fast' | 'standard' | 'deep';
  }) => void;
  onViewResults: () => void;
}

const AVAILABLE_SECTORS = [
  'All Focus Sectors',
  'AI & Machine Learning',
  'Fintech & Payments',
  'Developer Infrastructure',
  'Climate & CleanTech',
  'HealthTech & Bio',
  'B2B SaaS & Automation',
  'Cybersecurity & Privacy',
];

const AGENT_STAGES = [
  { id: 1, name: 'Discover', desc: 'Scan EU/Asian feeds & seeds' },
  { id: 2, name: 'Research', desc: 'Fetch pages & parse metadata' },
  { id: 3, name: 'Validate', desc: 'Check $1M-$5M & non-US HQ' },
  { id: 4, name: 'Find Founder', desc: 'Extract CEO / Executive' },
  { id: 5, name: 'Verify Email', desc: 'DNS MX server resolution' },
  { id: 6, name: 'Finalize', desc: 'Qualify & rank target list' },
];

export default function RunAgentView({
  config,
  isRunning,
  currentStep,
  currentMessage,
  logs,
  candidatesFound,
  qualifiedCount,
  onStartDiscovery,
  onViewResults,
}: RunAgentViewProps) {
  const [targetLeads, setTargetLeads] = useState(config.agent.targetLeadsCount || 15);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(['All Focus Sectors']);
  const [depth, setDepth] = useState<'fast' | 'standard' | 'deep'>(
    config.agent.searchDepth || 'standard'
  );

  const toggleSector = (sec: string) => {
    if (sec === 'All Focus Sectors') {
      setSelectedSectors(['All Focus Sectors']);
      return;
    }
    const filtered = selectedSectors.filter((s) => s !== 'All Focus Sectors');
    if (filtered.includes(sec)) {
      const next = filtered.filter((s) => s !== sec);
      setSelectedSectors(next.length === 0 ? ['All Focus Sectors'] : next);
    } else {
      setSelectedSectors([...filtered, sec]);
    }
  };

  const handleLaunch = () => {
    onStartDiscovery({
      targetLeads,
      sectors: selectedSectors,
      depth,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 relative shadow-sketch-sm border-2 border-[#1E1B18]">
        <div className="tape-strip" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                Launch Discovery Engine
              </h1>
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              Autonomous multi-source research, criteria validation, executive extraction, and DNS MX verification.
            </p>
          </div>

          {!isRunning && qualifiedCount > 0 && (
            <button
              type="button"
              onClick={onViewResults}
              className="sketch-btn px-4 py-2 text-xs font-bold text-[#1E1B18] bg-white border-2 border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE] shadow-sketch-sm flex items-center gap-1.5"
            >
              <span>📊</span> View Latest Results ({qualifiedCount})
            </button>
          )}
        </div>
      </div>

      {/* Target Profile Summary Card */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-4">
        <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3">
          <h3 className="font-display text-lg font-bold text-[#1E1B18] flex items-center gap-2">
            <span>🎯</span> Your Current Target Profile
          </h3>
          <span className="text-xs font-mono font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#2E7D32]/30">
            ✓ TVB Assignment Criteria
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
            <span className="text-[10px] font-mono text-[#766E65] block uppercase">Funding Range</span>
            <span className="font-bold text-xs sm:text-sm text-[#FF6B35]">
              ${config.agent.minFunding / 1e6}M – ${config.agent.maxFunding / 1e6}M
            </span>
          </div>
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
            <span className="text-[10px] font-mono text-[#766E65] block uppercase">Platform</span>
            <span className="font-bold text-xs sm:text-sm text-[#1E1B18]">Tech / Software</span>
          </div>
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
            <span className="text-[10px] font-mono text-[#766E65] block uppercase">Geography</span>
            <span className="font-bold text-xs sm:text-sm text-[#1E1B18]">Non-US HQ</span>
          </div>
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
            <span className="text-[10px] font-mono text-[#766E65] block uppercase">Executive</span>
            <span className="font-bold text-xs sm:text-sm text-[#1E1B18]">CEO / Founder</span>
          </div>
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
            <span className="text-[10px] font-mono text-[#766E65] block uppercase">Verification</span>
            <span className="font-bold text-xs sm:text-sm text-[#2E7D32]">DNS MX Email</span>
          </div>
        </div>
      </div>

      {/* Configuration Controls (Disabled during active run) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Target Leads & Depth */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-4">
          <h4 className="font-display text-base font-bold text-[#1E1B18]">
            Target Volume & Search Depth
          </h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[#766E65]">Target Qualified Leads:</span>
              <span className="font-mono font-bold text-sm text-[#1E1B18]">{targetLeads} companies</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              disabled={isRunning}
              value={targetLeads}
              onChange={(e) => setTargetLeads(parseInt(e.target.value))}
              className="w-full accent-[#FF6B35]"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#766E65]">
              <span>5</span>
              <span>10</span>
              <span>15 (Default)</span>
              <span>20</span>
              <span>25</span>
              <span>30</span>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs font-mono text-[#766E65] block mb-2">Discovery Depth:</span>
            <div className="grid grid-cols-3 gap-2">
              {(['fast', 'standard', 'deep'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setDepth(d)}
                  className={`p-2 rounded-xl border-2 text-xs font-bold capitalize transition-all text-center ${
                    depth === d
                      ? 'border-[#1E1B18] bg-[#FF6B35] text-white shadow-sketch-sm'
                      : 'border-[#D9D0C1] bg-white text-[#1E1B18] hover:bg-[#FAF6EE]'
                  }`}
                >
                  <div>{d}</div>
                  <div className="text-[10px] opacity-80">
                    {d === 'fast' ? '30 cands' : d === 'standard' ? '60 cands' : '90 cands'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sectors Filter */}
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base font-bold text-[#1E1B18]">
              Target Technology Sectors
            </h4>
            <span className="text-[11px] font-mono text-[#766E65]">
              {selectedSectors.length} active
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {AVAILABLE_SECTORS.map((sec) => {
              const isSelected = selectedSectors.includes(sec);
              return (
                <button
                  key={sec}
                  type="button"
                  disabled={isRunning}
                  onClick={() => toggleSector(sec)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#1E1B18] text-[#FAF6EE] border-[#1E1B18] shadow-sketch-sm'
                      : 'bg-white text-[#4A443D] border-[#D9D0C1] hover:bg-[#FAF6EE]'
                  }`}
                >
                  {isSelected && '✓ '}
                  {sec}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#766E65]">
            Agent will prioritize platforms in these sectors during extraction.
          </p>
        </div>
      </div>

      {/* Big Launch CTA Bar */}
      <div className="p-6 bg-[#FAF6EE] rounded-2xl border-2 border-[#1E1B18] shadow-sketch-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-[#1E1B18]">
            {isRunning ? 'Discovery Agent Running...' : 'Ready to Execute Discovery Run'}
          </h3>
          <p className="text-xs font-mono text-[#766E65]">
            {isRunning
              ? currentMessage || 'Analyzing sources and testing DNS records...'
              : `Targets: ${targetLeads} leads across ${selectedSectors.join(', ')}`}
          </p>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={handleLaunch}
          className={`sketch-btn px-7 py-3 text-sm font-bold rounded-xl border-2 border-[#1E1B18] shadow-sketch-md flex items-center gap-2 whitespace-nowrap ${
            isRunning
              ? 'bg-[#DDD] text-[#888] cursor-not-allowed border-[#AAA]'
              : 'bg-[#FF6B35] hover:bg-[#E85D26] text-white'
          }`}
        >
          {isRunning ? (
            <>
              <span className="animate-spin text-base">⏳</span>
              <span>Running Autonomous Agent...</span>
            </>
          ) : (
            <>
              <span className="text-base">⚡</span>
              <span>Run TVB Discovery Agent</span>
            </>
          )}
        </button>
      </div>

      {/* Real-time Progress Pipeline */}
      {(isRunning || currentStep > 0) && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3">
            <h4 className="font-display text-lg font-bold text-[#1E1B18] flex items-center gap-2">
              <span>🔄</span> Live Agent Pipeline Stages
            </h4>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span>Candidates: <strong>{candidatesFound}</strong></span>
              <span>Qualified: <strong className="text-[#2E7D32]">{qualifiedCount}</strong></span>
            </div>
          </div>

          {/* Stage Breadcrumbs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {AGENT_STAGES.map((stage) => {
              const isCompleted = currentStep > stage.id;
              const isCurrent = currentStep === stage.id && isRunning;
              return (
                <div
                  key={stage.id}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    isCurrent
                      ? 'bg-[#FFF3EE] border-[#FF6B35] shadow-sketch-sm'
                      : isCompleted
                      ? 'bg-[#E8F5E9] border-[#2E7D32]/40'
                      : 'bg-[#FAF6EE] border-[#EBE4D5] opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-mono font-bold">
                      {isCompleted ? '✓' : isCurrent ? '⚡' : stage.id}
                    </span>
                    <span className="font-bold text-xs text-[#1E1B18]">{stage.name}</span>
                  </div>
                  <p className="text-[10px] text-[#766E65] mt-1">{stage.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Live Terminal Streaming Box */}
          <div className="bg-[#1E1B18] rounded-xl p-4 text-[#FAF6EE] font-mono text-xs space-y-2 max-h-56 overflow-y-auto shadow-inner">
            <div className="flex items-center justify-between text-[11px] text-[#A69E94] border-b border-[#3E3832] pb-1">
              <span>AGENT EVENT STREAM (SSE)</span>
              <span>{logs.length} events</span>
            </div>
            <div className="space-y-1">
              {logs.length === 0 ? (
                <p className="text-[#766E65] italic">Waiting for agent pipeline to start...</p>
              ) : (
                logs.slice(-25).map((log, i) => (
                  <div key={i} className="leading-relaxed flex items-start gap-1.5">
                    <span className="text-[#FF6B35]">›</span>
                    <span className="text-gray-400">[{log.time}]</span>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* If finished, show View Results CTA */}
          {!isRunning && qualifiedCount > 0 && (
            <div className="p-4 bg-[#E8F5E9] rounded-xl border border-[#2E7D32]/30 flex items-center justify-between">
              <div>
                <strong className="text-sm text-[#2E7D32] font-bold">
                  ✓ Discovery Complete: {qualifiedCount} Qualified Leads Found
                </strong>
                <p className="text-xs text-[#4A443D]">
                  All companies meet $1M-$5M funding, tech platform, non-US HQ, and verified DNS MX emails.
                </p>
              </div>
              <button
                type="button"
                onClick={onViewResults}
                className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm"
              >
                Inspect Results ({qualifiedCount}) →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
