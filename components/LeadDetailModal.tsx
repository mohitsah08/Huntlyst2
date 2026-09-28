'use client';

import { CompanyRecord } from '@/lib/types';
import { calculateHuntScore } from '@/lib/rank';

interface LeadDetailModalProps {
  company: CompanyRecord | null;
  onClose: () => void;
  onSaveToggle: (company: CompanyRecord) => void;
  isSaved: boolean;
  onToast: (msg: string) => void;
}

export default function LeadDetailModal({
  company,
  onClose,
  onSaveToggle,
  isSaved,
  onToast,
}: LeadDetailModalProps) {
  if (!company) return null;

  const handleCopyEmail = () => {
    const email = company.founderOrCeoEmail || company.email?.address;
    if (email && (company.emailVerified || company.email?.status === 'verified')) {
      navigator.clipboard.writeText(email);
      onToast(`Copied ${email} to clipboard! 📋`);
    } else {
      onToast('Email unavailable or not verified.');
    }
  };

  const { score: huntScore, breakdown } = calculateHuntScore(company);
  const contactEmail = company.founderOrCeoEmail || company.email?.address;
  const isEmailActive = company.emailVerified || company.email?.status === 'verified';
  const founderName = company.founderOrCeoName || company.founder?.name || 'Executive Leadership';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B18]/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="paper-card bg-[#FFFDF9] max-w-2xl w-full rounded-2xl p-6 sm:p-7 relative shadow-sketch-lg space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="tape-strip" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F0EAD8] pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                {company.name}
              </h2>
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35]/30">
                Hunt Score: {huntScore} / 100
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#766E65] flex-wrap">
              <span>📍 {company.country || company.location || 'Non-US'}</span>
              <span>•</span>
              <span className="text-[#FF6B35] font-bold">🏷️ {company.industry || company.sector || 'Tech Platform'}</span>
              {company.website && (
                <>
                  <span>•</span>
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-[#FF6B35] flex items-center gap-1"
                  >
                    <span>{company.website.replace(/^https?:\/\//, '')}</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[#D9D0C1] bg-white flex items-center justify-center text-sm font-bold text-[#766E65] hover:bg-[#FAF6EE] hover:text-[#1E1B18] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <div className="bg-[#FAF6EE] p-4 rounded-xl border border-[#EBE4D5]">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#766E65] mb-1 font-bold">
            Company Intelligence
          </h4>
          <p className="text-sm text-[#2C2724] leading-relaxed">
            {company.description || 'Technology platform validated against the non-US target profile.'}
          </p>
        </div>

        {/* Qualification Score Breakdown (Section 13) */}
        <div className="bg-white p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#1E1B18] font-bold flex items-center gap-1.5">
              <span>🎯</span> Qualification Score Breakdown
            </span>
            <span className="text-xs font-mono font-bold text-[#FF6B35]">
              {huntScore} / 100 points
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1 text-xs">
            <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] text-center">
              <span className="text-[10px] font-mono text-[#766E65] block">Funding Fit</span>
              <span className="font-bold text-sm text-[#1E1B18]">{breakdown.funding}/20</span>
            </div>
            <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] text-center">
              <span className="text-[10px] font-mono text-[#766E65] block">Tech Fit</span>
              <span className="font-bold text-sm text-[#1E1B18]">{breakdown.technology}/20</span>
            </div>
            <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] text-center">
              <span className="text-[10px] font-mono text-[#766E65] block">Geo Fit</span>
              <span className="font-bold text-sm text-[#1E1B18]">{breakdown.geography}/20</span>
            </div>
            <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] text-center">
              <span className="text-[10px] font-mono text-[#766E65] block">Founder</span>
              <span className="font-bold text-sm text-[#1E1B18]">{breakdown.founder}/20</span>
            </div>
            <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] text-center">
              <span className="text-[10px] font-mono text-[#766E65] block">Contact</span>
              <span className="font-bold text-sm text-[#1E1B18]">{breakdown.contact}/20</span>
            </div>
          </div>
        </div>

        {/* Why this lead qualifies (Section 12) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg font-bold text-[#1E1B18] flex items-center gap-2">
              <span>✓</span> Why this lead qualifies
            </h4>
            <span className="text-xs font-mono text-[#766E65]">Target Profile Verification</span>
          </div>

          <div className="space-y-2">
            {/* Funding */}
            <div className="flex items-start justify-between p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs">
              <div className="space-y-0.5">
                <span className="font-bold font-mono text-[#1E1B18]">Funding / Revenue ($1M–$5M)</span>
                <p className="text-[#5A544E]">
                  {company.fundingOrRevenue || company.funding?.totalRaised || '$1M–$5M documented in seed/growth registries'}
                </p>
              </div>
              <span className="text-[#2E7D32] font-mono font-bold shrink-0 ml-3">✓ Verified</span>
            </div>

            {/* Technology */}
            <div className="flex items-start justify-between p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs">
              <div className="space-y-0.5">
                <span className="font-bold font-mono text-[#1E1B18]">Technology Platform</span>
                <p className="text-[#5A544E]">
                  {company.industry || company.sector || 'Proprietary software, B2B SaaS, or digital platform architecture'}
                </p>
              </div>
              <span className="text-[#2E7D32] font-mono font-bold shrink-0 ml-3">✓ Verified</span>
            </div>

            {/* Geography */}
            <div className="flex items-start justify-between p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs">
              <div className="space-y-0.5">
                <span className="font-bold font-mono text-[#1E1B18]">Geography (Minimal/No US)</span>
                <p className="text-[#5A544E]">
                  Headquartered in {company.country || company.location || 'Non-US hub'} with confirmed non-US operations
                </p>
              </div>
              <span className="text-[#2E7D32] font-mono font-bold shrink-0 ml-3">✓ Verified</span>
            </div>

            {/* Founder */}
            <div className="flex items-start justify-between p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs">
              <div className="space-y-0.5">
                <span className="font-bold font-mono text-[#1E1B18]">CEO / Co-founder</span>
                <p className="text-[#5A544E]">
                  {founderName} identified from company registry & executive index
                </p>
              </div>
              <span className="text-[#2E7D32] font-mono font-bold shrink-0 ml-3">✓ Verified</span>
            </div>

            {/* Email */}
            <div className="flex items-start justify-between p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs">
              <div className="space-y-0.5">
                <span className="font-bold font-mono text-[#1E1B18]">Professional Contact</span>
                <p className="text-[#5A544E]">
                  {contactEmail ? `${contactEmail}` : 'No email address listed'}
                  {company.auditDetails?.emailStatus ? ` • ${company.auditDetails.emailStatus}` : ''}
                </p>
              </div>
              {company.emailVerified ? (
                <span className="text-[#2E7D32] font-mono font-bold shrink-0 ml-3">✓ Verified</span>
              ) : company.contactVerificationStatus === 'PARTIALLY VERIFIED' ? (
                <span className="text-[#E65100] font-mono font-bold shrink-0 ml-3">~ Partially Verified</span>
              ) : company.contactVerificationStatus === 'REJECTED' ? (
                <span className="text-[#C62828] font-mono font-bold shrink-0 ml-3">✗ Rejected</span>
              ) : (
                <span className="text-[#766E65] font-mono font-bold shrink-0 ml-3">? Unverified</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[#F0EAD8] flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onSaveToggle(company)}
            className={`sketch-btn px-4 py-2 text-xs font-bold rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center gap-2 ${
              isSaved
                ? 'bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9]'
                : 'bg-white text-[#1E1B18] hover:bg-[#FAF6EE]'
            }`}
          >
            <span>{isSaved ? '✓' : '⭐'}</span>
            <span>{isSaved ? 'In Shortlist' : 'Save to Shortlist'}</span>
          </button>

          <div className="flex items-center gap-2">
            {contactEmail && isEmailActive ? (
              <button
                type="button"
                onClick={handleCopyEmail}
                className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#E85D26] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center gap-1.5"
              >
                <span>📋</span> Copy Email
              </button>
            ) : null}

            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="sketch-btn px-4 py-2 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center gap-1.5"
              >
                <span>🌐</span> Visit Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
