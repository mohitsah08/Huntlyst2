'use client';

import React, { useState } from 'react';
import { CompanyVerificationResult, CriterionResult, PipelineStageName } from '@/providers/types';

interface CandidateVerificationCardProps {
  result: CompanyVerificationResult;
  isSelected?: boolean;
  onToggleSelect?: (companyName: string) => void;
  onOpenDetails?: () => void;
  onRetryStage?: (result: CompanyVerificationResult, stage: PipelineStageName) => void;
  isRetrying?: boolean;
  onPromote?: (result: CompanyVerificationResult, targetStatus: 'VERIFIED' | 'REVIEW' | 'UNVERIFIED') => void;
}

const STAGE_LABELS: Record<PipelineStageName, string> = {
  DISCOVER: '1. Discover',
  RESEARCH: '2. Research',
  VALIDATE: '3. Validate',
  FIND_FOUNDERS: '4. Founders',
  VERIFY_CONTACT: '5. Contact',
  QUALIFY: '6. Qualify',
};

export default function CandidateVerificationCard({
  result,
  isSelected = true,
  onToggleSelect,
  onOpenDetails,
  onRetryStage,
  isRetrying = false,
  onPromote,
}: CandidateVerificationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    company,
    verificationStatus,
    criteria,
    rejectionReason,
    qualificationReason,
    partiallyVerifiedReason,
    unverifiedReason,
    failedCriteria = [],
    passedCriteria = [],
    unknownCriteria = [],
    stages,
    executives = [],
    hasConflict,
    conflicts = [],
  } = result;

  const canonicalStatus: 'VERIFIED' | 'REVIEW' | 'UNVERIFIED' | 'REJECTED' =
    verificationStatus === 'QUALIFIED' || verificationStatus === 'VERIFIED'
      ? 'VERIFIED'
      : verificationStatus === 'REVIEW' || verificationStatus === 'PARTIALLY_VERIFIED'
      ? 'REVIEW'
      : verificationStatus === 'REJECTED'
      ? 'REJECTED'
      : 'UNVERIFIED';

  const getStatusBadge = () => {
    switch (canonicalStatus) {
      case 'VERIFIED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-mono font-bold text-[#2E7D32] bg-[#E8F5E9] border border-[#2E7D32]/30 rounded-full flex items-center gap-1 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />
            VERIFIED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-mono font-bold text-[#C62828] bg-[#FFEBEE] border border-[#C62828]/30 rounded-full flex items-center gap-1 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C62828]" />
            REJECTED
          </span>
        );
      case 'REVIEW':
        return (
          <span className="px-2.5 py-1 text-[11px] font-mono font-bold text-[#E65100] bg-[#FFF8E1] border border-[#FFA000]/40 rounded-full flex items-center gap-1 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFA000]" />
            REVIEW
          </span>
        );
      case 'UNVERIFIED':
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-mono font-bold text-[#766E65] bg-[#FAF6EE] border border-[#766E65]/30 rounded-full flex items-center gap-1 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#766E65]" />
            UNVERIFIED
          </span>
        );
    }
  };

  const renderCriterionPill = (label: string, crit?: CriterionResult) => {
    if (!crit) return null;
    const { status, value } = crit;

    let badgeClass = 'text-[#766E65] bg-[#F5F2EB] border-[#DCD6C9]';
    let icon = '•';

    if (status === 'PASS') {
      badgeClass = 'text-[#2E7D32] bg-[#E8F5E9] border-[#2E7D32]/30';
      icon = '✓';
    } else if (status === 'FAIL') {
      badgeClass = 'text-[#C62828] bg-[#FFEBEE] border-[#C62828]/30';
      icon = '✗';
    } else if (status === 'CONTRADICTED') {
      badgeClass = 'text-[#B71C1C] bg-[#FFCDD2] border-[#B71C1C]/40';
      icon = '⚠';
    } else {
      badgeClass = 'text-[#B26A00] bg-[#FFF8E1] border-[#B26A00]/30';
      icon = '?';
    }

    return (
      <div className={`p-2 rounded-lg border text-xs flex flex-col justify-between ${badgeClass}`}>
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider">{label}</span>
          <span className="font-mono font-bold text-[10px] px-1 py-0.2 rounded bg-white/70">
            {icon} {status}
          </span>
        </div>
        <span className="font-medium text-[11px] truncate" title={value || 'Unknown'}>
          {value || 'Unknown / Unverified'}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-xl border-2 transition-all bg-[#FFFDF9] ${
        isSelected ? 'border-[#1E1B18] shadow-sketch-sm' : 'border-[#EBE4D5] opacity-80'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0EAD8]">
        <div className="flex items-center gap-3">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(company.name)}
              className="w-4 h-4 rounded text-[#FF6B35] focus:ring-[#FF6B35] cursor-pointer"
            />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display font-bold text-base sm:text-lg text-[#1E1B18]">{company.name}</h4>
              {getStatusBadge()}
              {result.originDisplay && (
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border ${
                  result.originDisplay === 'BOTH'
                    ? 'bg-[#E1BEE7] text-[#4A148C] border-[#BA68C8]'
                    : result.originDisplay === 'INTERNAL'
                    ? 'bg-[#E3F2FD] text-[#0D47A1] border-[#90CAF9]'
                    : 'bg-[#FFF3E0] text-[#E65100] border-[#FFB74D]'
                }`}>
                  {result.originDisplay === 'BOTH' ? 'INTERNAL + EXTERNAL' : result.originDisplay}
                </span>
              )}
              {company.huntScore !== undefined && (
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-[#FAF6EE] border border-[#1E1B18] rounded-md text-[#1E1B18]">
                  {company.huntScore}/100
                </span>
              )}
              {result.isImportedFromHuntlyst && (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#E0F2F1] text-[#00695C] border border-[#00695C]/30 rounded-md font-bold">
                  Imported Dossier
                </span>
              )}
            </div>
            {company.website ? (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#FF6B35] hover:underline flex items-center gap-1 mt-0.5"
              >
                <span>🌐</span> {company.website.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <div className="text-[11px] font-mono text-[#766E65] flex items-center gap-1.5 mt-0.5">
                <span>🌐</span> Website: <span className="font-bold text-[#C62828] bg-[#FFEBEE] px-1.5 py-0.5 rounded border border-[#C62828]/20">NOT FOUND</span>
                <span className="text-[10px] text-[#A8A29E]">(No verified official website)</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {onPromote && canonicalStatus === 'REVIEW' && (
            <button
              type="button"
              onClick={() => onPromote(result, 'VERIFIED')}
              className="text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] px-2.5 py-1 rounded shadow-xs"
              title="Promote to VERIFIED"
            >
              Pass → VERIFIED
            </button>
          )}

          {onPromote && canonicalStatus === 'UNVERIFIED' && (
            <>
              <button
                type="button"
                onClick={() => onPromote(result, 'REVIEW')}
                className="text-xs font-bold text-[#E65100] bg-[#FFF8E1] hover:bg-[#FFE082] border border-[#FFA000] px-2 py-1 rounded"
                title="Promote to REVIEW"
              >
                Pass → REVIEW
              </button>
              <button
                type="button"
                onClick={() => onPromote(result, 'VERIFIED')}
                className="text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] px-2 py-1 rounded shadow-xs"
                title="Promote to VERIFIED"
              >
                Pass → VERIFIED
              </button>
            </>
          )}

          {onPromote && canonicalStatus === 'REJECTED' && (
            <>
              <button
                type="button"
                onClick={() => onPromote(result, 'UNVERIFIED')}
                className="text-xs font-bold text-[#766E65] bg-[#FAF6EE] hover:bg-[#EBE4D5] border border-[#DCD6C9] px-2 py-1 rounded"
                title="Promote to UNVERIFIED"
              >
                Pass → UNVERIFIED
              </button>
              <button
                type="button"
                onClick={() => onPromote(result, 'REVIEW')}
                className="text-xs font-bold text-[#E65100] bg-[#FFF8E1] hover:bg-[#FFE082] border border-[#FFA000] px-2 py-1 rounded"
                title="Promote to REVIEW"
              >
                Pass → REVIEW
              </button>
              <button
                type="button"
                onClick={() => onPromote(result, 'VERIFIED')}
                className="text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] px-2 py-1 rounded shadow-xs"
                title="Promote to VERIFIED"
              >
                Pass → VERIFIED
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-mono text-[#766E65] hover:text-[#1E1B18] px-2.5 py-1 rounded bg-[#FAF6EE] border border-[#DCD6C9]"
          >
            {expanded ? 'Hide Evidence ▲' : 'View Evidence ▼'}
          </button>
          {onOpenDetails && (
            <button
              type="button"
              onClick={onOpenDetails}
              className="text-xs font-bold text-[#1E1B18] px-2.5 py-1 rounded bg-white hover:bg-[#FAF6EE] border border-[#1E1B18]"
            >
              Dossier ↗
            </button>
          )}
        </div>
      </div>

      {/* 6-Stage Pipeline Progression Bar */}
      {stages && (
        <div className="mt-3 pt-2 pb-2 px-3 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] flex items-center justify-between flex-wrap gap-2 text-[10px] font-mono">
          <span className="font-bold text-[#766E65] uppercase">Stages:</span>
          {(['DISCOVER', 'RESEARCH', 'VALIDATE', 'FIND_FOUNDERS', 'VERIFY_CONTACT', 'QUALIFY'] as PipelineStageName[]).map((stKey) => {
            const st = stages[stKey];
            const isCompleted = st?.status === 'completed';
            const isFailed = st?.status === 'failed';
            const isPartial = st?.status === 'partial';

            return (
              <div key={stKey} className="flex items-center gap-1">
                <span
                  className={`px-1.5 py-0.5 rounded font-bold ${
                    isCompleted
                      ? 'bg-[#E8F5E9] text-[#2E7D32]'
                      : isFailed
                      ? 'bg-[#FFEBEE] text-[#C62828]'
                      : isPartial
                      ? 'bg-[#FFF3E0] text-[#E65100]'
                      : 'bg-white text-[#766E65] border border-[#DCD6C9]'
                  }`}
                >
                  {isCompleted ? '✓ ' : isFailed ? '✗ ' : ''}
                  {STAGE_LABELS[stKey]}
                </span>
                {isFailed && onRetryStage && (
                  <button
                    type="button"
                    disabled={isRetrying}
                    onClick={() => onRetryStage(result, stKey)}
                    className="underline text-[#C62828] hover:text-[#B71C1C] font-bold"
                  >
                    Retry
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict Alert Banner if CONFLICT DETECTED */}
      {hasConflict && conflicts.length > 0 && (
        <div className="mt-3 p-3 bg-[#FFF9C4] border border-[#FBC02D] rounded-lg text-xs space-y-1">
          <div className="font-bold text-[#F57F17] flex items-center gap-1">
            <span>⚠️</span> CONFLICT DETECTED BETWEEN SOURCES:
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-[#E65100] font-mono text-[11px]">
              • {c}
            </div>
          ))}
        </div>
      )}

      {/* Decision Explanation Banner */}
      {verificationStatus === 'QUALIFIED' && (
        <div className="mt-3 p-3 bg-[#E8F5E9] border border-[#2E7D32]/40 rounded-lg text-xs space-y-1">
          <div className="font-bold text-[#2E7D32] flex items-center gap-1">
            <span>✓</span> WHY QUALIFIED:
          </div>
          <p className="text-[#1B5E20] font-sans">
            {qualificationReason || result.decisionExplanation || 'Meets all mandatory venture criteria with evidence.'}
          </p>
        </div>
      )}

      {verificationStatus === 'REVIEW' && (
        <div className="mt-3 p-3 bg-[#FFF8E1] border border-[#FFA000]/40 rounded-lg text-xs space-y-1">
          <div className="font-bold text-[#E65100] flex items-center gap-1">
            <span>⚠️</span> WHY REVIEW (FAILS CLOSED):
          </div>
          <p className="text-[#8D6E63] font-sans">
            {result.decisionExplanation || 'Missing verified evidence for mandatory criteria. Fails closed.'}
          </p>
        </div>
      )}

      {verificationStatus === 'PARTIALLY_VERIFIED' && (
        <div className="mt-3 p-3 bg-[#FFF3E0] border border-[#E65100]/40 rounded-lg text-xs space-y-1">
          <div className="font-bold text-[#E65100] flex items-center gap-1">
            <span>ℹ</span> WHY PARTIALLY VERIFIED:
          </div>
          <p className="text-[#BF360C] font-sans">
            {partiallyVerifiedReason || result.decisionExplanation || 'Appears to satisfy target criteria, but certain non-critical criteria are unverified.'}
          </p>
        </div>
      )}

      {verificationStatus === 'UNVERIFIED' && (
        <div className="mt-3 p-3 bg-[#FAF6EE] border border-[#766E65]/30 rounded-lg text-xs space-y-1">
          <div className="font-bold text-[#766E65] flex items-center gap-1">
            <span>?</span> WHY UNVERIFIED:
          </div>
          <p className="text-[#524B43] font-sans">
            {unverifiedReason || result.decisionExplanation || 'Insufficient public documentation available to conclusively verify.'}
          </p>
        </div>
      )}

      {verificationStatus === 'REJECTED' && (
        <div className="mt-3 p-3 bg-[#FFEBEE] border border-[#C62828]/40 rounded-lg text-xs space-y-1">
          <div className="font-bold text-[#C62828] flex items-center gap-1">
            <span>⚠️</span> WHY REJECTED:
          </div>
          <div className="text-[#B71C1C]">
            <span className="font-bold">Failed Target Criteria:</span> {failedCriteria.join(', ')}
          </div>
          {rejectionReason && (
            <div className="text-[#B71C1C] font-sans">
              <span className="font-bold">Reason:</span> {rejectionReason}
            </div>
          )}
        </div>
      )}

      {/* Discovered Executives Section (Stage 4 Output) */}
      {executives.length > 0 && (
        <div className="mt-3 p-2.5 bg-white rounded-lg border border-[#EBE4D5] text-xs">
          <span className="font-mono text-[10px] uppercase font-bold text-[#766E65] block mb-1">
            Discovered Decision Makers:
          </span>
          <div className="flex flex-wrap gap-2">
            {executives.map((ex, idx) => (
              <div key={idx} className="p-1.5 px-2.5 rounded bg-[#FAF6EE] border border-[#DCD6C9] flex items-center gap-2">
                <span className="font-bold text-[#1E1B18]">{ex.name}</span>
                <span className="text-[10px] text-[#766E65]">({ex.title || ex.role})</span>
                {ex.linkedin && (
                  <a
                    href={ex.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-[#FF6B35] hover:underline"
                  >
                    LinkedIn
                  </a>
                )}
                {ex.email && (
                  <span className="text-[10px] font-mono text-[#2E7D32] bg-[#E8F5E9] px-1 rounded">
                    {ex.email}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Profile & Best Contact Path (Sections 9, 10 & 20) */}
      {(() => {
        const profile = company.contactProfile || result.contactProfile;
        if (!profile) return null;
        const bestPath = profile.best_contact_path;
        const completeness = profile.contact_completeness;

        return (
          <div className="mt-3 p-2.5 bg-[#FFFDF9] rounded-lg border border-[#EBE4D5] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] uppercase font-bold text-[#E65100] bg-[#FFF8E1] px-2 py-0.5 rounded border border-[#FFA000]/40 flex items-center gap-1">
                <span>⭐</span> {bestPath.method}:
              </span>
              <span className="font-medium text-[#1E1B18] text-[11px]">
                {bestPath.explanation}
              </span>
            </div>

            {completeness && (
              <span className="text-[10px] font-mono font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#2E7D32]/30">
                Contact Completeness: {completeness.score}/{completeness.maxScore} ({completeness.percentage}%)
              </span>
            )}
          </div>
        );
      })()}

      {/* Criterion Breakdown Grid */}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mt-3">
        {renderCriterionPill('Funding', criteria.funding)}
        {renderCriterionPill('Industry', criteria.industry)}
        {renderCriterionPill('Geography', criteria.geography)}
        {renderCriterionPill('Company Age', criteria.companyAge)}
        {renderCriterionPill('Stage', criteria.companyStage)}
        {renderCriterionPill('CEO / Founder', criteria.founderOrCeo)}
        {renderCriterionPill('Pro Email (MX)', criteria.professionalEmail)}
      </div>

      {/* Expanded Audit Evidence */}
      {expanded && (
        <div className="mt-4 pt-3 border-t border-[#F0EAD8] space-y-4 font-mono text-xs text-[#524B43] bg-[#FAF6EE] p-4 rounded-lg">
          {/* Decision Rationale */}
          <div className="p-3 bg-white rounded border border-[#EBE4D5] space-y-1">
            <span className="font-bold text-[#1E1B18] block text-[11px] uppercase tracking-wider">
              Verification Decision & Evidence Rationale:
            </span>
            <div className="text-[11px] text-[#1E1B18]">
              {result.decisionExplanation || qualificationReason || rejectionReason || 'Standard deterministic rule evaluation.'}
            </div>
            {criteria.industry?.evidence && (
              <div className="text-[10px] text-[#766E65]">
                <span className="font-bold">Industry Evidence:</span> {criteria.industry.evidence}
              </div>
            )}
            {criteria.funding?.evidence && (
              <div className="text-[10px] text-[#766E65]">
                <span className="font-bold">Funding Evidence:</span> {criteria.funding.evidence}
              </div>
            )}
          </div>

          {/* Source Data (Uploaded) vs Enriched Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Source Data (Uploaded) */}
            <div className="p-3 bg-white rounded border border-[#EBE4D5]">
              <span className="font-bold text-[#1E1B18] block text-[11px] uppercase tracking-wider mb-2 text-[#766E65]">
                Source Data (Uploaded):
              </span>
              <div className="space-y-1 text-[11px]">
                <div><span className="font-bold text-[#1E1B18]">Name:</span> {result.source_data?.name || company.name}</div>
                <div><span className="font-bold text-[#1E1B18]">Website:</span> {result.source_data?.website || '<None in file>'}</div>
                <div><span className="font-bold text-[#1E1B18]">Raw Category:</span> {result.source_data?.raw_industry || '<None in file>'}</div>
                <div><span className="font-bold text-[#1E1B18]">Address:</span> {result.source_data?.address || '<None in file>'}</div>
                <div><span className="font-bold text-[#1E1B18]">Phone:</span> {result.source_data?.phone || '<None in file>'}</div>
                <div><span className="font-bold text-[#1E1B18]">Email:</span> {result.source_data?.email || '<None in file>'}</div>
                <div><span className="font-bold text-[#1E1B18]">Founder:</span> {result.source_data?.founder || '<None in file>'}</div>
                <div><span className="font-bold text-[#1E1B18]">Funding:</span> {result.source_data?.funding || '<None in file>'}</div>
              </div>
            </div>

            {/* 2. Enriched Intelligence */}
            <div className="p-3 bg-white rounded border border-[#EBE4D5]">
              <span className="font-bold text-[#1E1B18] block text-[11px] uppercase tracking-wider mb-2 text-[#766E65]">
                Enriched Intelligence:
              </span>
              <div className="space-y-1 text-[11px]">
                <div>
                  <span className="font-bold text-[#1E1B18]">Standard Industry:</span>{' '}
                  <span className="font-mono">{result.enriched_data?.standard_industry?.value || company.industry}</span>{' '}
                  <span className="text-[10px] text-[#766E65]">({result.enriched_data?.standard_industry?.status || 'UNKNOWN'})</span>
                </div>
                <div>
                  <span className="font-bold text-[#1E1B18]">Verified Website:</span>{' '}
                  <span className="font-mono">{result.enriched_data?.website?.value || '<NOT FOUND>'}</span>{' '}
                  <span className="text-[10px] text-[#766E65]">({result.enriched_data?.website?.status || 'NOT_FOUND'})</span>
                </div>
                <div>
                  <span className="font-bold text-[#1E1B18]">Location / HQ:</span>{' '}
                  <span className="font-mono">{result.enriched_data?.location?.value || company.location || 'Unknown'}</span>
                </div>
                <div>
                  <span className="font-bold text-[#1E1B18]">Executive:</span>{' '}
                  <span className="font-mono">{result.enriched_data?.founder?.value || company.founderOrCeoName || 'Unverified'}</span>{' '}
                  <span className="text-[10px] text-[#766E65]">({result.enriched_data?.founder?.status || 'UNKNOWN'})</span>
                </div>
                <div>
                  <span className="font-bold text-[#1E1B18]">Corporate Email:</span>{' '}
                  <span className="font-mono">{result.enriched_data?.email?.value || company.founderOrCeoEmail || 'Unverified'}</span>{' '}
                  <span className="text-[10px] text-[#766E65]">({result.enriched_data?.email?.status || 'UNKNOWN'})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
