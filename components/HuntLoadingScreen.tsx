'use client';

import React from 'react';
import HuntlystLogo, { LogoState } from './HuntlystLogo';
import { HuntConfig } from '@/lib/types';

interface HuntLoadingScreenProps {
  config: HuntConfig;
  currentStep: number;
  currentMessage: string;
  candidatesFound: number;
  qualifiedCount: number;
  researchedCount?: number;
  validatedCount?: number;
  foundersFoundCount?: number;
  contactsCheckedCount?: number;
  sourcesScannedCount?: number;
  verifiedContactsCount?: number;
  currentStrategy?: string;
  sourcesSearched?: string[];
  duplicatesFiltered?: number;
  isComplete?: boolean;
  errorMessage?: string | null;
  onViewResults?: () => void;
  onRetry?: () => void;
}

const STAGES = [
  {
    id: 1,
    name: 'Discovering',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
    ),
  },
  {
    id: 2,
    name: 'Researching',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
      </svg>
    ),
  },
  {
    id: 3,
    name: 'Validating',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    id: 4,
    name: 'Finding Founders',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 5,
    name: 'Verifying Contacts',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: 6,
    name: 'Almost There',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

export default function HuntLoadingScreen({
  config,
  currentStep,
  currentMessage,
  candidatesFound,
  qualifiedCount,
  researchedCount = 0,
  validatedCount = 0,
  foundersFoundCount = 0,
  contactsCheckedCount = 0,
  sourcesScannedCount = 0,
  verifiedContactsCount = 0,
  currentStrategy,
  sourcesSearched = [],
  duplicatesFiltered = 0,
  isComplete = false,
  errorMessage = null,
  onViewResults,
  onRetry,
}: HuntLoadingScreenProps) {
  // Derive appropriate logo animation state based on real backend progress
  let logoState: LogoState = 'searching';
  if (errorMessage) {
    logoState = 'error';
  } else if (isComplete) {
    logoState = 'complete';
  } else if (currentStep === 2) {
    logoState = 'researching';
  } else if (currentStep === 3) {
    logoState = 'validating';
  } else if (currentStep === 4) {
    logoState = 'founders';
  } else if (currentStep === 5) {
    logoState = 'verifying';
  } else if (currentStep >= 6) {
    logoState = 'complete';
  }

  // Calculate approximate percentage based on stage
  const percentage = isComplete
    ? 100
    : Math.min(95, Math.round(((currentStep - 1) / 6) * 100 + 12));

  return (
    <div className="paper-card bg-[#FFFDF9] rounded-3xl p-6 sm:p-10 border-2 border-[#1E1B18] shadow-sketch relative overflow-hidden space-y-8 max-w-4xl mx-auto my-6 text-center animate-in fade-in duration-300">
      {/* Decorative top tape strip */}
      <div className="tape-strip" />

      {/* Background paper texture & subtle discovery rings */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,#FF6B35_0%,transparent_70%)]" />

      {/* Central Animated Huntlyst Logo & Discovery Radar */}
      <div className="relative flex items-center justify-center pt-2">
        {/* Animated Expanding Discovery Ring representing search radius */}
        {!errorMessage && !isComplete && (
          <>
            <div className="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border border-[#FF6B35] opacity-40 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] pointer-events-none" />
            <div className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-dashed border-[#FF6B35] opacity-30 animate-[spin_20s_linear_infinite] pointer-events-none" />

            {/* Orbiting candidate source dots */}
            <div className="absolute w-52 h-52 animate-[spin_8s_linear_infinite] pointer-events-none">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FF6B35] opacity-75 shadow-sm" />
            </div>
            <div className="absolute w-40 h-40 animate-[spin_6s_linear_infinite_reverse] pointer-events-none">
              <span className="absolute bottom-2 right-4 w-1.5 h-1.5 rounded-full bg-[#1E1B18] opacity-60" />
            </div>
          </>
        )}

        {/* Center Official Logo */}
        <div className="relative z-10 transition-transform duration-500">
          <HuntlystLogo
            size="xl"
            state={logoState}
            showWordmark={false}
          />
        </div>
      </div>

      {/* Real-time Status Heading & Description */}
      <div className="space-y-2 relative z-10 max-w-lg mx-auto">
        {errorMessage ? (
          <>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFEBEE] border border-[#EF5350] text-[#C62828] text-xs font-mono font-bold">
              <span>⚠️</span> Hunt Interrupted
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1E1B18]">
              Pipeline Error Encountered
            </h2>
            <p className="text-xs font-mono text-[#C62828] bg-white p-3 rounded-xl border border-[#EF5350]">
              {errorMessage}
            </p>
            {onRetry && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="sketch-btn px-6 py-2.5 bg-[#FF6B35] hover:bg-[#F05820] text-white font-bold rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm text-sm"
                >
                  🔄 Retry Hunt
                </button>
              </div>
            )}
          </>
        ) : isComplete ? (
          <>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F5E9] border border-[#81C784] text-[#2E7D32] text-xs font-mono font-bold animate-pulse">
              <span>✓</span> Hunt Complete
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1E1B18]">
              {qualifiedCount} Qualified Companies Found
            </h2>
            <p className="text-xs font-mono text-[#766E65]">
              Target: {config.geography.countries.join(', ') || config.geography.regions.join(', ') || 'Global'} • {config.sectors.join(', ')}
            </p>
            {onViewResults && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onViewResults}
                  className="sketch-btn px-6 py-2.5 bg-[#FF6B35] hover:bg-[#F05820] text-white font-bold rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm text-sm inline-flex items-center gap-2"
                >
                  <span>📋</span> View Qualified Leads ({qualifiedCount}) →
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1E1B18] tracking-tight">
              Huntlyst is hunting...
            </h2>
            <p className="font-mono text-xs text-[#FF6B35] font-bold tracking-wide animate-pulse min-h-[20px]">
              {currentMessage || 'Scanning the world for possibilities...'}
            </p>
            {currentStrategy && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border border-[#E8DAC2] rounded-full text-[11px] font-mono text-[#1E1B18] shadow-sm">
                <span className="text-[#FF6B35]">🎯</span> {currentStrategy}
              </div>
            )}
            <p className="text-[11px] font-mono text-[#766E65]">
              Target: {config.geography.countries.join(', ') || config.geography.regions.join(', ') || 'Global Non-US'} • {config.sectors.join(', ')} • {config.targetLeads} leads
            </p>
          </>
        )}
      </div>

      {/* Hand-drawn Hatched Progress Bar mirroring reference image */}
      {!errorMessage && (
        <div className="max-w-md mx-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-[#766E65]">
            <span className="italic">Scanning the world for possibilities...</span>
            <span className="font-bold text-[#1E1B18]">{percentage}%</span>
          </div>
          <div className="w-full h-4 bg-[#FAF6EE] rounded-full border-2 border-[#1E1B18] p-0.5 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-[#FF6B35] transition-all duration-500 relative"
              style={{
                width: `${percentage}%`,
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.4) 4px, rgba(255,255,255,0.4) 8px)',
              }}
            />
          </div>
        </div>
      )}

      {/* 6-Stage Hand-Drawn Progress Path */}
      <div className="pt-2">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {STAGES.map((s, idx) => {
            const isCurrent = currentStep === s.id && !isComplete;
            const isPassed = currentStep > s.id || isComplete;

            return (
              <div
                key={s.id}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                  isCurrent
                    ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#FF6B35] shadow-sketch-sm scale-105'
                    : isPassed
                    ? 'bg-[#E8F5E9] border-[#2E7D32] text-[#2E7D32]'
                    : 'bg-[#FAF6EE] border-[#E8DAC2] text-[#8C847A]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCurrent
                      ? 'bg-[#FF6B35] text-white shadow-sm'
                      : isPassed
                      ? 'bg-[#2E7D32] text-white'
                      : 'bg-[#FFFDF9] text-[#766E65] border border-[#E8DAC2]'
                  }`}
                >
                  {isPassed ? (
                    <span className="font-bold text-xs">✓</span>
                  ) : (
                    s.icon
                  )}
                </div>
                <span className="font-bold text-[11px] leading-tight">
                  {s.name}
                </span>
                {isCurrent && (
                  <span className="w-4 h-0.5 bg-[#FF6B35] rounded-full animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Real Progress Telemetry Counts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-4 border-t border-[#F0EAD8] text-xs font-mono max-w-4xl mx-auto">
        <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
          <span className="text-[10px] text-[#766E65] block">Candidates Found</span>
          <span className="font-bold text-sm text-[#1E1B18]">{candidatesFound}</span>
        </div>
        <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
          <span className="text-[10px] text-[#766E65] block">Researched</span>
          <span className="font-bold text-sm text-[#1E1B18]">
            {researchedCount !== undefined ? researchedCount : (currentStep >= 2 ? candidatesFound : 0)}
          </span>
        </div>
        <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
          <span className="text-[10px] text-[#766E65] block">Validated</span>
          <span className="font-bold text-sm text-[#1E1B18]">
            {validatedCount !== undefined ? validatedCount : 0}
          </span>
        </div>
        <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
          <span className="text-[10px] text-[#766E65] block">Founders Found</span>
          <span className="font-bold text-sm text-[#1E1B18]">
            {foundersFoundCount !== undefined ? foundersFoundCount : 0}
          </span>
        </div>
        <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
          <span className="text-[10px] text-[#766E65] block">Contacts Checked</span>
          <span className="font-bold text-sm text-[#1E1B18]">
            {contactsCheckedCount !== undefined ? contactsCheckedCount : (currentStep >= 5 ? (validatedCount || 0) : 0)}
          </span>
        </div>
        <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
          <span className="text-[10px] text-[#766E65] block">Emails Verified</span>
          <span className="font-bold text-sm text-[#FF6B35]">
            {verifiedContactsCount !== undefined ? verifiedContactsCount : 0}
          </span>
        </div>
        <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
          <span className="text-[10px] text-[#766E65] block">Dupes Prevented</span>
          <span className="font-bold text-sm text-[#2E7D32]">
            {duplicatesFiltered || 0}
          </span>
        </div>
      </div>

      {/* Quote note mirroring reference image */}
      <div className="pt-2 text-center">
        <span className="font-serif italic text-xs text-[#766E65]">
          Good leads leave evidence.
        </span>
      </div>
    </div>
  );
}
