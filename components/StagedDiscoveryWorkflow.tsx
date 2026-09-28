'use client';

import React, { useState, useEffect } from 'react';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE, formatTargetSummary } from '@/lib/targetProfileData';
import { CompanyVerificationResult, PipelineStageName } from '@/providers/types';
import { CompanyRecord, RejectedCompanyRecord, HuntConfig } from '@/lib/types';
import CandidateVerificationCard from './CandidateVerificationCard';
import HuntConfiguration from './HuntConfiguration';

interface StagedDiscoveryWorkflowProps {
  initialTargetProfile?: TargetProfile;
  onFinalizeResults: (qualifiedCompanies: CompanyRecord[], rejectedCompanies: RejectedCompanyRecord[]) => void;
  onOpenLeadModal?: (company: CompanyRecord) => void;
}

type StageStep = 'internal' | 'external' | 'web_search';
type SourceStatus = 'idle' | 'running' | 'completed' | 'approved';

export default function StagedDiscoveryWorkflow({
  initialTargetProfile = DEFAULT_TVB_TARGET_PROFILE,
  onFinalizeResults,
  onOpenLeadModal,
}: StagedDiscoveryWorkflowProps) {
  // Target Configuration State
  const [targetProfile, setTargetProfile] = useState<TargetProfile>(initialTargetProfile);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Workflow Active View Step
  const [currentStep, setCurrentStep] = useState<StageStep>('internal');

  // Independent Source Status Tracking
  const [internalStatus, setInternalStatus] = useState<SourceStatus>('idle');
  const [externalStatus, setExternalStatus] = useState<SourceStatus>('idle');
  const [webStatus, setWebStatus] = useState<SourceStatus>('idle');

  // General Status & Error
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetryingCandidate, setIsRetryingCandidate] = useState(false);

  // Internal Stage State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  const [internalResults, setInternalResults] = useState<CompanyVerificationResult[]>([]);
  const [internalApproved, setInternalApproved] = useState<Set<string>>(new Set());
  const [internalStats, setInternalStats] = useState<{
    totalReceived: number;
    totalProcessed: number;
    qualified: number;
    rejected: number;
    partiallyVerified: number;
    review: number;
    unverified: number;
    errors: number;
  } | null>(null);
  const [internalProgress, setInternalProgress] = useState<{ current: number; total: number } | null>(null);

  // External Stage State
  const [externalInputName, setExternalInputName] = useState('');
  const [externalInputWebsite, setExternalInputWebsite] = useState('');
  const [externalResults, setExternalResults] = useState<CompanyVerificationResult[]>([]);
  const [externalApproved, setExternalApproved] = useState<Set<string>>(new Set());

  // Web Search Stage State
  const [webSearchResults, setWebSearchResults] = useState<CompanyVerificationResult[]>([]);
  const [webSearchApproved, setWebSearchApproved] = useState<Set<string>>(new Set());

  // Result Filtering Tab
  const [activeTab, setActiveTab] = useState<'all' | 'qualified' | 'partial' | 'review' | 'unverified' | 'rejected' | 'error'>('all');

  // Reset temporary staged session (Section 21)
  const handleClearStagedSession = () => {
    if (confirm('Clear current staged discovery session? Permanent saved leads and history will remain intact.')) {
      setInternalStatus('idle');
      setExternalStatus('idle');
      setWebStatus('idle');
      setInternalResults([]);
      setInternalApproved(new Set());
      setInternalStats(null);
      setInternalProgress(null);
      setExternalResults([]);
      setExternalApproved(new Set());
      setWebSearchResults([]);
      setWebSearchApproved(new Set());
      setSelectedFile(null);
      setManualText('');
      setStatusMessage('');
      setErrorMessage(null);
      setCurrentStep('internal');
    }
  };

  // --- INTERNAL STAGE HANDLERS ---
  const handleInternalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRunInternalDiscovery = async () => {
    if (!selectedFile && !manualText.trim()) {
      setErrorMessage('Please upload a document (CSV, XLSX, PDF, DOCX, TXT, JSON) or paste candidate text.');
      return;
    }

    setErrorMessage(null);
    setInternalStatus('running');
    setInternalProgress(null);
    setStatusMessage('Parsing candidates and starting Huntlyst 6-stage verification...');

    try {
      let response: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('targetProfile', JSON.stringify(targetProfile));

        setStatusMessage(`Processing "${selectedFile.name}" with Huntlyst Pipeline...`);
        response = await fetch('/api/discovery/internal?stream=true', {
          method: 'POST',
          body: formData,
        });
      } else {
        setStatusMessage('Processing candidate text with Huntlyst Pipeline...');
        response = await fetch('/api/discovery/internal?stream=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: manualText, targetProfile }),
        });
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Internal discovery failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamResults: CompanyVerificationResult[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const evText of events) {
            const trimmed = evText.trim();
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === 'start') {
                setInternalProgress({ current: 0, total: event.totalReceived });
                setStatusMessage(`Processing candidates... 0 / ${event.totalReceived}`);
              } else if (event.type === 'progress') {
                setInternalProgress({ current: event.current, total: event.total });
                setStatusMessage(`Processing candidates... ${event.current} / ${event.total}`);
                if (event.result) {
                  streamResults = [...streamResults, event.result];
                  setInternalResults([...streamResults]);
                }
                if (event.stats) {
                  setInternalStats(event.stats);
                }
              } else if (event.type === 'complete') {
                const finalResults = event.results || streamResults;
                setInternalResults(finalResults);
                setInternalProgress({ current: event.totalProcessed, total: event.totalReceived });
                setStatusMessage(`${event.totalProcessed} / ${event.totalReceived} candidates fully verified`);
                setInternalStats(event.stats);

                const initialApproved = new Set<string>();
                finalResults.forEach((r: CompanyVerificationResult) => {
                  if (r.verificationStatus === 'QUALIFIED' || r.verificationStatus === 'PARTIALLY_VERIFIED') {
                    initialApproved.add(r.company.name);
                  }
                });
                setInternalApproved(initialApproved);
                setInternalStatus('completed');
              }
            } catch (err) {
              console.warn('[StreamParse]', err);
            }
          }
        }
      } else {
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Internal discovery failed');
        }

        const results = data.results || [];
        setInternalResults(results);

        const initialApproved = new Set<string>();
        results.forEach((r: CompanyVerificationResult) => {
          if (r.verificationStatus === 'QUALIFIED' || r.verificationStatus === 'PARTIALLY_VERIFIED') {
            initialApproved.add(r.company.name);
          }
        });
        setInternalApproved(initialApproved);
        if (data.stats) setInternalStats(data.stats);
        setInternalStatus('completed');
        setStatusMessage(`${results.length} candidates fully verified`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing internal discovery');
      setInternalStatus('idle');
    }
  };

  const toggleInternalApproval = (name: string) => {
    const next = new Set(internalApproved);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setInternalApproved(next);
  };

  // APPROVAL GATE 1: Internal -> External
  // PERSISTENT: Marks internalStatus as 'approved', does NOT re-run internal!
  const handleApproveInternalToExternal = () => {
    if (internalApproved.size === 0 && internalResults.length > 0) {
      if (!confirm('You have 0 approved candidates selected. Do you want to proceed to External Discovery anyway?')) {
        return;
      }
    }
    setInternalStatus('approved');
    setCurrentStep('external');
  };

  // --- EXTERNAL STAGE HANDLERS ---
  const handleAddExternalCompany = () => {
    if (!externalInputName.trim() && !externalInputWebsite.trim()) return;

    const newTarget = {
      name: externalInputName.trim(),
      website: externalInputWebsite.trim(),
    };

    setExternalInputName('');
    setExternalInputWebsite('');
    handleResearchExternal([newTarget]);
  };

  const handleResearchExternal = async (
    companiesToResearch: { name?: string; website?: string }[]
  ) => {
    setExternalStatus('running');
    setErrorMessage(null);
    setStatusMessage(`Researching ${companiesToResearch.length} external candidates...`);

    try {
      const response = await fetch('/api/discovery/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: companiesToResearch,
          targetProfile,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'External research failed');
      }

      const newResults = [...externalResults, ...(data.results || [])];
      setExternalResults(newResults);

      const nextApproved = new Set(externalApproved);
      (data.results || []).forEach((r: CompanyVerificationResult) => {
        if (r.verificationStatus === 'QUALIFIED' || r.verificationStatus === 'PARTIALLY_VERIFIED') {
          nextApproved.add(r.company.name);
        }
      });
      setExternalApproved(nextApproved);
      setExternalStatus('completed');
      setStatusMessage(`External research complete: ${data.results.length} companies analyzed.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error researching external companies');
      setExternalStatus('completed');
    }
  };

  const toggleExternalApproval = (name: string) => {
    const next = new Set(externalApproved);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExternalApproved(next);
  };

  // APPROVAL GATE 2: External -> Web Search
  // PERSISTENT: Marks externalStatus as 'approved', does NOT re-run external!
  const handleApproveExternalToWebSearch = () => {
    setExternalStatus('approved');
    setCurrentStep('web_search');
  };

  // --- WEB SEARCH STAGE HANDLERS ---
  const handleRunWebSearch = async () => {
    setWebStatus('running');
    setErrorMessage(null);
    setStatusMessage('Searching public web using Huntlyst Web Discovery...');

    const existingDomains = [
      ...internalResults.map(r => r.company.website),
      ...externalResults.map(r => r.company.website),
    ];

    try {
      const response = await fetch('/api/discovery/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetProfile,
          excludeDomains: existingDomains,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Web discovery failed');
      }

      setWebSearchResults(data.results || []);

      const nextApproved = new Set<string>();
      (data.results || []).forEach((r: CompanyVerificationResult) => {
        if (r.verificationStatus === 'QUALIFIED' || r.verificationStatus === 'PARTIALLY_VERIFIED') {
          nextApproved.add(r.company.name);
        }
      });
      setWebSearchApproved(nextApproved);
      setWebStatus('completed');
      setStatusMessage(`Discovered and verified ${data.results?.length || 0} candidate companies.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Web search error');
      setWebStatus('completed');
    }
  };

  const toggleWebSearchApproval = (name: string) => {
    const next = new Set(webSearchApproved);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setWebSearchApproved(next);
  };

  // APPROVAL GATE 3: Final Approval -> Commit to Final Results
  const handleFinalizeAll = () => {
    const allApprovedCompanies: CompanyRecord[] = [];
    const allRejected: RejectedCompanyRecord[] = [];

    // 1. Internal approved
    for (const r of internalResults) {
      if (internalApproved.has(r.company.name)) {
        allApprovedCompanies.push(r.company);
      } else if (r.verificationStatus === 'REJECTED') {
        allRejected.push({
          name: r.company.name,
          website: r.company.website,
          industry: r.company.industry || undefined,
          fundingOrRevenue: r.company.fundingOrRevenue || undefined,
          location: r.company.country || undefined,
          founderOrCeoName: r.company.founderOrCeoName || undefined,
          rejectionReasons: [r.rejectionReason || 'Rejected at internal discovery stage'],
          matchedRules: r.passedCriteria.map(p => `✓ ${p}`),
          failedRules: r.failedCriteria.map(f => `✗ ${f}`),
          sourceEvidence: r.sources.join(', '),
        });
      }
    }

    // 2. External approved
    for (const r of externalResults) {
      if (externalApproved.has(r.company.name)) {
        allApprovedCompanies.push(r.company);
      } else if (r.verificationStatus === 'REJECTED') {
        allRejected.push({
          name: r.company.name,
          website: r.company.website,
          industry: r.company.industry || undefined,
          fundingOrRevenue: r.company.fundingOrRevenue || undefined,
          location: r.company.country || undefined,
          founderOrCeoName: r.company.founderOrCeoName || undefined,
          rejectionReasons: [r.rejectionReason || 'Rejected at external discovery stage'],
          matchedRules: r.passedCriteria.map(p => `✓ ${p}`),
          failedRules: r.failedCriteria.map(f => `✗ ${f}`),
          sourceEvidence: r.sources.join(', '),
        });
      }
    }

    // 3. Web Search approved
    for (const r of webSearchResults) {
      if (webSearchApproved.has(r.company.name)) {
        allApprovedCompanies.push(r.company);
      } else if (r.verificationStatus === 'REJECTED') {
        allRejected.push({
          name: r.company.name,
          website: r.company.website,
          industry: r.company.industry || undefined,
          fundingOrRevenue: r.company.fundingOrRevenue || undefined,
          location: r.company.country || undefined,
          founderOrCeoName: r.company.founderOrCeoName || undefined,
          rejectionReasons: [r.rejectionReason || 'Rejected at web search stage'],
          matchedRules: r.passedCriteria.map(p => `✓ ${p}`),
          failedRules: r.failedCriteria.map(f => `✗ ${f}`),
          sourceEvidence: r.sources.join(', '),
        });
      }
    }

    // Deduplicate by domain/website or name
    const seen = new Set<string>();
    const uniqueApproved = allApprovedCompanies.filter(c => {
      const key = (c.website || c.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    onFinalizeResults(uniqueApproved, allRejected);
  };

  // INDEPENDENT STAGE RETRY HANDLER (Section 11)
  const handleRetryCandidateStage = async (
    candidateResult: CompanyVerificationResult,
    stage: PipelineStageName
  ) => {
    setIsRetryingCandidate(true);
    setStatusMessage(`Retrying stage "${stage}" for ${candidateResult.company.name}...`);

    try {
      const response = await fetch('/api/discovery/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateResult,
          stage,
          targetProfile,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Retry failed');
      }

      const updated = data.result as CompanyVerificationResult;

      // Update candidate in current step's results list
      if (currentStep === 'internal') {
        setInternalResults(prev => prev.map(c => c.company.name === updated.company.name ? updated : c));
      } else if (currentStep === 'external') {
        setExternalResults(prev => prev.map(c => c.company.name === updated.company.name ? updated : c));
      } else {
        setWebSearchResults(prev => prev.map(c => c.company.name === updated.company.name ? updated : c));
      }

      setStatusMessage(`Stage "${stage}" retry complete for ${updated.company.name}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Stage retry error');
    } finally {
      setIsRetryingCandidate(false);
    }
  };

  // Filter results
  const filterList = (items: CompanyVerificationResult[]) => {
    switch (activeTab) {
      case 'qualified':
        return items.filter(i => i.verificationStatus === 'QUALIFIED');
      case 'partial':
        return items.filter(i => i.verificationStatus === 'PARTIALLY_VERIFIED');
      case 'review':
        return items.filter(i => i.verificationStatus === 'REVIEW');
      case 'unverified':
        return items.filter(i => i.verificationStatus === 'UNVERIFIED');
      case 'rejected':
        return items.filter(i => i.verificationStatus === 'REJECTED');
      case 'error':
        return items.filter(i => i.verificationStatus === 'ERROR');
      default:
        return items;
    }
  };

  const isCurrentProcessing =
    (currentStep === 'internal' && internalStatus === 'running') ||
    (currentStep === 'external' && externalStatus === 'running') ||
    (currentStep === 'web_search' && webStatus === 'running') ||
    isRetryingCandidate;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* 🎯 Target Profile Header & Customization Ribbon */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 border-2 border-[#1E1B18] shadow-sketch-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1E1B18]">
                Staged Discovery Desk
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FAF6EE] border border-[#1E1B18] text-[#1E1B18] font-bold">
                Deterministic 6-Stage Engine
              </span>
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              {formatTargetSummary(targetProfile)}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              type="button"
              onClick={handleClearStagedSession}
              className="px-3 py-2 text-xs font-mono text-[#766E65] hover:text-[#C62828] bg-white border border-[#DCD6C9] rounded-xl hover:bg-[#FFEBEE]"
              title="Reset temporary staged discovery session"
            >
              Reset Session
            </button>
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="sketch-btn px-4 py-2 text-xs font-bold text-[#1E1B18] bg-[#FAF6EE] border-2 border-[#1E1B18] rounded-xl hover:bg-white shadow-sketch-sm flex items-center gap-1.5"
            >
              <span>⚙️</span> Customize Target Profile
            </button>
          </div>
        </div>

        {/* Target Profile Tags Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4 pt-3 border-t border-[#F0EAD8] text-xs font-mono">
          <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
            <span className="text-[9px] text-[#766E65] uppercase block font-bold">Funding Target</span>
            <span className="text-[#FF6B35] font-bold truncate block">
              {targetProfile.fundingCurrency} {(targetProfile.fundingMin / 1e6).toFixed(1)}M–{(targetProfile.fundingMax / 1e6).toFixed(1)}M
            </span>
          </div>
          <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
            <span className="text-[9px] text-[#766E65] uppercase block font-bold">Industry</span>
            <span className="text-[#1E1B18] font-bold truncate block">
              {targetProfile.industries.slice(0, 2).join(', ') || 'Any'}
            </span>
          </div>
          <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
            <span className="text-[9px] text-[#766E65] uppercase block font-bold">Geography</span>
            <span className="text-[#1E1B18] font-bold truncate block">
              {targetProfile.countries.length > 0 ? targetProfile.countries.join(', ') : (targetProfile.regions.join(', ') || 'Global')}
            </span>
          </div>
          <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
            <span className="text-[9px] text-[#766E65] uppercase block font-bold">US Presence</span>
            <span className="text-[#1E1B18] font-bold truncate block capitalize">
              {targetProfile.usPresenceMode.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
            <span className="text-[9px] text-[#766E65] uppercase block font-bold">Executive</span>
            <span className="text-[#1E1B18] font-bold truncate block">
              {targetProfile.contactRequirement}: CEO/Founder
            </span>
          </div>
          <div className="p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
            <span className="text-[9px] text-[#766E65] uppercase block font-bold">Pro Email</span>
            <span className="text-[#2E7D32] font-bold truncate block">
              DNS MX Verified
            </span>
          </div>
        </div>
      </div>

      {/* 🧭 Workflow Progress Tracker with Strict Persistent States */}
      <div className="paper-card bg-white rounded-2xl p-4 sm:p-5 border-2 border-[#1E1B18] shadow-sketch-sm">
        <div className="text-[11px] font-mono uppercase text-[#766E65] font-bold mb-3 flex items-center justify-between">
          <span>Staged Discovery Path (Strict Human Approval Gates)</span>
          <span>Zero False Claims • UNKNOWN ≠ FAIL</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {/* Step 1: Internal */}
          <div
            onClick={() => setCurrentStep('internal')}
            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
              currentStep === 'internal'
                ? 'border-[#FF6B35] bg-[#FFF8F5] shadow-sketch-sm font-bold text-[#1E1B18]'
                : internalStatus === 'approved'
                ? 'border-[#2E7D32] bg-[#E8F5E9]/50 text-[#1E1B18]'
                : internalResults.length > 0
                ? 'border-[#FF6B35]/50 bg-[#FFF8F5]/50 text-[#1E1B18]'
                : 'border-[#EBE4D5] bg-[#FAF6EE] text-[#766E65]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold">01 / STAGE</span>
              {internalStatus === 'approved' ? (
                <span className="text-[#2E7D32] font-bold">✓ Approved ({internalApproved.size})</span>
              ) : internalResults.length > 0 ? (
                <span className="text-[#FF6B35] font-bold">Verified ({internalResults.length})</span>
              ) : null}
            </div>
            <div className="font-display font-bold mt-1">Internal Discovery</div>
            <div className="text-[10px] text-[#766E65] font-normal">PDF, CSV, XLSX, JSON uploads</div>
          </div>

          {/* Step 2: External */}
          <div
            onClick={() => setCurrentStep('external')}
            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
              currentStep === 'external'
                ? 'border-[#FF6B35] bg-[#FFF8F5] shadow-sketch-sm font-bold text-[#1E1B18]'
                : externalStatus === 'approved'
                ? 'border-[#2E7D32] bg-[#E8F5E9]/50 text-[#1E1B18]'
                : externalResults.length > 0
                ? 'border-[#FF6B35]/50 bg-[#FFF8F5]/50 text-[#1E1B18]'
                : 'border-[#EBE4D5] bg-[#FAF6EE] text-[#766E65]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold">02 / STAGE</span>
              {externalStatus === 'approved' ? (
                <span className="text-[#2E7D32] font-bold">✓ Approved ({externalApproved.size})</span>
              ) : externalResults.length > 0 ? (
                <span className="text-[#FF6B35] font-bold">Verified ({externalResults.length})</span>
              ) : null}
            </div>
            <div className="font-display font-bold mt-1">External Discovery</div>
            <div className="text-[10px] text-[#766E65] font-normal">Company name & URL research</div>
          </div>

          {/* Step 3: Web Search */}
          <div
            onClick={() => setCurrentStep('web_search')}
            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
              currentStep === 'web_search'
                ? 'border-[#FF6B35] bg-[#FFF8F5] shadow-sketch-sm font-bold text-[#1E1B18]'
                : webStatus === 'approved'
                ? 'border-[#2E7D32] bg-[#E8F5E9]/50 text-[#1E1B18]'
                : webSearchResults.length > 0
                ? 'border-[#FF6B35]/50 bg-[#FFF8F5]/50 text-[#1E1B18]'
                : 'border-[#EBE4D5] bg-[#FAF6EE] text-[#766E65]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold">03 / STAGE</span>
              {webStatus === 'approved' ? (
                <span className="text-[#2E7D32] font-bold">✓ Approved ({webSearchApproved.size})</span>
              ) : webSearchResults.length > 0 ? (
                <span className="text-[#FF6B35] font-bold">Verified ({webSearchResults.length})</span>
              ) : null}
            </div>
            <div className="font-display font-bold mt-1">Huntlyst Web Discovery</div>
            <div className="text-[10px] text-[#766E65] font-normal">Autonomous web candidate scan</div>
          </div>

          {/* Step 4: Final Results */}
          <div
            onClick={handleFinalizeAll}
            className="p-3 rounded-xl border-2 border-dashed border-[#1E1B18] bg-[#FAF6EE] hover:bg-[#FFFDF9] cursor-pointer text-[#1E1B18] transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold">04 / FINAL</span>
              <span className="text-[#FF6B35] font-bold">
                {internalApproved.size + externalApproved.size + webSearchApproved.size} Approved
              </span>
            </div>
            <div className="font-display font-bold mt-1 text-[#FF6B35]">Results / Review →</div>
            <div className="text-[10px] text-[#766E65]">Export CSV, PDF, DOCX</div>
          </div>
        </div>
      </div>

      {/* Real Processing Progress Bar (No fake timers) */}
      {isCurrentProcessing && internalProgress && (
        <div className="p-4 bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18] space-y-2 shadow-sketch-sm">
          <div className="flex justify-between items-center text-xs font-mono font-bold">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35] animate-ping shrink-0" />
              Internal Discovery: Processing candidate pipeline...
            </span>
            <span className="text-[#FF6B35] font-bold text-sm">
              {internalProgress.current} / {internalProgress.total}
            </span>
          </div>
          <div className="w-full h-3 bg-white rounded-full border border-[#1E1B18] overflow-hidden">
            <div
              className="h-full bg-[#FF6B35] transition-all duration-300"
              style={{ width: `${Math.round((internalProgress.current / Math.max(internalProgress.total, 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Alerts */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#FF6B35]/40 text-xs font-mono text-[#1E1B18] flex items-center gap-2">
          {isCurrentProcessing ? (
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35] animate-ping shrink-0" />
          ) : (
            <span className="text-[#2E7D32] font-bold">✓</span>
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-[#FFEBEE] border border-[#C62828] text-xs font-mono text-[#C62828] flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="font-bold underline ml-2">Dismiss</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 1: INTERNAL DISCOVERY                                              */}
      {/* ========================================================================= */}
      {currentStep === 'internal' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
            <div className="border-b border-[#F0EAD8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                <span>📁</span> Stage 1: Internal Candidate Discovery & Verification
              </h3>
              <p className="text-xs text-[#766E65] mt-1 font-mono">
                Upload your candidate list (CSV, XLSX, PDF, DOCX, TXT, JSON, or previously exported Huntlyst leads). Huntlyst parses every row without arbitrary caps, preserves existing verified evidence, and verifies criteria through deterministic stages.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* File Upload Dropzone */}
              <div className="p-5 border-2 border-dashed border-[#1E1B18] rounded-xl bg-[#FAF6EE] text-center space-y-3">
                <div className="text-3xl">📄</div>
                <div>
                  <label htmlFor="file-upload" className="font-display font-bold text-sm text-[#FF6B35] hover:underline cursor-pointer">
                    Choose a document to upload
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf,.docx,.txt,.json"
                    onChange={handleInternalFileChange}
                    className="hidden"
                  />
                  <p className="text-[11px] text-[#766E65] mt-1 font-mono">
                    Supported: CSV, Excel (XLSX), PDF, DOCX, TXT, JSON (including Huntlyst exports)
                  </p>
                </div>
                {selectedFile && (
                  <div className="p-2 bg-white rounded-lg border border-[#DCD6C9] text-xs font-mono font-bold text-[#1E1B18] truncate">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Paste Text Fallback */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-[#1E1B18] block">
                  Or Paste Candidate List (Names, URLs, Text):
                </label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="e.g.&#10;Synthesized - https://synthesized.io&#10;Mindfuel - https://mindfuel.ai&#10;Saporo - https://saporo.io"
                  rows={4}
                  className="w-full p-3 text-xs font-mono border-2 border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                disabled={isCurrentProcessing}
                onClick={handleRunInternalDiscovery}
                className="sketch-btn px-6 py-2.5 text-xs font-bold text-white bg-[#FF6B35] border-2 border-[#1E1B18] rounded-xl hover:bg-[#E55A2B] shadow-sketch-sm disabled:opacity-50 flex items-center gap-2"
              >
                {internalStatus === 'running' ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Huntlyst is executing candidate pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Run Huntlyst Internal Verification</span>
                  </>
                )}
              </button>

              {internalResults.length > 0 && (
                <div className="text-xs font-mono text-[#766E65]">
                  <span>Analyzed: <strong>{internalResults.length}</strong> candidates</span>
                  <span className="mx-2">•</span>
                  <span className="text-[#2E7D32] font-bold">Approved for Next Stage: {internalApproved.size}</span>
                </div>
              )}
            </div>
          </div>

          {/* Internal Results & Candidate Accounting Audit */}
          {internalResults.length > 0 && (
            <div className="space-y-4">
              {/* Accounting Card */}
              {(() => {
                const totalRec = internalStats?.totalReceived ?? internalResults.length;
                const totalProc = internalStats?.totalProcessed ?? internalResults.length;
                const qual = internalStats?.qualified ?? internalResults.filter(r => r.verificationStatus === 'QUALIFIED').length;
                const part = internalStats?.partiallyVerified ?? internalResults.filter(r => r.verificationStatus === 'PARTIALLY_VERIFIED').length;
                const rev = internalStats?.review ?? internalResults.filter(r => r.verificationStatus === 'REVIEW').length;
                const unver = internalStats?.unverified ?? internalResults.filter(r => r.verificationStatus === 'UNVERIFIED').length;
                const rej = internalStats?.rejected ?? internalResults.filter(r => r.verificationStatus === 'REJECTED').length;
                const errs = internalStats?.errors ?? internalResults.filter(r => r.verificationStatus === 'ERROR').length;

                return (
                  <div className="paper-card bg-[#FFFDF9] rounded-2xl p-4 sm:p-5 border-2 border-[#1E1B18] shadow-sketch-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#F0EAD8] pb-3 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📊</span>
                        <div>
                          <h4 className="font-display font-bold text-sm text-[#1E1B18]">
                            Candidate Verification Audit Trail
                          </h4>
                          <p className="text-[11px] font-mono text-[#766E65]">
                            Full accounting: All supplied candidates processed without artificial limits
                          </p>
                        </div>
                      </div>
                      <div className="text-xs font-mono font-bold text-[#2E7D32] bg-[#E8F5E9] px-3 py-1.5 rounded-lg border border-[#2E7D32]/30 self-start sm:self-auto">
                        {totalProc} / {totalRec} processed
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center font-mono">
                      <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#DCD6C9]">
                        <div className="text-[10px] text-[#766E65] uppercase font-bold">Received</div>
                        <div className="text-base sm:text-lg font-bold text-[#1E1B18]">{totalRec}</div>
                      </div>
                      <div className="p-2.5 bg-[#E8F5E9] rounded-xl border border-[#2E7D32]/30">
                        <div className="text-[10px] text-[#2E7D32] uppercase font-bold">Qualified</div>
                        <div className="text-base sm:text-lg font-bold text-[#2E7D32]">{qual}</div>
                      </div>
                      <div className="p-2.5 bg-[#FFF3E0] rounded-xl border border-[#E65100]/30">
                        <div className="text-[10px] text-[#E65100] uppercase font-bold">Partial</div>
                        <div className="text-base sm:text-lg font-bold text-[#E65100]">{part}</div>
                      </div>
                      <div className="p-2.5 bg-[#FFF8E1] rounded-xl border border-[#F57F17]/30">
                        <div className="text-[10px] text-[#F57F17] uppercase font-bold">Review</div>
                        <div className="text-base sm:text-lg font-bold text-[#F57F17]">{rev}</div>
                      </div>
                      <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#DCD6C9]">
                        <div className="text-[10px] text-[#766E65] uppercase font-bold">Unverified</div>
                        <div className="text-base sm:text-lg font-bold text-[#766E65]">{unver}</div>
                      </div>
                      <div className="p-2.5 bg-[#FFEBEE] rounded-xl border border-[#C62828]/30">
                        <div className="text-[10px] text-[#C62828] uppercase font-bold">Rejected</div>
                        <div className="text-base sm:text-lg font-bold text-[#C62828]">{rej}</div>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${errs > 0 ? 'bg-[#FFEBEE] border-[#D32F2F]/30' : 'bg-[#FAF6EE] border-[#DCD6C9]'}`}>
                        <div className={`text-[10px] uppercase font-bold ${errs > 0 ? 'text-[#D32F2F]' : 'text-[#766E65]'}`}>Errors</div>
                        <div className={`text-base sm:text-lg font-bold ${errs > 0 ? 'text-[#D32F2F]' : 'text-[#766E65]'}`}>{errs}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg border font-bold ${
                    activeTab === 'all' ? 'bg-[#1E1B18] text-[#FAF6EE] border-[#1E1B18]' : 'bg-white text-[#766E65] border-[#DCD6C9]'
                  }`}
                >
                  All ({internalResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('qualified')}
                  className={`px-3 py-1.5 rounded-lg border font-bold ${
                    activeTab === 'qualified' ? 'bg-[#2E7D32] text-white border-[#2E7D32]' : 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                  }`}
                >
                  Qualified ({internalResults.filter(r => r.verificationStatus === 'QUALIFIED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('partial')}
                  className={`px-3 py-1.5 rounded-lg border font-bold ${
                    activeTab === 'partial' ? 'bg-[#E65100] text-white border-[#E65100]' : 'bg-[#FFF3E0] text-[#E65100] border-[#E65100]/30'
                  }`}
                >
                  Partially Verified ({internalResults.filter(r => r.verificationStatus === 'PARTIALLY_VERIFIED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('review')}
                  className={`px-3 py-1.5 rounded-lg border font-bold ${
                    activeTab === 'review' ? 'bg-[#F57F17] text-white border-[#F57F17]' : 'bg-[#FFF8E1] text-[#F57F17] border-[#F57F17]/30'
                  }`}
                >
                  Review ({internalResults.filter(r => r.verificationStatus === 'REVIEW').length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unverified')}
                  className={`px-3 py-1.5 rounded-lg border font-bold ${
                    activeTab === 'unverified' ? 'bg-[#766E65] text-white border-[#766E65]' : 'bg-[#FAF6EE] text-[#766E65] border-[#DCD6C9]'
                  }`}
                >
                  Unverified ({internalResults.filter(r => r.verificationStatus === 'UNVERIFIED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('rejected')}
                  className={`px-3 py-1.5 rounded-lg border font-bold ${
                    activeTab === 'rejected' ? 'bg-[#C62828] text-white border-[#C62828]' : 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30'
                  }`}
                >
                  Rejected ({internalResults.filter(r => r.verificationStatus === 'REJECTED').length})
                </button>
                {internalResults.some(r => r.verificationStatus === 'ERROR') && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('error')}
                    className={`px-3 py-1.5 rounded-lg border font-bold ${
                      activeTab === 'error' ? 'bg-[#D32F2F] text-white border-[#D32F2F]' : 'bg-[#FFEBEE] text-[#D32F2F] border-[#D32F2F]/30'
                    }`}
                  >
                    Errors / Retry ({internalResults.filter(r => r.verificationStatus === 'ERROR').length})
                  </button>
                )}
              </div>

              {/* Candidates List with Stage Cards & Single-Stage Retry */}
              <div className="space-y-3">
                {filterList(internalResults).map((res) => (
                  <CandidateVerificationCard
                    key={res.company.name + res.company.website}
                    result={res}
                    isSelected={internalApproved.has(res.company.name)}
                    onToggleSelect={toggleInternalApproval}
                    onOpenDetails={() => onOpenLeadModal?.(res.company)}
                    onRetryStage={handleRetryCandidateStage}
                    isRetrying={isRetryingCandidate}
                  />
                ))}
              </div>

              {/* 🛑 APPROVAL GATE 1 BANNER (Section 8 & 9) */}
              <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛑</span>
                    <h4 className="font-display font-bold text-base text-[#1E1B18]">
                      Human Approval Gate 1 (Internal → External)
                    </h4>
                  </div>
                  <p className="text-xs font-mono text-[#766E65] mt-1">
                    Review candidate criteria and checks above. Selected candidates ({internalApproved.size}) will carry forward into External Discovery.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleApproveInternalToExternal}
                  className="sketch-btn px-6 py-3 text-xs font-bold text-[#1E1B18] bg-[#FFE0B2] hover:bg-[#FFD54F] border-2 border-[#1E1B18] rounded-xl shadow-sketch-sm shrink-0 flex items-center gap-1.5"
                >
                  <span>Approve & Proceed to External Discovery</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 2: EXTERNAL DISCOVERY                                              */}
      {/* ========================================================================= */}
      {currentStep === 'external' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
            <div className="border-b border-[#F0EAD8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                <span>🔎</span> Stage 2: External Discovery & Verification
              </h3>
              <p className="text-xs text-[#766E65] mt-1 font-mono">
                Enter company names, websites, or URLs for external deep research. Huntlyst runs the 6-stage candidate pipeline, verifies CEO/founders, validates live DNS MX mail servers, and presents verified evidence.
              </p>
            </div>

            {/* External Target Input */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={externalInputName}
                  onChange={(e) => setExternalInputName(e.target.value)}
                  placeholder="Company Name (e.g. Synthesized)"
                  className="w-full p-2.5 text-xs font-mono border-2 border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={externalInputWebsite}
                  onChange={(e) => setExternalInputWebsite(e.target.value)}
                  placeholder="Website / URL (e.g. synthesized.io)"
                  className="w-full p-2.5 text-xs font-mono border-2 border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                />
              </div>
              <button
                type="button"
                disabled={isCurrentProcessing || (!externalInputName.trim() && !externalInputWebsite.trim())}
                onClick={handleAddExternalCompany}
                className="sketch-btn px-4 py-2.5 text-xs font-bold text-white bg-[#1E1B18] border-2 border-[#1E1B18] rounded-xl hover:bg-[#3E3832] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>+ Research Target</span>
              </button>
            </div>

            {/* Candidates Carried from Internal Stage */}
            {internalApproved.size > 0 && (
              <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs font-mono">
                <span className="font-bold text-[#1E1B18] block mb-1">
                  Candidates Carried from Internal Stage ({internalApproved.size}):
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from(internalApproved).slice(0, 8).map(name => (
                    <span key={name} className="px-2 py-0.5 rounded bg-white border border-[#DCD6C9] text-[#1E1B18] text-[11px]">
                      {name}
                    </span>
                  ))}
                  {internalApproved.size > 8 && (
                    <span className="text-[#766E65] text-[10px]">+{internalApproved.size - 8} more</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* External Results */}
          {externalResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-base text-[#1E1B18]">
                  External Research Intelligence ({externalResults.length})
                </h4>
                <span className="text-xs font-mono text-[#2E7D32] font-bold">
                  Approved: {externalApproved.size}
                </span>
              </div>

              <div className="space-y-3">
                {externalResults.map((res) => (
                  <CandidateVerificationCard
                    key={res.company.name + res.company.website}
                    result={res}
                    isSelected={externalApproved.has(res.company.name)}
                    onToggleSelect={toggleExternalApproval}
                    onOpenDetails={() => onOpenLeadModal?.(res.company)}
                    onRetryStage={handleRetryCandidateStage}
                    isRetrying={isRetryingCandidate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 🛑 APPROVAL GATE 2 BANNER (Section 8 & 9) */}
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🛑</span>
                <h4 className="font-display font-bold text-base text-[#1E1B18]">
                  Human Approval Gate 2 (External → Web Search)
                </h4>
              </div>
              <p className="text-xs font-mono text-[#766E65] mt-1">
                Confirm your approved companies ({internalApproved.size + externalApproved.size} total) before proceeding to Web Search.
              </p>
            </div>

            <button
              type="button"
              onClick={handleApproveExternalToWebSearch}
              className="sketch-btn px-6 py-3 text-xs font-bold text-[#1E1B18] bg-[#FFE0B2] hover:bg-[#FFD54F] border-2 border-[#1E1B18] rounded-xl shadow-sketch-sm shrink-0 flex items-center gap-1.5"
            >
              <span>Approve & Proceed to Web Search</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 3: HUNTLYST WEB DISCOVERY                                          */}
      {/* ========================================================================= */}
      {currentStep === 'web_search' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
            <div className="border-b border-[#F0EAD8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                <span>🌐</span> Stage 3: Huntlyst Web Discovery
              </h3>
              <p className="text-xs text-[#766E65] mt-1 font-mono">
                Huntlyst Web Discovery searches across active venture queries matching your exact target parameters. If fewer companies exist on the web matching strict criteria, only verifiable companies are returned. No fabricated entries.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={isCurrentProcessing}
                onClick={handleRunWebSearch}
                className="sketch-btn px-6 py-3 text-xs font-bold text-white bg-[#FF6B35] border-2 border-[#1E1B18] rounded-xl hover:bg-[#E55A2B] shadow-sketch-sm disabled:opacity-50 flex items-center gap-2"
              >
                {webStatus === 'running' ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Huntlyst is scanning public web...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Launch Huntlyst Web Discovery</span>
                  </>
                )}
              </button>

              <div className="text-xs font-mono text-[#766E65]">
                Target: <strong>{targetProfile.targetCount} leads</strong> in <strong>{targetProfile.fundingCurrency} {(targetProfile.fundingMin / 1e6).toFixed(1)}M–{(targetProfile.fundingMax / 1e6).toFixed(1)}M</strong>
              </div>
            </div>
          </div>

          {/* Web Search Results */}
          {webSearchResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-base text-[#1E1B18]">
                  Web Search Candidates Verified ({webSearchResults.length})
                </h4>
                <span className="text-xs font-mono text-[#2E7D32] font-bold">
                  Approved: {webSearchApproved.size}
                </span>
              </div>

              <div className="space-y-3">
                {webSearchResults.map((res) => (
                  <CandidateVerificationCard
                    key={res.company.name + res.company.website}
                    result={res}
                    isSelected={webSearchApproved.has(res.company.name)}
                    onToggleSelect={toggleWebSearchApproval}
                    onOpenDetails={() => onOpenLeadModal?.(res.company)}
                    onRetryStage={handleRetryCandidateStage}
                    isRetrying={isRetryingCandidate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 🛑 APPROVAL GATE 3: Finalize to Results & Review (Section 8 & 9) */}
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-5 border-2 border-[#1E1B18] shadow-sketch flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <h4 className="font-display font-bold text-base text-[#1E1B18]">
                  Human Approval Gate 3 (Final Lead Approval)
                </h4>
              </div>
              <p className="text-xs font-mono text-[#766E65] mt-1">
                You have approved <strong>{internalApproved.size + externalApproved.size + webSearchApproved.size}</strong> leads across all stages. Finalize to access full CSV, PDF, and DOCX exports.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFinalizeAll}
              className="sketch-btn px-6 py-3 text-xs font-bold text-[#1E1B18] bg-[#A5D6A7] hover:bg-[#81C784] border-2 border-[#1E1B18] rounded-xl shadow-sketch-sm shrink-0 flex items-center gap-1.5"
            >
              <span>Approve & View Final Results</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Target Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1E1B18]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFDF9] rounded-2xl max-w-4xl w-full p-6 border-2 border-[#1E1B18] shadow-sketch max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3">
              <h3 className="font-display font-bold text-xl text-[#1E1B18]">
                🎯 Customize Target Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="w-8 h-8 rounded-full border border-[#1E1B18] flex items-center justify-center font-bold text-[#1E1B18] hover:bg-[#FAF6EE]"
              >
                ✕
              </button>
            </div>

            <HuntConfiguration
              initialConfig={{
                geography: {
                  mode: 'custom',
                  regions: targetProfile.regions,
                  countries: targetProfile.countries,
                  excludedCountries: targetProfile.excludedCountries || [],
                  usPresence: targetProfile.usPresenceMode as any,
                },
                sectors: targetProfile.industries,
                businessModels: targetProfile.subIndustries,
                stage: targetProfile.companyStages,
                funding: {
                  min: targetProfile.fundingMin,
                  max: targetProfile.fundingMax,
                  mode: targetProfile.financialMetric as any,
                },
                techProfile: 'platform_required',
                contactRequirement: 'ceo_or_cofounder',
                emailVerification: 'required',
                depth: 'balanced',
                targetLeads: typeof targetProfile.targetCount === 'number' ? targetProfile.targetCount : 15,
                targetProfile,
              }}
              isRunning={false}
              onLaunchHunt={(cfg: HuntConfig) => {
                if (cfg.targetProfile) {
                  setTargetProfile(cfg.targetProfile);
                }
                setIsConfigModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
