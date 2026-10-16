'use client';

import React from 'react';
import { CompanyResearchProfile, VerificationRun } from '@/lib/research/types';

interface ExternalResearchTableProps {
  profiles: CompanyResearchProfile[];
  verificationRuns: Record<string, VerificationRun>;
  selectedIds: Set<string>;
  isVerifying?: boolean;
  onToggleSelect: (id: string) => void;
  onView: (profile: CompanyResearchProfile) => void;
  onVerify: (id: string) => void;
}

function money(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return 'Undisclosed';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusFor(profile: CompanyResearchProfile, run?: VerificationRun): string {
  if (run?.overallStatus) return run.overallStatus;
  if (profile.researchStatus === 'failed') return 'RESEARCH FAILED';
  if (profile.researchStatus === 'partially_completed') return 'PARTIAL';
  if (profile.researchStatus === 'completed') return 'UNVERIFIED';
  return 'NOT RUN';
}

function statusClasses(status: string): string {
  if (status === 'VERIFIED') return 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]';
  if (status === 'REVIEW' || status === 'PARTIAL') return 'bg-[#FFF8E1] text-[#8A4B08] border-[#FFD180]';
  if (status === 'REJECTED' || status === 'RESEARCH FAILED') return 'bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]';
  return 'bg-[#FFF3E0] text-[#C2410C] border-[#FDBA74]';
}

export default function ExternalResearchTable({
  profiles,
  verificationRuns,
  selectedIds,
  isVerifying = false,
  onToggleSelect,
  onView,
  onVerify,
}: ExternalResearchTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-[#1E1B18] bg-[#FFFDF9] shadow-sketch-sm">
      <table className="min-w-[1120px] w-full text-left text-xs font-mono">
        <thead className="bg-[#FAF6EE] border-b border-[#E5DED0] text-[#766E65]">
          <tr>
            <th className="py-3 px-3 text-center w-12">#</th>
            <th className="py-3 px-3">Company</th>
            <th className="py-3 px-3">Domain</th>
            <th className="py-3 px-3">Industry</th>
            <th className="py-3 px-3">Geography</th>
            <th className="py-3 px-3">Founded</th>
            <th className="py-3 px-3">Funding</th>
            <th className="py-3 px-3">Stage</th>
            <th className="py-3 px-3">Status</th>
            <th className="py-3 px-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0EAD8]">
          {profiles.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-12 px-4 text-center text-[#766E65]">
                No companies match this search.
              </td>
            </tr>
          ) : profiles.map((profile, index) => {
            const run = verificationRuns[profile.id];
            const status = statusFor(profile, run);
            const geography = [
              profile.headquarters.city,
              profile.headquarters.stateOrRegion,
              profile.headquarters.country,
            ].filter(Boolean).join(', ') || 'Undisclosed';
            const funding = profile.funding.totalFundingUsd ?? profile.funding.latestRoundUsd;
            const domain = profile.canonicalDomain || profile.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || '';
            return (
              <tr key={profile.id} className="hover:bg-[#FFF8EE] transition-colors">
                <td className="py-3 px-3 text-center text-[#766E65]">{index + 1}</td>
                <td className="py-3 px-3 min-w-[170px]">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(profile.id)}
                      onChange={() => onToggleSelect(profile.id)}
                      aria-label={'Select ' + profile.officialName}
                      className="accent-[#FF6B35]"
                    />
                    <span className="font-bold text-[#1E1B18]">{profile.officialName}</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-[#FF6B35]">
                  {profile.website ? (
                    <a href={profile.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {domain || profile.website}
                    </a>
                  ) : domain || 'Not found'}
                </td>
                <td className="py-3 px-3 text-[#5A544E]">{profile.primaryIndustry || 'Undisclosed'}</td>
                <td className="py-3 px-3 text-[#5A544E] max-w-[180px]">{geography}</td>
                <td className="py-3 px-3 text-[#5A544E]">{profile.foundedYear ?? '—'}</td>
                <td className="py-3 px-3 font-bold text-[#1E1B18]">{money(funding)}</td>
                <td className="py-3 px-3">
                  <span className="inline-block px-2 py-1 rounded-md border border-[#9ADBE4] bg-[#E5F8FB] text-[#007F91] whitespace-nowrap">
                    {profile.funding.latestRoundType || 'Unknown'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={'inline-block px-2 py-1 rounded-md border text-[10px] font-bold whitespace-nowrap ' + statusClasses(status)}>
                    {status}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onView(profile)}
                      className="px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-white text-[#1E1B18] font-bold hover:bg-[#FAF6EE] whitespace-nowrap"
                    >
                      View ↗
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => onVerify(profile.id)}
                      className="px-3 py-1.5 rounded-lg border border-[#1E1B18] bg-[#FFE0B2] text-[#1E1B18] font-bold hover:bg-[#FFD39A] disabled:opacity-50 whitespace-nowrap"
                    >
                      Verify
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
