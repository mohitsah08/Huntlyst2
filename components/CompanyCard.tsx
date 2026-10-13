'use client';

import React from 'react';
import {
  CompanyResearchProfile,
  VerificationRun,
  computeCardFieldStatuses,
  FieldResearchStatus,
} from '@/lib/research/types';
import { downloadSingleMarkdown } from '@/lib/export';

interface CompanyCardProps {
  profile: CompanyResearchProfile;
  verificationRun?: VerificationRun | null;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onOpenDossier: (profile: CompanyResearchProfile) => void;
  onVerify?: (id: string) => void;
  isVerifying?: boolean;
}

export default function CompanyCard({
  profile,
  verificationRun,
  isSelected = false,
  onToggleSelect,
  onOpenDossier,
  onVerify,
  isVerifying = false,
}: CompanyCardProps) {
  // Compute visual status indicators for the 9 key fields
  const statusSummary = computeCardFieldStatuses(profile);
  const { fields, completenessText, foundCount, totalRequired } = statusSummary;

  // Canonical verification badge (if evaluated)
  const renderVerificationBadge = () => {
    if (!verificationRun) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-[#766E65] bg-[#FAF6EE] border border-[#DCD6C9] rounded-md">
          Unverified (Not Run)
        </span>
      );
    }

    const st = verificationRun.overallStatus;
    let badgeClass = 'text-[#766E65] bg-[#FAF6EE] border-[#766E65]/30';
    let dotClass = 'bg-[#766E65]';

    if (st === 'VERIFIED') {
      badgeClass = 'text-[#2E7D32] bg-[#E8F5E9] border-[#2E7D32]/40';
      dotClass = 'bg-[#2E7D32]';
    } else if (st === 'REVIEW') {
      badgeClass = 'text-[#E65100] bg-[#FFF8E1] border-[#FFA000]/40';
      dotClass = 'bg-[#FFA000]';
    } else if (st === 'REJECTED') {
      badgeClass = 'text-[#C62828] bg-[#FFEBEE] border-[#C62828]/40';
      dotClass = 'bg-[#C62828]';
    }

    return (
      <span className={`px-2.5 py-0.5 text-[11px] font-mono font-bold rounded-full border flex items-center gap-1 shadow-xs ${badgeClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <span>{st}</span>
        <span className="opacity-75">({verificationRun.qualificationScore}%)</span>
      </span>
    );
  };

  // Helper to render individual 9-field status pills with strict visual indicators
  const renderStatusPill = (fieldKey: string, label: string) => {
    const item = fields[fieldKey];
    if (!item) return null;

    let icon = '•';
    let style = 'bg-[#FAF6EE] text-[#766E65] border-[#EBE4D5]';

    if (item.status === 'FOUND') {
      icon = '✓';
      style = 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30';
    } else if (item.status === 'CONFLICTING') {
      icon = '⚠';
      style = 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/40';
    } else if (item.status === 'UNDISCLOSED') {
      icon = '?';
      style = 'bg-[#FFF8E1] text-[#B26A00] border-[#FFA000]/30';
    } else if (item.status === 'NOT_FOUND') {
      icon = '✗';
      style = 'bg-[#FFF3E0] text-[#D84315] border-[#FFAB91]/50';
    } else {
      // NOT_SEARCHED
      icon = '—';
      style = 'bg-gray-100 text-gray-500 border-gray-200';
    }

    return (
      <div
        key={fieldKey}
        className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center justify-between gap-1.5 ${style}`}
        title={`${label}: ${item.valueDisplay} (${item.status})`}
      >
        <span className="font-bold truncate max-w-[110px]">{label}</span>
        <span className="font-bold shrink-0">{icon}</span>
      </div>
    );
  };

  // CEO and Founder info
  const ceoName = profile.leadership.ceo?.name;
  const ceoTitle = profile.leadership.ceo?.title || 'CEO';
  const founderNames = profile.leadership.founders.map((f) => f.name);

  // Executive contact
  const ceoEmail = profile.leadership.ceo?.publicEmail;
  const execEmails = profile.contacts.executiveEmails;
  const primaryExecEmail = ceoEmail || (execEmails.length > 0 ? execEmails[0].email : null);
  const execEmailPerson = ceoEmail ? (ceoName || 'CEO') : (execEmails.length > 0 ? execEmails[0].name : null);

  // LinkedIn availability
  const hasCompanyLi = Boolean(profile.contacts.companyLinkedInUrl);
  const hasExecLi = Boolean(profile.leadership.ceo?.linkedInUrl || profile.leadership.ceo?.publicProfileUrl);

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border-2 transition-all bg-[#FFFDF9] ${
        isSelected ? 'border-[#1E1B18] shadow-sketch' : 'border-[#EBE4D5] hover:border-[#1E1B18]/50 shadow-sketch-xs'
      }`}
    >
      {/* CARD HEADER: Checkbox, Name, Domain, Status Badges & Dossier Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0EAD8]">
        <div className="flex items-center gap-3">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(profile.id)}
              className="w-4 h-4 rounded text-[#FF6B35] focus:ring-[#FF6B35] cursor-pointer"
            />
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display font-bold text-base sm:text-lg text-[#1E1B18]">
                {profile.officialName}
              </h4>
              {renderVerificationBadge()}

              {/* Research Completeness Badge */}
              <span
                className="px-2 py-0.5 text-[11px] font-mono font-bold bg-[#E8EAF6] text-[#283593] border border-[#C5CAE9] rounded-md"
                title={`Research Completeness: ${foundCount} of ${totalRequired} core fields found`}
              >
                Research: {completenessText}
              </span>

              {/* US Presence Flag */}
              {profile.usPresence !== null && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border ${
                    profile.usPresence
                      ? 'bg-[#E3F2FD] text-[#0D47A1] border-[#90CAF9]'
                      : 'bg-[#EDE7F6] text-[#4527A0] border-[#B39DDB]'
                  }`}
                >
                  {profile.usPresence ? '🇺🇸 US Presence' : '🌍 Non-US Anchor'}
                </span>
              )}
            </div>

            {/* Official Website */}
            {profile.website ? (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#FF6B35] hover:underline flex items-center gap-1 mt-0.5"
              >
                <span>🌐</span> {profile.canonicalDomain || profile.website.replace(/^https?:\/\//, '')}
                <span className="text-[10px]">↗</span>
              </a>
            ) : (
              <div className="text-[11px] font-mono text-[#766E65] flex items-center gap-1.5 mt-0.5">
                <span>🌐</span> Website: <span className="text-[#C62828] font-bold">Not Listed</span>
              </div>
            )}
          </div>
        </div>

        {/* SIDE ACTIONS: Open Complete Dossier & Verify Button */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* 🔍 Details / Dossier Icon Button */}
          <button
            type="button"
            onClick={() => onOpenDossier(profile)}
            className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border border-[#1E1B18] rounded-xl flex items-center gap-1.5 shadow-sketch-xs transition-colors"
            title="Open Complete Company Research Dossier"
          >
            <span>🔍</span>
            <span>View Dossier</span>
          </button>

          {/* 📝 Quick Export Markdown Note (.md) */}
          <button
            type="button"
            onClick={() => downloadSingleMarkdown(profile)}
            className="sketch-btn px-2.5 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border border-[#1E1B18] rounded-xl flex items-center gap-1 shadow-sketch-xs transition-colors"
            title="Export single company dossier as Obsidian Markdown note (.md)"
          >
            <span>📝</span>
            <span>Export MD</span>
          </button>

          {/* Quick Verify Button */}
          {onVerify && (
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => onVerify(profile.id)}
              className="sketch-btn px-3.5 py-1.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#E55A2B] border border-[#1E1B18] rounded-xl flex items-center gap-1.5 shadow-sketch-xs disabled:opacity-50"
              title="Run deterministic criteria verification"
            >
              <span>⚡</span>
              <span>Verify</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPACT MAIN FIELDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 my-3">
        {/* 1. FUNDING (PROMINENT) */}
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold text-[#766E65] mb-1">
            <span>Funding Intelligence</span>
            <span className={profile.funding.totalFundingUsd || profile.funding.latestRoundUsd ? 'text-[#2E7D32]' : 'text-[#B26A00]'}>
              {profile.funding.totalFundingUsd || profile.funding.latestRoundUsd ? '✓ Disclosed' : '? Undisclosed'}
            </span>
          </div>

          <div>
            <div className="text-base font-display font-bold text-[#1E1B18]">
              {profile.funding.totalFundingUsd ? (
                `$${(profile.funding.totalFundingUsd / 1e6).toFixed(1)}M Total`
              ) : profile.funding.latestRoundUsd ? (
                `$${(profile.funding.latestRoundUsd / 1e6).toFixed(1)}M (Round)`
              ) : (
                <span className="text-[#B26A00] font-mono text-xs">Undisclosed / Unknown</span>
              )}
            </div>

            <div className="text-[11px] font-mono text-[#766E65] mt-0.5 space-y-0.5">
              <div>
                Latest Round:{' '}
                <strong className="text-[#1E1B18]">
                  {profile.funding.latestRoundUsd ? `$${(profile.funding.latestRoundUsd / 1e6).toFixed(1)}M` : 'Undisclosed'}
                </strong>
              </div>
              <div>
                Stage:{' '}
                <span className="font-semibold text-[#1E1B18]">
                  {profile.funding.latestRoundType || 'Undisclosed'}
                </span>
              </div>
              {profile.funding.investors.length > 0 && (
                <div className="truncate" title={profile.funding.investors.join(', ')}>
                  Investors: {profile.funding.investors.slice(0, 2).join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. INDUSTRY & GEOGRAPHY */}
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase font-bold text-[#766E65] mb-1">
            <span>Industry & Geography</span>
          </div>

          <div>
            <div className="text-xs font-mono font-bold text-[#1E1B18] truncate" title={profile.primaryIndustry || 'Undisclosed'}>
              🏷️ {profile.primaryIndustry || <span className="text-[#766E65] font-normal">Undisclosed</span>}
            </div>
            {profile.subIndustry && (
              <div className="text-[10px] font-mono text-[#766E65] truncate">
                Sub: {profile.subIndustry}
              </div>
            )}

            <div className="text-[11px] font-mono text-[#1E1B18] mt-2 truncate" title={profile.headquarters.country || 'Undisclosed'}>
              📍 HQ:{' '}
              <strong>
                {[profile.headquarters.city, profile.headquarters.stateOrRegion, profile.headquarters.country]
                  .filter(Boolean)
                  .join(', ') || 'Undisclosed Location'}
              </strong>
            </div>

            <div className="text-[10px] font-mono text-[#766E65] mt-0.5">
              Age:{' '}
              {profile.companyAgeYears !== null ? (
                `${profile.companyAgeYears} yrs (Est. ${profile.foundedYear})`
              ) : (
                'Undisclosed Age'
              )}
            </div>
          </div>
        </div>

        {/* 3. LEADERSHIP & PROFILES */}
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase font-bold text-[#766E65] mb-1">
            <span>Leadership Team</span>
          </div>

          <div>
            <div className="text-xs font-mono font-bold text-[#1E1B18]">
              👔 CEO:{' '}
              {ceoName ? (
                <span>{ceoName}</span>
              ) : (
                <span className="text-[#B26A00] font-normal">Undisclosed</span>
              )}
            </div>
            {ceoTitle && ceoTitle !== 'CEO' && (
              <div className="text-[10px] font-mono text-[#766E65] truncate">{ceoTitle}</div>
            )}

            <div className="text-[11px] font-mono text-[#766E65] mt-1.5 truncate" title={founderNames.join(', ')}>
              Founders:{' '}
              {founderNames.length > 0 ? (
                <span className="text-[#1E1B18] font-medium">{founderNames.slice(0, 2).join(', ')}</span>
              ) : (
                'Undisclosed'
              )}
            </div>

            <div className="text-[10px] font-mono text-[#766E65] mt-1 flex items-center gap-2">
              <span>LinkedIn:</span>
              {hasExecLi ? (
                <span className="text-[#2E7D32] font-bold">✓ Exec Profile</span>
              ) : hasCompanyLi ? (
                <span className="text-[#2E7D32] font-bold">✓ Company Page</span>
              ) : (
                <span className="text-[#766E65]">Not Listed</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. CONTACTS: COMPANY VS EXECUTIVE (STRICTLY SEPARATED) */}
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase font-bold text-[#766E65] mb-1">
            <span>Contact Channels</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            {/* Company Contact */}
            <div>
              <span className="text-[9px] text-[#766E65] uppercase block font-bold">Company Email:</span>
              {profile.contacts.generalEmail ? (
                <span className="text-[#1E1B18] font-bold truncate block" title={profile.contacts.generalEmail}>
                  ✉️ {profile.contacts.generalEmail}
                </span>
              ) : profile.contacts.contactPageUrl ? (
                <span className="text-[#766E65] text-[10px] block">Web Contact Form</span>
              ) : (
                <span className="text-[#766E65] text-[10px] block">No public email</span>
              )}
            </div>

            {/* Executive Contact */}
            <div>
              <span className="text-[9px] text-[#766E65] uppercase block font-bold">Executive Email:</span>
              {primaryExecEmail ? (
                <span className="text-[#2E7D32] font-bold truncate block" title={`${primaryExecEmail} (${execEmailPerson})`}>
                  👤 {primaryExecEmail}
                </span>
              ) : (
                <span className="text-[#766E65] text-[10px] block">
                  Undisclosed (Zero Pattern Guessing)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 9-FIELD VISUAL STATUS INDICATORS BAR (Requirement 2) */}
      <div className="pt-2 border-t border-[#F0EAD8]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-[#766E65] tracking-wider">
            Field Evidence Verification Indicators (Green = Disclosed with authoritative evidence):
          </span>
          <span className="text-[10px] font-mono text-[#766E65]">
            {statusSummary.hasConflicts ? '⚠️ Note: Conflicting claims flagged' : '✓ No conflicting claims'}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
          {renderStatusPill('funding', 'Funding')}
          {renderStatusPill('industry', 'Industry')}
          {renderStatusPill('geography', 'Geography')}
          {renderStatusPill('companyAge', 'Age')}
          {renderStatusPill('fundingStage', 'Stage')}
          {renderStatusPill('leadership', 'Leadership')}
          {renderStatusPill('companyEmail', 'Co. Email')}
          {renderStatusPill('executiveEmail', 'Exec Email')}
          {renderStatusPill('linkedInProfile', 'LinkedIn')}
        </div>
      </div>
    </div>
  );
}
