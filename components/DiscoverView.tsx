'use client';

import { useState } from 'react';
import { HuntConfig, SettingsConfig, TVB_EVALUATION_CONFIG, CompanyRecord, RejectedCompanyRecord } from '@/lib/types';
import HuntConfiguration from './HuntConfiguration';
import HuntLoadingScreen from './HuntLoadingScreen';
import StagedDiscoveryWorkflow from './StagedDiscoveryWorkflow';

interface DiscoverViewProps {
  config: SettingsConfig;
  isRunning: boolean;
  currentStep: number;
  currentMessage: string;
  logs: { time: string; text: string; stage?: string }[];
  candidatesFound: number;
  qualifiedCount: number;
  onStartHunt: (huntConfig: HuntConfig) => void;
  onViewResults: () => void;
  onFinalizeStagedResults?: (qualified: CompanyRecord[], rejected: RejectedCompanyRecord[]) => void;
  onOpenLeadModal?: (company: CompanyRecord) => void;
}

export default function DiscoverView({
  config,
  isRunning,
  currentStep,
  currentMessage,
  logs,
  candidatesFound,
  qualifiedCount,
  onStartHunt,
  onViewResults,
  onFinalizeStagedResults,
  onOpenLeadModal,
}: DiscoverViewProps) {
  const [activeConfig, setActiveConfig] = useState<HuntConfig>(TVB_EVALUATION_CONFIG);
  const [discoveryMode, setDiscoveryMode] = useState<'staged' | 'autonomous'>('staged');

  const handleLaunch = (selectedConfig: HuntConfig) => {
    setActiveConfig(selectedConfig);
    onStartHunt(selectedConfig);
  };

  const handleStagedFinalize = (qualified: CompanyRecord[], rejected: RejectedCompanyRecord[]) => {
    if (onFinalizeStagedResults) {
      onFinalizeStagedResults(qualified, rejected);
    } else {
      onViewResults();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Workflow Mode Selector */}
      {!isRunning && (
        <div className="paper-card bg-white rounded-2xl p-2 sm:p-2.5 border-2 border-[#1E1B18] shadow-sketch-sm flex items-center justify-between gap-2 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setDiscoveryMode('staged')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              discoveryMode === 'staged'
                ? 'bg-[#1E1B18] text-[#FAF6EE] shadow-sketch-sm'
                : 'text-[#766E65] hover:text-[#1E1B18] hover:bg-[#FAF6EE]'
            }`}
          >
            <span>🔄</span>
            <span>Staged Approval Workflow</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FF6B35] text-white">
              Internal → External → Web
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDiscoveryMode('autonomous')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              discoveryMode === 'autonomous'
                ? 'bg-[#1E1B18] text-[#FAF6EE] shadow-sketch-sm'
                : 'text-[#766E65] hover:text-[#1E1B18] hover:bg-[#FAF6EE]'
            }`}
          >
            <span>⚡</span>
            <span>Autonomous One-Click Hunt</span>
          </button>
        </div>
      )}

      {/* Render Active View */}
      {discoveryMode === 'staged' && !isRunning ? (
        <StagedDiscoveryWorkflow
          initialTargetProfile={activeConfig.targetProfile}
          onFinalizeResults={handleStagedFinalize}
          onOpenLeadModal={onOpenLeadModal}
        />
      ) : isRunning ? (
        <div className="space-y-6">
          <HuntLoadingScreen
            config={activeConfig}
            currentStep={currentStep}
            currentMessage={currentMessage}
            candidatesFound={candidatesFound}
            qualifiedCount={qualifiedCount}
            onViewResults={onViewResults}
          />

          {/* Streaming Logs Terminal */}
          <div className="bg-[#1E1B18] text-[#FAF6EE] p-5 rounded-2xl font-mono text-xs space-y-2 max-h-56 overflow-y-auto border-2 border-[#1E1B18] shadow-sketch max-w-4xl mx-auto">
            <div className="text-[10px] uppercase tracking-wider text-[#FF6B35] font-bold pb-2 border-b border-[#3E3832] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-ping" />
                Autonomous Telemetry Stream
              </span>
              <span className="text-[#8C847A]">Real-Time SSE</span>
            </div>
            {logs.length === 0 ? (
              <div className="text-[#8C847A] py-2">Waiting for first telemetry event...</div>
            ) : (
              logs.slice(-20).map((l, i) => (
                <div key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[#8C847A] shrink-0 text-[10px]">{l.time}</span>
                  <span className="text-[#FF6B35]">›</span>
                  <span className="text-[#E0DACB]">{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Interactive Hunt Configuration Desk */
        <HuntConfiguration
          initialConfig={activeConfig}
          isRunning={isRunning}
          onLaunchHunt={handleLaunch}
        />
      )}
    </div>
  );
}
