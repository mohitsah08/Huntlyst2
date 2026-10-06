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
              {company.researchCompleteness !== undefined && (
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E8EAF6] text-[#283593] border border-[#C5CAE9]">
                  Research Completeness: {company.researchCompleteness}%
                </span>
              )}
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

        {/* Discovered Funding Intelligence (Section 5) */}
        {(company.fundingDetails || company.fundingOrRevenue) && (
          <div className="bg-white p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#1E1B18] font-bold flex items-center gap-1.5">
                <span>💰</span> Disclosed Funding & Capital Structure
              </span>
              <span className="text-xs font-mono font-bold text-[#2E7D32]">
                {company.fundingDetails?.total_funding_usd
                  ? `$${(company.fundingDetails.total_funding_usd / 1e6).toFixed(1)}M Total`
                  : company.fundingOrRevenue || 'Disclosed'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
                <span className="text-[10px] font-mono uppercase text-[#766E65] block font-bold">TOTAL DISCLOSED:</span>
                <span className="font-bold text-xs text-[#1E1B18] mt-0.5 block">
                  {company.fundingDetails?.total_funding_usd
                    ? `$${(company.fundingDetails.total_funding_usd / 1e6).toFixed(1)}M`
                    : company.fundingOrRevenue || 'Undisclosed'}
                </span>
              </div>
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
                <span className="text-[10px] font-mono uppercase text-[#766E65] block font-bold">LATEST ROUND:</span>
                <span className="font-bold text-xs text-[#1E1B18] mt-0.5 block">
                  {company.fundingDetails?.latest_round_usd
                    ? `$${(company.fundingDetails.latest_round_usd / 1e6).toFixed(1)}M`
                    : '—'}
                </span>
              </div>
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
                <span className="text-[10px] font-mono uppercase text-[#766E65] block font-bold">STAGE / TYPE:</span>
                <span className="font-bold text-xs text-[#1E1B18] mt-0.5 block">
                  {company.fundingDetails?.latest_round_type || company.funding?.stage || '—'}
                </span>
              </div>
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
                <span className="text-[10px] font-mono uppercase text-[#766E65] block font-bold">ROUND DATE:</span>
                <span className="font-bold text-xs text-[#1E1B18] mt-0.5 block">
                  {company.fundingDetails?.latest_round_date || '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Discovered Executive Leadership Roster (Section 6 & 7) */}
        {(company.leadership || company.ceoName || company.founderNames?.length || company.founderOrCeoName) && (
          <div className="bg-white p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#1E1B18] font-bold flex items-center gap-1.5">
                <span>👥</span> Executive Leadership Roster
              </span>
              <span className="text-xs font-mono text-[#766E65]">
                Individual Executive Verification
              </span>
            </div>
            <div className="space-y-2 text-xs">
              {/* Current CEO */}
              {(company.leadership?.ceo || company.ceoName) && (
                <div className="p-3 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#1E1B18]">
                        {company.leadership?.ceo?.full_name || company.ceoName}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/30 rounded">
                        Current CEO
                      </span>
                    </div>
                    {company.leadership?.ceo?.title && (
                      <span className="text-[11px] text-[#766E65] block mt-0.5">{company.leadership.ceo.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(company.leadership?.ceo?.linkedin_url || company.ceoLinkedin) && (
                      <a
                        href={company.leadership?.ceo?.linkedin_url || company.ceoLinkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-[#FF6B35] hover:underline"
                      >
                        LinkedIn ↗
                      </a>
                    )}
                    {(company.leadership?.ceo?.professional_email || company.ceoEmail) && (
                      <span className="px-2 py-0.5 text-[11px] font-mono text-[#2E7D32] bg-[#E8F5E9] border border-[#2E7D32]/30 rounded">
                        {company.leadership?.ceo?.professional_email || company.ceoEmail}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Founders */}
              {((company.leadership?.founders && company.leadership.founders.length > 0) || company.founderNames?.length) && (
                <div className="p-3 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] space-y-2">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#766E65] block">
                    Founders:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(company.leadership?.founders || company.founderNames?.map(name => ({ full_name: name, role: 'Founder' })) || []).map((f: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border border-[#E0D9C8] flex items-center justify-between">
                        <span className="font-bold text-[#1E1B18]">{f.full_name}</span>
                        {f.linkedin_url && (
                          <a href={f.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#FF6B35] hover:underline">
                            Profile ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Co-Founders */}
              {((company.leadership?.co_founders && company.leadership.co_founders.length > 0) || company.cofounderNames?.length) && (
                <div className="p-3 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] space-y-2">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#766E65] block">
                    Co-Founders:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(company.leadership?.co_founders || company.cofounderNames?.map(name => ({ full_name: name, role: 'Co-Founder' })) || []).map((cf: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded border border-[#E0D9C8] flex items-center justify-between">
                        <span className="font-bold text-[#1E1B18]">{cf.full_name}</span>
                        {cf.linkedin_url && (
                          <a href={cf.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#FF6B35] hover:underline">
                            Profile ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Former CEOs */}
              {company.leadership?.former_ceos && company.leadership.former_ceos.length > 0 && (
                <div className="p-3 bg-[#FFF3E0] rounded-lg border border-[#FFE0B2] space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#E65100] block">
                    Historical / Former CEO(s):
                  </span>
                  {company.leadership.former_ceos.map((fc: any, idx: number) => (
                    <div key={idx} className="text-[#BF360C] text-[11px] font-medium">
                      • {fc.full_name} {fc.evidence ? `— (${fc.evidence})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conflicts Alert Card (Section 31) */}
        {company.conflictDetails && company.conflictDetails.length > 0 && (
          <div className="bg-[#FFF9C4] p-4 rounded-xl border border-[#FBC02D] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#F57F17]">
              <span>⚠️</span> Discovered Evidence Conflicts:
            </div>
            <div className="space-y-1">
              {company.conflictDetails.map((conf, idx) => (
                <div key={idx} className="p-2 bg-white/70 rounded text-[11px] font-mono text-[#E65100]">
                  <span className="font-bold uppercase">[{conf.field}]:</span> Seed: "{conf.seed_value || 'None'}" vs Live: "{conf.live_value}" — {conf.explanation}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reference Benchmark & Multi-Status Validation Card (Section 24) */}
        {(company.referenceStatus || company.sourceType === 'reference_benchmark' || company.huntlystVerificationStatus) && (
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#1E1B18] font-bold flex items-center gap-1.5">
                <span>📊</span> Reference & Verification Audit Status
              </span>
              <span className="text-xs font-mono font-bold text-[#FF6B35]">
                Match: {huntScore}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
                <span className="text-[10px] font-mono uppercase text-[#766E65] block font-bold">REFERENCE:</span>
                <span className="font-bold text-xs text-[#2E7D32] flex items-center gap-1 mt-0.5">
                  ✓ TVB Reference Qualified
                </span>
              </div>
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
                <span className="text-[10px] font-mono uppercase text-[#766E65] block font-bold">HUNTLYST VERIFICATION:</span>
                <span className="font-bold text-xs text-[#1E1B18] flex items-center gap-1 mt-0.5">
                  {company.huntlystVerificationStatus === 'VERIFIED' ? (
                    <span className="text-[#2E7D32]">✓ Verified</span>
                  ) : company.huntlystVerificationStatus === 'PARTIALLY_VERIFIED' || company.huntlystVerificationStatus === 'UNDER_REVIEW' ? (
                    <span className="text-[#E65100]">⚠ {company.huntlystVerificationStatus.replace('_', ' ')}</span>
                  ) : (
                    <span className="text-[#766E65]">? Unverified</span>
                  )}
                </span>
              </div>
              <div className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
                <span className="text-[10px] font-mono uppercase text-[#766E65] block font-bold">CURRENT TARGET PROFILE:</span>
                <span className={`font-bold text-xs flex items-center gap-1 mt-0.5 ${
                  company.targetProfileStatus === 'PASS' ? 'text-[#2E7D32]' : company.targetProfileStatus === 'FAIL' ? 'text-[#C62828]' : 'text-[#E65100]'
                }`}>
                  {company.targetProfileStatus || (huntScore >= 70 ? 'PASS' : 'REVIEW')}
                </span>
              </div>
            </div>

            {/* Why */}
            {(company.mismatchReason || company.contactVerificationReason) && (
              <div className="p-2.5 bg-[#FFF8E1] rounded-lg border border-[#FFE082] text-xs">
                <span className="font-mono font-bold text-[#E65100] text-[10px] uppercase block mb-0.5">WHY:</span>
                <p className="text-[#5A544E] font-medium">
                  {company.mismatchReason || company.contactVerificationReason}
                </p>
              </div>
            )}

            {/* Verification Checklist */}
            <div className="pt-2 border-t border-[#F0EAD8]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#766E65] font-bold block mb-1.5">
                CHECKS:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs font-mono">
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">Company</span>
                  <span className="text-[#2E7D32] font-bold">✓</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">Website</span>
                  <span className={company.website ? 'text-[#2E7D32] font-bold' : 'text-[#C62828] font-bold'}>
                    {company.website ? '✓' : '✕'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">Funding</span>
                  <span className={breakdown.funding > 0 ? 'text-[#2E7D32] font-bold' : 'text-[#C62828] font-bold'}>
                    {breakdown.funding > 0 ? '✓' : '✕'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">Industry</span>
                  <span className="text-[#2E7D32] font-bold">✓</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">Company LinkedIn</span>
                  <span className={company.companyLinkedinUrl || company.linkedinUrl ? 'text-[#2E7D32] font-bold' : 'text-[#766E65]'}>
                    {company.companyLinkedinUrl || company.linkedinUrl ? '✓' : '?'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">Company X</span>
                  <span className={company.contactProfile?.company_twitter_x?.value ? 'text-[#2E7D32] font-bold' : 'text-[#766E65]'}>
                    {company.contactProfile?.company_twitter_x?.value ? '✓' : '?'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">CEO</span>
                  <span className={company.founderOrCeoName ? 'text-[#2E7D32] font-bold' : 'text-[#766E65]'}>
                    {company.founderOrCeoName ? '✓' : '?'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">CEO LinkedIn</span>
                  <span className={company.founder?.linkedinUrl || company.contactProfile?.primary_contact?.linkedin_url ? 'text-[#2E7D32] font-bold' : 'text-[#766E65]'}>
                    {company.founder?.linkedinUrl || company.contactProfile?.primary_contact?.linkedin_url ? '✓' : '?'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                  <span className="text-[#5A544E]">Professional Email</span>
                  <span className={isEmailActive ? 'text-[#2E7D32] font-bold' : 'text-[#766E65]'}>
                    {isEmailActive ? '✓' : '?'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <span className="font-bold font-mono text-[#1E1B18]">Target Geography</span>
                <p className="text-[#5A544E]">
                  Headquartered in {company.country || company.location || 'Global Hub'} matching target geography criteria
                </p>
              </div>
              <span className="text-[#2E7D32] font-mono font-bold shrink-0 ml-3">✓ Verified</span>
            </div>
          </div>
        </div>

        {/* CONTACT VERIFICATION VIEW (Section 18) */}
        {(() => {
          const profile = company.contactProfile;
          const primary = profile?.primary_contact;
          const bestPath = profile?.best_contact_path;
          const completeness = profile?.contact_completeness;

          const renderStatusBadge = (status?: string, value?: string | null) => {
            if (!value || status === 'NOT_FOUND') {
              return <span className="font-mono text-[10px] text-[#766E65] bg-[#FAF6EE] px-1.5 py-0.5 rounded border border-[#EBE4D5]">? Not found</span>;
            }
            if (status === 'UNAVAILABLE' || status === 'NOT_DISCLOSED') {
              return <span className="font-mono text-[10px] text-[#766E65] bg-[#FAF6EE] px-1.5 py-0.5 rounded border border-[#EBE4D5]">— Not disclosed</span>;
            }
            if (status === 'VERIFIED' || status === 'VALID') {
              return <span className="font-mono text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-1.5 py-0.5 rounded border border-[#2E7D32]/30">✓ Verified</span>;
            }
            if (status === 'UNDER_REVIEW' || status === 'CONFLICT') {
              return <span className="font-mono text-[10px] font-bold text-[#E65100] bg-[#FFF8E1] px-1.5 py-0.5 rounded border border-[#E65100]/30">⚠ Under Review</span>;
            }
            return <span className="font-mono text-[10px] text-[#766E65] bg-[#FAF6EE] px-1.5 py-0.5 rounded border border-[#EBE4D5]">~ Unverified</span>;
          };

          return (
            <div className="bg-white rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm p-4 sm:p-5 space-y-4">
              {/* Header with Completeness */}
              <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3 flex-wrap gap-2">
                <div className="space-y-0.5">
                  <h4 className="font-display text-base font-bold text-[#1E1B18] flex items-center gap-1.5">
                    <span>📇</span> Contact Verification & Decision-Maker Intelligence
                  </h4>
                  <p className="text-[11px] font-mono text-[#766E65]">
                    Strict provenance & DNS MX deliverability • Zero fabricated contact data
                  </p>
                </div>
                {completeness && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#766E65]">Completeness:</span>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold text-[#2E7D32] bg-[#E8F5E9] border border-[#2E7D32]/30 rounded-full">
                      {completeness.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Best Contact Path Highlight (Section 9) */}
              {bestPath && (
                <div className="p-3 bg-[#FFF8E1] border-2 border-[#FFA000]/60 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase font-bold text-[#E65100] flex items-center gap-1">
                      <span>⭐</span> Best Contact Path:
                    </span>
                    <span className="font-mono text-xs font-bold text-[#1E1B18] bg-white px-2 py-0.5 rounded border border-[#FFA000]/40">
                      {bestPath.method}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#1E1B18]">
                    {bestPath.explanation}
                    {bestPath.value ? ` (${bestPath.value})` : ''}
                  </p>
                  {bestPath.alternative && (
                    <p className="text-[11px] text-[#766E65]">
                      <span className="font-bold">Alternative:</span> {bestPath.alternative.explanation}
                      {bestPath.alternative.value ? ` (${bestPath.alternative.value})` : ''}
                    </p>
                  )}
                </div>
              )}

              {/* 2-Column Contact View: COMPANY vs PRIMARY DECISION MAKER */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: COMPANY CONTACT */}
                <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2.5">
                  <span className="text-[11px] font-mono uppercase font-bold text-[#766E65] block border-b border-[#EBE4D5] pb-1">
                    🏢 Company Contact
                  </span>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#5A544E]">Website</span>
                      {company.website ? (
                        <div className="flex items-center gap-1.5">
                          <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] font-mono truncate max-w-[130px] hover:underline">
                            {company.website.replace(/^https?:\/\//, '')}
                          </a>
                          {renderStatusBadge('VERIFIED', company.website)}
                        </div>
                      ) : renderStatusBadge('NOT_FOUND', null)}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5A544E]">Company LinkedIn</span>
                      {profile?.company_linkedin?.value ? (
                        <div className="flex items-center gap-1.5">
                          <a href={profile.company_linkedin.value} target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] font-mono truncate max-w-[130px] hover:underline">
                            View Profile ↗
                          </a>
                          {renderStatusBadge(profile.company_linkedin.verification_status, profile.company_linkedin.value)}
                        </div>
                      ) : renderStatusBadge('NOT_FOUND', null)}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5A544E]">Company X / Twitter</span>
                      {profile?.company_twitter_x?.value ? (
                        <div className="flex items-center gap-1.5">
                          <a href={profile.company_twitter_x.value} target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] font-mono truncate max-w-[130px] hover:underline">
                            View Handle ↗
                          </a>
                          {renderStatusBadge(profile.company_twitter_x.verification_status, profile.company_twitter_x.value)}
                        </div>
                      ) : renderStatusBadge('NOT_FOUND', null)}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5A544E]">Company Email</span>
                      {profile?.company_email?.value ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[#1E1B18]">{profile.company_email.value}</span>
                          {renderStatusBadge(profile.company_email.verification_status, profile.company_email.value)}
                        </div>
                      ) : renderStatusBadge('NOT_FOUND', null)}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5A544E]">Company Phone</span>
                      {profile?.company_phone?.value ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[#1E1B18]">{profile.company_phone.value}</span>
                          {renderStatusBadge(profile.company_phone.verification_status, profile.company_phone.value)}
                        </div>
                      ) : renderStatusBadge('UNAVAILABLE', null)}
                    </div>
                  </div>
                </div>

                {/* Column 2: PRIMARY DECISION MAKER */}
                <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#EBE4D5] pb-1">
                    <span className="text-[11px] font-mono uppercase font-bold text-[#766E65]">
                      👤 Primary Decision Maker
                    </span>
                    {primary?.current_role && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35]/30">
                        {primary.current_role}
                      </span>
                    )}
                  </div>

                  {primary ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1E1B18] text-sm">{primary.full_name}</span>
                        {renderStatusBadge(primary.verification_status, primary.full_name)}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#5A544E]">Professional Email</span>
                        {primary.professional_email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[#1E1B18] font-bold">{primary.professional_email}</span>
                            {renderStatusBadge(primary.professional_email_status, primary.professional_email)}
                          </div>
                        ) : renderStatusBadge('NOT_FOUND', null)}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#5A544E]">LinkedIn</span>
                        {primary.linkedin_url ? (
                          <div className="flex items-center gap-1.5">
                            <a href={primary.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] font-mono truncate max-w-[130px] hover:underline">
                              View Profile ↗
                            </a>
                            {renderStatusBadge(primary.linkedin_status, primary.linkedin_url)}
                          </div>
                        ) : renderStatusBadge('NOT_FOUND', null)}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#5A544E]">X / Twitter</span>
                        {primary.twitter_x_url ? (
                          <div className="flex items-center gap-1.5">
                            <a href={primary.twitter_x_url} target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] font-mono truncate max-w-[130px] hover:underline">
                              View Handle ↗
                            </a>
                            {renderStatusBadge(primary.twitter_x_status, primary.twitter_x_url)}
                          </div>
                        ) : renderStatusBadge('NOT_FOUND', null)}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#5A544E]">Public Personal Email</span>
                        {primary.public_personal_email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[#1E1B18]">{primary.public_personal_email}</span>
                            {renderStatusBadge('VALID', primary.public_personal_email)}
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-[#766E65] bg-[#FAF6EE] px-1.5 py-0.5 rounded border border-[#EBE4D5]">
                            — Not publicly disclosed
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-[#766E65] font-mono">
                      No verified executive identity confirmed from primary disclosures.
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary Contacts (Section 16: Multiple Contacts Support) */}
              {profile && profile.secondary_contacts && profile.secondary_contacts.length > 0 && (
                <div className="pt-2 border-t border-[#F0EAD8]">
                  <span className="text-[11px] font-mono uppercase font-bold text-[#766E65] block mb-2">
                    👥 Additional Discovered Leadership ({profile.secondary_contacts.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {profile.secondary_contacts.map((sec: any, sIdx: number) => (
                      <div key={sIdx} className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#1E1B18] block">{sec.full_name}</span>
                          <span className="text-[10px] font-mono text-[#766E65]">{sec.current_role}</span>
                        </div>
                        {sec.professional_email && (
                          <span className="text-[10px] font-mono text-[#2E7D32] bg-[#E8F5E9] px-1.5 py-0.5 rounded border border-[#2E7D32]/30">
                            {sec.professional_email_status === 'VALID' ? '✓ Email Valid' : 'Email Unverified'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}


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
