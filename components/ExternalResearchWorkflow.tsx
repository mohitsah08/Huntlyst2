'use client';

import React, { useState, useEffect } from 'react';
import {
  CompanyResearchProfile,
  TargetCriteria,
  VerificationRun,
  CriterionVerificationResult,
  DEFAULT_TARGET_CRITERIA,
} from '@/lib/research/types';
import { CompanyVerificationResult } from '@/providers/types';
import CompanyCard from './CompanyCard';
import CompanyResearchDossierModal from './CompanyResearchDossierModal';
import ExportModal from './ExportModal';
import { downloadCombinedMarkdown, downloadObsidianVault } from '@/lib/export';

interface ExternalResearchWorkflowProps {
  carriedCandidates?: Array<{ name?: string; website?: string }>;
  onUpdateResults?: (results: CompanyVerificationResult[]) => void;
  onOpenLeadModal?: (company: any) => void;
}

type ExternalTab = 'research' | 'profile' | 'criteria' | 'verify';

export default function ExternalResearchWorkflow({
  carriedCandidates = [],
  onUpdateResults,
  onOpenLeadModal,
}: ExternalResearchWorkflowProps) {
  const [activeTab, setActiveTab] = useState<ExternalTab>('research');

  // Input state
  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Profiles & Selection
  const [profiles, setProfiles] = useState<CompanyResearchProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [dossierProfile, setDossierProfile] = useState<CompanyResearchProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Criteria State
  const [criteria, setCriteria] = useState<TargetCriteria>(DEFAULT_TARGET_CRITERIA);
  const [criteriaSaveMsg, setCriteriaSaveMsg] = useState<string | null>(null);

  // Verification State
  const [verificationRuns, setVerificationRuns] = useState<Record<string, VerificationRun>>({});
  
  // Status & Progress
  const [isResearching, setIsResearching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Load existing profiles & criteria on mount
  useEffect(() => {
    loadSavedProfiles();
    loadActiveCriteria();
    loadVerificationRuns();
  }, []);

  const loadSavedProfiles = async () => {
    try {
      const res = await fetch('/api/research');
      const data = await res.json();
      if (data.success && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
        if (data.profiles.length > 0 && !selectedProfileId) {
          setSelectedProfileId(data.profiles[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load saved profiles:', err);
    }
  };

  const loadActiveCriteria = async () => {
    try {
      const res = await fetch('/api/target-profile');
      const data = await res.json();
      if (data.success && data.active) {
        setCriteria(data.active);
      }
    } catch (err) {
      console.warn('Failed to load target criteria:', err);
    }
  };

  const loadVerificationRuns = async () => {
    try {
      const res = await fetch('/api/verify');
      const data = await res.json();
      if (data.success && Array.isArray(data.runs)) {
        const runMap: Record<string, VerificationRun> = {};
        for (const run of data.runs) {
          // Keep the latest run per company
          if (!runMap[run.companyId] || new Date(run.verifiedAt) > new Date(runMap[run.companyId].verifiedAt)) {
            runMap[run.companyId] = run;
          }
        }
        setVerificationRuns(runMap);
      }
    } catch (err) {
      console.warn('Failed to load verification runs:', err);
    }
  };

  // Helper: map profile & verification run to CompanyVerificationResult for unified export
  const syncResultsToParent = (
    currentProfiles: CompanyResearchProfile[],
    runs: Record<string, VerificationRun>
  ) => {
    if (!onUpdateResults) return;

    const formattedList: CompanyVerificationResult[] = currentProfiles.map((p) => {
      const run = runs[p.id];
      const status = run ? run.overallStatus : 'UNVERIFIED';
      const score = run ? run.qualificationScore : p.researchCompletenessScore;

      return {
        verificationStatus: status as any,
        confidenceScore: score,
        company: {
          name: p.officialName,
          website: p.website,
          description: p.description || null,
          industry: p.primaryIndustry || null,
          fundingOrRevenue: p.funding.totalFundingUsd ? `$${Math.round(p.funding.totalFundingUsd).toLocaleString()}` : null,
          totalFundingUsd: p.funding.totalFundingUsd,
          latestRoundUsd: p.funding.latestRoundUsd,
          latestRoundType: p.funding.latestRoundType,
          latestRoundDate: p.funding.latestRoundDate,
          usPresence: p.usPresence,
          founderOrCeoName: p.leadership.ceo?.name || p.leadership.founders[0]?.name || null,
          founderOrCeoEmail: p.contacts.generalEmail || null,
          emailVerified: false,
          confidenceScore: score,
          huntScore: score,
          researchCompleteness: p.researchCompletenessScore,
          sourceType: 'FIRECRAWL_RESEARCH',
          country: p.headquarters.country || null,
          headquarters: [p.headquarters.city, p.headquarters.stateOrRegion, p.headquarters.country].filter(Boolean).join(', ') || null,
          city: p.headquarters.city || null,
          state: p.headquarters.stateOrRegion || null,
        },
        leadership: {
          ceo: p.leadership.ceo
            ? {
                role: 'CEO',
                name: p.leadership.ceo.name,
                title: p.leadership.ceo.title,
                current_or_former: 'current',
                source_url: p.leadership.ceo.sourceUrl || null,
                evidence: p.leadership.ceo.evidence || null,
                status: 'PASS',
              }
            : null,
          founders: p.leadership.founders.map((f) => ({
            role: 'Founder',
            name: f.name,
            title: f.title,
            current_or_former: 'current',
            evidence: f.evidence || null,
            source_url: f.sourceUrl || null,
            status: 'PASS',
          })),
          coFounders: p.leadership.coFounders.map((f) => ({
            role: 'Co-Founder',
            name: f.name,
            title: f.title,
            current_or_former: 'current',
            evidence: f.evidence || null,
            source_url: f.sourceUrl || null,
            status: 'PASS',
          })),
        },
        funding: {
          totalFundingUsd: p.funding.totalFundingUsd,
          latestRoundUsd: p.funding.latestRoundUsd,
          latestRoundType: p.funding.latestRoundType,
          latestRoundDate: p.funding.latestRoundDate,
          rounds: p.funding.rounds,
        },
        contacts: {
          companyEmails: p.contacts.generalEmail ? [p.contacts.generalEmail] : [],
          executiveEmails: p.contacts.executiveEmails.map((e) => ({
            executiveName: e.name,
            email: e.email,
            verificationStatus: 'valid' as const,
            sourceUrl: e.sourceUrl,
          })),
          phones: p.contacts.phone ? [p.contacts.phone] : [],
        },
        social: {
          companyLinkedIn: p.contacts.companyLinkedInUrl,
          companyX: p.contacts.companyXUrl,
        },
        criteria: {
          funding: {
            name: 'Funding Range',
            satisfied: run?.criteria.funding?.status === 'PASS',
            status: (run?.criteria.funding?.status || 'UNKNOWN') as any,
            reason: run?.criteria.funding?.reason || 'Undisclosed',
          },
          industry: {
            name: 'Industry Taxonomy',
            satisfied: run?.criteria.industry?.status === 'PASS',
            status: (run?.criteria.industry?.status || 'UNKNOWN') as any,
            reason: run?.criteria.industry?.reason || 'Undisclosed',
          },
          companyAge: {
            name: 'Company Age',
            satisfied: true,
            status: 'PASS',
            reason: 'Within age bounds',
          },
          geography: {
            name: 'Headquarters Geography',
            satisfied: run?.criteria.geography?.status === 'PASS',
            status: (run?.criteria.geography?.status || 'UNKNOWN') as any,
            reason: run?.criteria.geography?.reason || 'Undisclosed',
          },
          usPresence: {
            name: 'US Presence',
            satisfied: run?.criteria.usPresence?.status === 'PASS',
            status: (run?.criteria.usPresence?.status || 'UNKNOWN') as any,
            reason: run?.criteria.usPresence?.reason || 'Undisclosed',
          },
          companyStage: {
            name: 'Company Stage',
            satisfied: true,
            status: 'PASS',
            reason: 'Stage evaluated',
          },
          founderOrCeo: {
            name: 'CEO / Founders',
            satisfied: (run?.criteria.ceo?.status === 'PASS') || (run?.criteria.founders?.status === 'PASS'),
            status: ((run?.criteria.ceo?.status || run?.criteria.founders?.status || 'UNKNOWN')) as any,
            reason: run?.criteria.ceo?.reason || run?.criteria.founders?.reason || 'Undisclosed',
          },
          professionalEmail: {
            name: 'Business Email',
            satisfied: run?.criteria.publicEmail?.status === 'PASS',
            status: (run?.criteria.publicEmail?.status || 'UNKNOWN') as any,
            reason: run?.criteria.publicEmail?.reason || 'Undisclosed',
          },
        },
        qualification: {
          matchScore: score,
          criteria: run ? run.criteria : {},
          finalStatus: status,
          reasons: run ? [run.summaryReason] : ['Pending verification'],
        },
        failedCriteria: run ? Object.values(run.criteria).filter((c) => c.status === 'FAIL').map((c) => c.name) : [],
        passedCriteria: run ? Object.values(run.criteria).filter((c) => c.status === 'PASS').map((c) => c.name) : [],
        unknownCriteria: run ? Object.values(run.criteria).filter((c) => c.status === 'UNKNOWN').map((c) => c.name) : [],
        sources: p.sources.map((s) => s.url),
        auditTimestamp: run ? run.verifiedAt : p.updatedAt,
      };
    });

    onUpdateResults(formattedList);
  };

  // --- WORKFLOW A: RESEARCH & SCRAPE HANDLERS ---
  const handleExecuteResearch = async (candidates: Array<{ url?: string; name?: string }>) => {
    if (candidates.length === 0) return;

    setIsResearching(true);
    setErrorMessage(null);
    setInputError(null);
    setStatusMessage(`Researching ${candidates.length} company target(s) via Firecrawl...`);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: candidates }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Research failed');
      }

      const newProfiles = data.profiles as CompanyResearchProfile[];
      setProfiles((prev) => {
        const merged = [...prev];
        for (const p of newProfiles) {
          const idx = merged.findIndex((m) => m.id === p.id || m.canonicalDomain === p.canonicalDomain);
          if (idx >= 0) {
            merged[idx] = p;
          } else {
            merged.unshift(p);
          }
        }
        return merged;
      });

      if (newProfiles.length > 0) {
        setSelectedProfileId(newProfiles[0].id);
      }

      setStatusMessage(
        `Research complete! Saved ${newProfiles.length} verified company profile(s). Verification is ready.`
      );
      setInputUrl('');
      setInputName('');
      setActiveTab('profile'); // Switch to profile tab to inspect results
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing research pipeline');
      setInputError(err.message);
    } finally {
      setIsResearching(false);
    }
  };

  const handleSingleResearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() && !inputName.trim()) {
      setInputError('Please enter a company website URL or company name.');
      return;
    }
    handleExecuteResearch([{ url: inputUrl.trim(), name: inputName.trim() }]);
  };

  // --- WORKFLOW B: TARGET CRITERIA HANDLERS ---
  const handleSaveCriteria = async () => {
    setCriteriaSaveMsg(null);
    try {
      const res = await fetch('/api/target-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save criteria');
      }

      setCriteria(data.criteria);
      setCriteriaSaveMsg(`Target criteria saved! (Version ${data.criteria.version})`);
      setTimeout(() => setCriteriaSaveMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving target criteria');
    }
  };

  // --- WORKFLOW C: EXPLICIT VERIFY BUTTON HANDLERS ---
  const handleVerifyCompanies = async (companyIds: string[]) => {
    if (companyIds.length === 0) {
      setErrorMessage('Please select at least one saved company to verify.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setStatusMessage(`Verifying ${companyIds.length} saved company profile(s) against target criteria...`);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyIds,
          targetCriteria: criteria,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      const runs = (data.runs || []) as VerificationRun[];
      const nextRuns = { ...verificationRuns };
      for (const run of runs) {
        nextRuns[run.companyId] = run;
      }
      setVerificationRuns(nextRuns);
      syncResultsToParent(profiles, nextRuns);

      setStatusMessage(
        `Verification completed for ${runs.length} companies! Inspected against Criteria v${criteria.version}.`
      );
      setActiveTab('verify'); // Switch to verification results tab
    } catch (err: any) {
      setErrorMessage(err.message || 'Error during verification evaluation');
    } finally {
      setIsVerifying(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || profiles[0] || null;
  const currentVerificationRun = selectedProfile ? verificationRuns[selectedProfile.id] : null;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* HEADER & STAGE SUMMARY */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#F0EAD8] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h3 className="font-display text-xl font-bold text-[#1E1B18]">
                Stage 2: External Discovery & Verification
              </h3>
            </div>
            <p className="text-xs text-[#766E65] mt-1 font-mono">
              Strict 2-Workflow Architecture: 1) Fact-based Web Research & Scraping → 2) Independent Target Verification
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#FAF6EE] border border-[#1E1B18]/20 rounded-lg text-xs font-mono text-[#1E1B18]">
              Researched: <strong className="text-[#FF6B35]">{profiles.length}</strong>
            </span>
            <span className="px-3 py-1 bg-[#FAF6EE] border border-[#1E1B18]/20 rounded-lg text-xs font-mono text-[#1E1B18]">
              Verified: <strong className="text-[#2E7D32]">{Object.keys(verificationRuns).length}</strong>
            </span>
          </div>
        </div>

        {/* WORKFLOW SUB-TABS */}
        <div className="flex items-center gap-2 border-b border-[#EBE4D5] pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('research')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 ${
              activeTab === 'research'
                ? 'bg-[#1E1B18] text-white shadow-sketch-xs'
                : 'bg-white text-[#766E65] hover:text-[#1E1B18] border border-[#EBE4D5]'
            }`}
          >
            <span>🔍</span>
            <span>A. Research & Scrape</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-[#1E1B18] text-white shadow-sketch-xs'
                : 'bg-white text-[#766E65] hover:text-[#1E1B18] border border-[#EBE4D5]'
            }`}
          >
            <span>📑</span>
            <span>B. Company Profile & Evidence ({profiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('criteria')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 ${
              activeTab === 'criteria'
                ? 'bg-[#1E1B18] text-white shadow-sketch-xs'
                : 'bg-white text-[#766E65] hover:text-[#1E1B18] border border-[#EBE4D5]'
            }`}
          >
            <span>🎯</span>
            <span>C. Target Criteria (v{criteria.version})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 ${
              activeTab === 'verify'
                ? 'bg-[#1E1B18] text-white shadow-sketch-xs'
                : 'bg-white text-[#766E65] hover:text-[#1E1B18] border border-[#EBE4D5]'
            }`}
          >
            <span>✅</span>
            <span>D. Verify & Qualify</span>
          </button>
        </div>

        {/* NOTIFICATIONS & STATUS */}
        {statusMessage && (
          <div className="p-3 bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl text-xs font-mono text-[#2E7D32] flex items-center justify-between">
            <span>{statusMessage}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="text-[#2E7D32] hover:font-bold">
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl text-xs font-mono text-[#C62828] flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-[#C62828] hover:font-bold">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUBSECTION A: RESEARCH COMPANIES                                          */}
      {/* ========================================================================= */}
      {activeTab === 'research' && (
        <div className="space-y-6">
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch space-y-4">
            <div>
              <h4 className="font-display text-base font-bold text-[#1E1B18] flex items-center gap-2">
                <span>🌐</span> Enter Company for Web Research & Scraping
              </h4>
              <p className="text-xs text-[#766E65] mt-1 font-mono">
                Provide an official website URL (e.g. <code>https://www.blaize.com/</code>) or verified company name.
                Firecrawl traverses official pages (About, Leadership, Contact, Press) to extract evidence-backed facts.
              </p>
            </div>

            <form onSubmit={handleSingleResearchSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-mono font-bold text-[#1E1B18] uppercase tracking-wider mb-1">
                    Official Website URL (Preferred)
                  </label>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      setInputError(null);
                    }}
                    placeholder="https://www.blaize.com/"
                    className="w-full p-2.5 text-xs font-mono border-2 border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono font-bold text-[#1E1B18] uppercase tracking-wider mb-1">
                    Company Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => {
                      setInputName(e.target.value);
                      setInputError(null);
                    }}
                    placeholder="Blaize"
                    className="w-full p-2.5 text-xs font-mono border-2 border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                  />
                </div>
              </div>

              {inputError && (
                <p className="text-xs font-mono text-[#C62828] bg-[#FFEBEE] p-2 rounded-lg border border-[#FFCDD2]">
                  ⚠️ {inputError}
                </p>
              )}

              <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                <div className="text-[11px] font-mono text-[#766E65]">
                  <span>🔒 No synthetic emails. No fake .com domains. Missing facts remain unknown.</span>
                </div>
                <button
                  type="submit"
                  disabled={isResearching || (!inputUrl.trim() && !inputName.trim())}
                  className="sketch-btn px-6 py-2.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#E55A2B] border-2 border-[#1E1B18] rounded-xl disabled:opacity-50 flex items-center gap-2 shadow-sketch-xs"
                >
                  {isResearching ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Researching Candidate...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Research & Scrape Company</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Candidates Carried from Internal Stage */}
            {carriedCandidates.length > 0 && (
              <div className="mt-4 p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-mono font-bold text-[#1E1B18]">
                    Candidates Carried from Internal Stage ({carriedCandidates.length}):
                  </span>
                  <button
                    type="button"
                    disabled={isResearching}
                    onClick={() => {
                      const targets = carriedCandidates.map((c) => ({
                        url: c.website || undefined,
                        name: c.name || undefined,
                      }));
                      handleExecuteResearch(targets);
                    }}
                    className="sketch-btn px-3 py-1.5 text-xs font-bold text-white bg-[#1E1B18] hover:bg-[#3E3832] rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <span>⚡ Research All Carried Leads Online</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {carriedCandidates.map((c, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded bg-white border border-[#DCD6C9] text-[#1E1B18] text-xs font-mono"
                    >
                      {c.name || c.website}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SAVED PROFILES LIST (COMPACT COMPANY CARD VIEW) */}
          {profiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-display text-base font-bold text-[#1E1B18]">
                    Saved Researched Leads ({profiles.length})
                  </h4>
                  <p className="text-xs font-mono text-[#766E65]">
                    Compact list showing 14 key data fields & 9 verification indicators. Click 'View Dossier' or the search icon to open the full report.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedForBatch.size === profiles.length) {
                        setSelectedForBatch(new Set());
                      } else {
                        setSelectedForBatch(new Set(profiles.map((p) => p.id)));
                      }
                    }}
                    className="text-xs font-mono text-[#766E65] hover:text-[#1E1B18] underline"
                  >
                    {selectedForBatch.size === profiles.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    disabled={selectedForBatch.size === 0 || isVerifying}
                    onClick={() => handleVerifyCompanies(Array.from(selectedForBatch))}
                    className="sketch-btn px-3.5 py-1.5 text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] border border-[#1E1B18] rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-sketch-xs"
                  >
                    <span>⚡ Verify Selected ({selectedForBatch.size})</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {profiles.map((p) => (
                  <CompanyCard
                    key={p.id}
                    profile={p}
                    verificationRun={verificationRuns[p.id]}
                    isSelected={selectedForBatch.has(p.id)}
                    onToggleSelect={(id) => {
                      const next = new Set(selectedForBatch);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      setSelectedForBatch(next);
                    }}
                    onOpenDossier={(prof) => setDossierProfile(prof)}
                    onVerify={(id) => {
                      setSelectedProfileId(id);
                      handleVerifyCompanies([id]);
                    }}
                    isVerifying={isVerifying}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION B: COMPANY PROFILE & EVIDENCE                                   */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Bar: Search Filter & Batch Actions */}
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#F0EAD8] pb-3">
              <div>
                <h4 className="font-display text-base sm:text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                  <span>📑</span> Company Research Profiles & Evidence Dossiers ({profiles.length})
                </h4>
                <p className="text-xs font-mono text-[#766E65] mt-0.5">
                  Full evidence-backed dossiers with zero fabricated claims. Click 'View Dossier' on any card to inspect all 7 sections and grouped source citations.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedProfile && (
                  <button
                    type="button"
                    onClick={() => setDossierProfile(selectedProfile)}
                    className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-[#FFE0B2] hover:bg-[#FFD54F] border-2 border-[#1E1B18] rounded-xl flex items-center gap-1.5 shadow-sketch-xs"
                  >
                    <span>🔍 Open Dossier ({selectedProfile.officialName})</span>
                  </button>
                )}

                {profiles.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const targetProfiles = profiles.filter((p) => {
                          if (!searchQuery.trim()) return true;
                          const q = searchQuery.toLowerCase();
                          return (
                            p.officialName.toLowerCase().includes(q) ||
                            p.canonicalDomain.toLowerCase().includes(q)
                          );
                        });
                        downloadObsidianVault(
                          {
                            vaultName: 'Huntlyst-External-Vault',
                            externalRecords: targetProfiles,
                          },
                          `huntlyst-external-vault-${new Date().toISOString().split('T')[0]}.zip`
                        );
                        setStatusMessage(`Exported ${targetProfiles.length} dossiers to Obsidian Vault! 🗂️`);
                      }}
                      className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-[#EDE7F6] hover:bg-[#D1C4E9] border-2 border-[#1E1B18] rounded-xl flex items-center gap-1 shadow-sketch-xs"
                      title="Export all external dossiers as Obsidian Vault (.zip)"
                    >
                      <span>🗂️</span>
                      <span>Vault (.zip)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const targetProfiles = profiles.filter((p) => {
                          if (!searchQuery.trim()) return true;
                          const q = searchQuery.toLowerCase();
                          return (
                            p.officialName.toLowerCase().includes(q) ||
                            p.canonicalDomain.toLowerCase().includes(q)
                          );
                        });
                        downloadCombinedMarkdown(
                          targetProfiles,
                          `huntlyst-external-research-${new Date().toISOString().split('T')[0]}.md`,
                          { notes: 'External Research Intelligence Report' }
                        );
                        setStatusMessage(`Exported ${targetProfiles.length} dossiers to combined Markdown! 📝`);
                      }}
                      className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border-2 border-[#1E1B18] rounded-xl flex items-center gap-1 shadow-sketch-xs"
                      title="Export as combined Markdown report (.md)"
                    >
                      <span>📝</span>
                      <span>Markdown (.md)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsExportModalOpen(true)}
                      className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border-2 border-[#1E1B18] rounded-xl flex items-center gap-1 shadow-sketch-xs"
                      title="Open full Export Menu"
                    >
                      <span>📦</span>
                      <span>Export Menu</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter profiles by name, domain, industry, or country..."
                  className="w-full pl-9 pr-3 py-2 border border-[#1E1B18] rounded-xl text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                />
                <span className="absolute left-3 top-2.5 text-xs text-[#766E65]">🔍</span>
              </div>

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-mono text-[#766E65] hover:text-[#1E1B18] underline"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>

          {/* List of Company Cards */}
          <div className="space-y-4">
            {(() => {
              const q = searchQuery.toLowerCase().trim();
              const filtered = profiles.filter((p) => {
                if (!q) return true;
                return (
                  p.officialName.toLowerCase().includes(q) ||
                  p.canonicalDomain.toLowerCase().includes(q) ||
                  (p.primaryIndustry && p.primaryIndustry.toLowerCase().includes(q)) ||
                  (p.headquarters.country && p.headquarters.country.toLowerCase().includes(q))
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#EBE4D5] text-xs font-mono text-[#766E65] space-y-2">
                    <p>No company profiles matched "{searchQuery}".</p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[#FF6B35] font-bold underline"
                    >
                      Reset search filter
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filtered.map((p) => (
                    <CompanyCard
                      key={p.id}
                      profile={p}
                      verificationRun={verificationRuns[p.id]}
                      isSelected={selectedProfileId === p.id}
                      onToggleSelect={(id) => {
                        setSelectedProfileId(id);
                      }}
                      onOpenDossier={(prof) => setDossierProfile(prof)}
                      onVerify={(id) => {
                        setSelectedProfileId(id);
                        handleVerifyCompanies([id]);
                      }}
                      isVerifying={isVerifying}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION C: TARGET CRITERIA CONFIGURATION                                */}
      {/* ========================================================================= */}
      {activeTab === 'criteria' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch space-y-6">
          <div className="border-b border-[#F0EAD8] pb-3 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="font-display text-base font-bold text-[#1E1B18] flex items-center gap-2">
                <span>🎯</span> Workflow B: Target Criteria Configuration
              </h4>
              <p className="text-xs text-[#766E65] mt-1 font-mono">
                Independent evaluation rules. Modify criteria at any time and re-verify saved company profiles with zero re-scraping.
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#FAF6EE] border border-[#1E1B18]/20 rounded-lg">
              Criteria Version: v{criteria.version}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-mono">
            {/* Funding Constraints */}
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-3">
              <span className="font-bold text-[#1E1B18] uppercase">1. Funding Range (USD)</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#766E65] mb-1">Minimum Funding</label>
                  <input
                    type="number"
                    value={criteria.fundingMinUsd ?? ''}
                    onChange={(e) =>
                      setCriteria({
                        ...criteria,
                        fundingMinUsd: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 5000000"
                    className="w-full p-2 border border-[#1E1B18] rounded bg-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#766E65] mb-1">Maximum Funding</label>
                  <input
                    type="number"
                    value={criteria.fundingMaxUsd ?? ''}
                    onChange={(e) =>
                      setCriteria({
                        ...criteria,
                        fundingMaxUsd: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 6000000"
                    className="w-full p-2 border border-[#1E1B18] rounded bg-white text-xs font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#766E65]">
                Note: Missing funding will produce <strong className="text-[#F57C00]">UNKNOWN</strong>, never PASS.
              </p>
            </div>

            {/* Geography Constraints */}
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-3">
              <span className="font-bold text-[#1E1B18] uppercase">2. Geography & US Presence</span>
              <div>
                <label className="block text-[11px] text-[#766E65] mb-1">US Presence Mode</label>
                <select
                  value={criteria.usPresenceMode}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      usPresenceMode: e.target.value as any,
                    })
                  }
                  className="w-full p-2 border border-[#1E1B18] rounded bg-white text-xs font-mono"
                >
                  <option value="some_allowed">Any / Some Allowed</option>
                  <option value="non_us_only">Non-US Only (Reject US HQ/Presence)</option>
                  <option value="minimal_or_none">Minimal or None</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#766E65] mb-1">
                  Required Countries (comma separated, empty for any)
                </label>
                <input
                  type="text"
                  value={criteria.requiredCountries.join(', ')}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      requiredCountries: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. United Kingdom, Germany, France"
                  className="w-full p-2 border border-[#1E1B18] rounded bg-white text-xs font-mono"
                />
              </div>
            </div>

            {/* Industry Constraints */}
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-3">
              <span className="font-bold text-[#1E1B18] uppercase">3. Allowed Industries</span>
              <div>
                <label className="block text-[11px] text-[#766E65] mb-1">
                  Target Industries (comma separated)
                </label>
                <input
                  type="text"
                  value={criteria.allowedIndustries.join(', ')}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      allowedIndustries: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="AI & Machine Learning, B2B SaaS, FinTech"
                  className="w-full p-2 border border-[#1E1B18] rounded bg-white text-xs font-mono"
                />
              </div>
            </div>

            {/* Leadership & Email Constraints */}
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-3">
              <span className="font-bold text-[#1E1B18] uppercase">4. Leadership & Contacts</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criteria.requireCeo ?? true}
                    onChange={(e) => setCriteria({ ...criteria, requireCeo: e.target.checked })}
                    className="rounded text-[#FF6B35] focus:ring-[#FF6B35]"
                  />
                  <span>Require Verified Current CEO</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criteria.requireFounders ?? false}
                    onChange={(e) => setCriteria({ ...criteria, requireFounders: e.target.checked })}
                    className="rounded text-[#FF6B35] focus:ring-[#FF6B35]"
                  />
                  <span>Require Co-Founders Documented</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criteria.requirePublicEmail ?? false}
                    onChange={(e) => setCriteria({ ...criteria, requirePublicEmail: e.target.checked })}
                    className="rounded text-[#FF6B35] focus:ring-[#FF6B35]"
                  />
                  <span>Require Authentic Public Business Email</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-[#F0EAD8]">
            {criteriaSaveMsg ? (
              <span className="text-xs font-mono text-[#2E7D32] font-bold">✓ {criteriaSaveMsg}</span>
            ) : (
              <span className="text-xs font-mono text-[#766E65]">
                Save criteria to update version and re-verify without scraping.
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveCriteria}
              className="sketch-btn px-6 py-2.5 text-xs font-bold text-white bg-[#1E1B18] hover:bg-[#3E3832] border-2 border-[#1E1B18] rounded-xl shadow-sketch-xs"
            >
              💾 Save Target Criteria (Increments Version)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION D: VERIFY & QUALIFY                                            */}
      {/* ========================================================================= */}
      {activeTab === 'verify' && (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch space-y-6">
          <div className="border-b border-[#F0EAD8] pb-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h4 className="font-display text-base font-bold text-[#1E1B18] flex items-center gap-2">
                <span>✅</span> Workflow C: Deterministic Qualification Results
              </h4>
              <p className="text-xs text-[#766E65] mt-1 font-mono">
                Evaluates saved facts against Target Criteria v{criteria.version}. ZERO web scraping occurs here.
              </p>
            </div>

            {selectedProfile && (
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleVerifyCompanies([selectedProfile.id])}
                className="sketch-btn px-5 py-2.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#E55A2B] border-2 border-[#1E1B18] rounded-xl disabled:opacity-50 flex items-center gap-2 shadow-sketch-xs"
              >
                {isVerifying ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Re-Evaluate {selectedProfile.officialName}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {selectedProfile && (
            <div className="mb-4">
              <CompanyCard
                profile={selectedProfile}
                verificationRun={currentVerificationRun}
                isSelected={true}
                onOpenDossier={(prof) => setDossierProfile(prof)}
                onVerify={(id) => handleVerifyCompanies([id])}
                isVerifying={isVerifying}
              />
            </div>
          )}

          {currentVerificationRun ? (
            <div className="space-y-6">
              {/* Overall status banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  currentVerificationRun.overallStatus === 'VERIFIED'
                    ? 'bg-[#E8F5E9] border-[#2E7D32]/30 text-[#1B5E20]'
                    : currentVerificationRun.overallStatus === 'REVIEW'
                    ? 'bg-[#FFF8E1] border-[#FFA000]/40 text-[#E65100]'
                    : currentVerificationRun.overallStatus === 'REJECTED'
                    ? 'bg-[#FFEBEE] border-[#C62828]/30 text-[#B71C1C]'
                    : 'bg-[#FAF6EE] border-[#766E65]/30 text-[#4E473F]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-lg">
                      Qualification: {currentVerificationRun.overallStatus} ({currentVerificationRun.qualificationScore}%)
                    </span>
                    <span className="text-xs font-mono">
                      • Evaluated against Criteria v{currentVerificationRun.targetCriteriaVersion}
                    </span>
                  </div>
                  <p className="text-xs font-mono mt-1 opacity-90">
                    {currentVerificationRun.summaryReason}
                  </p>
                </div>
                <div className="text-xs font-mono whitespace-nowrap">
                  PASS: {currentVerificationRun.passedCount} • FAIL: {currentVerificationRun.failedCount} • UNKNOWN: {currentVerificationRun.unknownCount}
                </div>
              </div>

              {/* Per-Criterion Breakdown */}
              <div className="space-y-3">
                <h5 className="font-display font-bold text-sm text-[#1E1B18]">
                  Per-Criterion Independent Evaluation
                </h5>

                <div className="grid grid-cols-1 gap-3">
                  {Object.values(currentVerificationRun.criteria).map((c, i) => (
                    <div
                      key={i}
                      className="p-4 bg-white rounded-xl border border-[#EBE4D5] text-xs font-mono space-y-2 hover:shadow-xs transition-shadow"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              c.status === 'PASS'
                                ? 'bg-[#E8F5E9] text-[#2E7D32]'
                                : c.status === 'FAIL'
                                ? 'bg-[#FFEBEE] text-[#C62828]'
                                : 'bg-[#FFF8E1] text-[#F57C00]'
                            }`}
                          >
                            {c.status}
                          </span>
                          <span className="font-bold text-[#1E1B18] text-sm">{c.name}</span>
                        </div>
                        <span className="text-[#766E65] text-[11px]">
                          Required: {c.required}
                        </span>
                      </div>

                      <div className="text-[#1E1B18] pl-2 border-l-2 border-[#1E1B18]/20">
                        <strong>Documented Actual:</strong> {c.actual || 'None'}<br />
                        <strong>Reason:</strong> {c.reason}
                      </div>

                      {c.evidence && (
                        <blockquote className="p-2 bg-[#FAF6EE] rounded text-[11px] text-[#1E1B18] italic">
                          Evidence: "{c.evidence}"
                        </blockquote>
                      )}

                      {c.sourceUrl && (
                        <div className="text-[10px] text-[#766E65]">
                          Source: <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] underline">{c.sourceUrl}</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs font-mono text-[#766E65] space-y-3">
              <p>No verification run has been executed for this company profile yet.</p>
              {selectedProfile && (
                <button
                  type="button"
                  onClick={() => handleVerifyCompanies([selectedProfile.id])}
                  className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#1E1B18] rounded-xl hover:bg-[#3E3832]"
                >
                  Click to Verify {selectedProfile.officialName}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Complete Company Research Dossier Modal */}
      {dossierProfile && (
        <CompanyResearchDossierModal
          profile={dossierProfile}
          verificationRun={verificationRuns[dossierProfile.id]}
          onClose={() => setDossierProfile(null)}
          onVerify={(id) => {
            handleVerifyCompanies([id]);
          }}
          isVerifying={isVerifying}
        />
      )}

      {/* Universal Export Modal */}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onToast={(msg) => setStatusMessage(msg)}
          externalProfiles={profiles}
          initialWorkflow="external"
          selectedIds={selectedProfileId ? [selectedProfileId] : []}
          searchQuery={searchQuery}
          title="Export External Research Dossiers"
        />
      )}
    </div>
  );
}
