'use client';

import React, { useState, useEffect } from 'react';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE, formatTargetSummary } from '@/lib/targetProfileData';
import { CompanyVerificationResult, CriterionResult, PipelineStageName } from '@/providers/types';
import { CompanyRecord, RejectedCompanyRecord, HuntConfig, PipelineStreamEvent } from '@/lib/types';
import HuntConfiguration from './HuntConfiguration';
import ExportModal from './ExportModal';
import ExternalResearchWorkflow from './ExternalResearchWorkflow';
import { PipelineStageLabel } from '@/lib/export';
import { extractCanonicalDomain, normalizeCompanyName } from '@/lib/deduplication';
import { processPhase1File, Phase1ImportResult } from '@/lib/internal';
import type { Phase1CompanyRecord } from '@/lib/internal/phase1Types';
import { evaluateInternalRecord, parseOfflineAmount, OfflineVerificationInput, InternalVerificationOutcome } from '@/lib/internal/offlineVerification';
import { InternalWorkflowSettings, loadInternalSettings, saveInternalSettings } from '@/lib/internalSettings';
import CompanyRecordsTable from './CompanyRecordsTable';
import SharedCompanyTable, { SharedCompanyRow } from './SharedCompanyTable';

function isSameCompanyIdentity(
  a: { name?: string; website?: string },
  b: { name?: string; website?: string }
): boolean {
  const domA = extractCanonicalDomain(a.website || '');
  const domB = extractCanonicalDomain(b.website || '');
  if (domA && domB && domA === domB) return true;

  const nameA = normalizeCompanyName(a.name || '');
  const nameB = normalizeCompanyName(b.name || '');
  const isGenericA = !nameA || nameA.includes('unknown') || nameA.includes('entity');
  const isGenericB = !nameB || nameB.includes('unknown') || nameB.includes('entity');

  if (!isGenericA && !isGenericB && nameA === nameB) return true;
  return false;
}


function rawFieldValue(raw: Record<string, any>, aliases: string[]): unknown {
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const entries = Object.entries(raw || {});
  for (const alias of aliases) {
    const match = entries.find(([key, value]) => normalized(key) === normalized(alias) && value !== null && value !== undefined && String(value).trim() !== '');
    if (match) return match[1];
  }
  return undefined;
}

function toOfflineVerificationInput(record: Phase1CompanyRecord): OfflineVerificationInput {
  const raw = record.rawFields || {};
  const fields = record.canonicalFields;
  const website = fields.website.value || rawFieldValue(raw, ['Website', 'Company Website', 'URL', 'Website URL']);
  const rawDomain = fields.canonicalDomain.value || rawFieldValue(raw, ['Domain', 'Company Domain', 'Website Domain']) || extractCanonicalDomain(String(website || ''));
  const companyName = fields.companyName.value || rawFieldValue(raw, ['Company Name', 'Company', 'Name', 'Organization']);
  const industry = fields.industry.value || rawFieldValue(raw, ['Industry', 'Sector']);
  const geography = fields.geography.value || rawFieldValue(raw, ['Geography', 'Country', 'Headquarters', 'Location', 'City']);
  const totalFunding = fields.totalFundingAmount.value || rawFieldValue(raw, ['Total Funding', 'Total Funding USD', 'Funding Amount (in USD)', 'Funding Amount', 'Funding']);
  const latestRoundFunding = fields.latestFundingRoundAmount.value || rawFieldValue(raw, ['Latest Round Funding', 'Latest Funding Round Amount', 'Latest Round Amount']);
  const companyStage = fields.companyStage.value || fields.fundingStage.value || rawFieldValue(raw, ['Company Stage', 'Funding Type', 'Funding Stage', 'Stage']);
  const executiveNames = [
    rawFieldValue(raw, ['CEO Name', 'Current CEO', 'Chief Executive Officer']),
    rawFieldValue(raw, ['Founder Name', 'Founder', 'Founders']),
    rawFieldValue(raw, ['Cofounder Name', 'Co-founder', 'Co-founder Name', 'CoFounders']),
    rawFieldValue(raw, ['Executive Name', 'Decision Maker', 'Contact Name']),
  ].filter(value => value !== undefined && String(value).trim() !== '');
  const emails = [
    rawFieldValue(raw, ['Company Email', 'Contact Email', 'Email']),
    rawFieldValue(raw, ['CEO Email', 'Founder Email', 'Executive Email', 'Decision Maker Email']),
  ].filter(value => value !== undefined && String(value).trim() !== '');
  const ambiguousFields = Object.entries(fields)
    .filter(([, detail]) => detail.status === 'INVALID' || detail.status === 'AMBIGUOUS')
    .map(([key]) => key);

  return {
    id: record.companyId,
    companyName,
    domain: rawDomain,
    website,
    industry,
    subIndustry: rawFieldValue(raw, ['Sub-industry', 'Sub Industry', 'Subsector', 'Sub-sector']),
    geography,
    revenue: rawFieldValue(raw, ['Annual Revenue', 'Revenue', 'Revenue USD', 'Annual Revenue USD']),
    totalFunding,
    latestRoundFunding,
    companyStage,
    foundingYear: fields.foundingYear.value || rawFieldValue(raw, ['Founding Year', 'Year Founded', 'Founded']),
    companyAge: fields.companyAge.value || rawFieldValue(raw, ['Company Age', 'Operating Years', 'Years Operating']),
    companyStatus: rawFieldValue(raw, ['Company Status', 'Operating Status', 'Business Status', 'Status']),
    executiveNames,
    emails,
    ambiguousFields,
  };
}

function toLocalCriterion(key: string, outcome: InternalVerificationOutcome, value: unknown): CriterionResult {
  const status = outcome.passedCriteria.includes(key)
    ? 'PASS'
    : outcome.failedCriteria.includes(key)
    ? 'FAIL'
    : 'UNKNOWN';
  const relatedReason = outcome.reasons.filter(reason => reason.toLowerCase().includes(key.toLowerCase())).join(' ');
  return {
    status,
    value: value === null || value === undefined ? null : String(value),
    reason: relatedReason || 'Evaluated against supplied file data and saved Internal settings.',
    source: 'Uploaded file / offline rules',
    verificationStage: 'QUALIFY',
    timestamp: new Date().toISOString(),
  };
}

function toLocalCompanyVerificationResult(
  record: Phase1CompanyRecord,
  input: OfflineVerificationInput,
  outcome: InternalVerificationOutcome,
): CompanyVerificationResult {
  const raw = record.rawFields || {};
  const companyName = String(input.companyName || '');
  const website = String(input.website || (input.domain ? 'https://' + String(input.domain) : ''));
  const company: CompanyRecord = {
    id: record.companyId,
    name: companyName,
    website,
    canonicalDomain: String(input.domain || ''),
    description: String(raw.Description || '') || null,
    industry: String(input.industry || '') || null,
    fundingOrRevenue: String(input.totalFunding || input.revenue || '') || null,
    totalFundingUsd: parseOfflineAmount(input.totalFunding),
    latestRoundUsd: parseOfflineAmount(input.latestRoundFunding),
    latestRound: String(input.companyStage || '') || null,
    yearFounded: parseOfflineAmount(input.foundingYear),
    founders: (input.executiveNames || []).map(value => String(value)),
    sourceProvenance: 'Uploaded file; offline verification only',
    discoveredAt: new Date().toISOString(),
  };
  const statusMap: Record<InternalVerificationOutcome['status'], CompanyVerificationResult['verificationStatus']> = {
    VERIFIED: 'QUALIFIED',
    REVIEW: 'PARTIALLY_VERIFIED',
    UNVERIFIED: 'UNVERIFIED',
    REJECTED: 'REJECTED',
  };
  const criterion = (key: string, value: unknown) => toLocalCriterion(key, outcome, value);
  return {
    company,
    verificationStatus: statusMap[outcome.status],
    criteria: {
      funding: criterion('funding', input.totalFunding || input.latestRoundFunding),
      industry: criterion('industry', input.industry),
      companyAge: criterion('companyAge', input.companyAge || input.foundingYear),
      geography: criterion('geography', input.geography),
      usPresence: criterion('geography', input.geography),
      companyStage: criterion('stage', input.companyStage),
      founderOrCeo: criterion('executive', (input.executiveNames || []).join(', ')),
      professionalEmail: criterion('email', (input.emails || []).join(', ')),
    },
    rejectionReason: outcome.status === 'REJECTED' ? outcome.reasons.join(' ') : undefined,
    qualificationReason: outcome.status === 'VERIFIED' ? outcome.reasons.join(' ') : undefined,
    partiallyVerifiedReason: outcome.status === 'REVIEW' ? outcome.reasons.join(' ') : undefined,
    unverifiedReason: outcome.status === 'UNVERIFIED' ? outcome.reasons.join(' ') : undefined,
    decisionExplanation: outcome.reasons.join(' '),
    failedCriteria: outcome.failedCriteria,
    passedCriteria: outcome.passedCriteria,
    unknownCriteria: [...outcome.missingCriteria, ...outcome.ambiguousCriteria],
    sources: ['Uploaded file (offline evaluation)'],
    auditTimestamp: new Date().toISOString(),
  };
}

interface StagedDiscoveryWorkflowProps {
  initialTargetProfile?: TargetProfile;
  onFinalizeResults: (qualifiedCompanies: CompanyRecord[], rejectedCompanies: RejectedCompanyRecord[]) => void;
  onOpenLeadModal?: (company: CompanyRecord) => void;
  savedLeads?: CompanyRecord[];
  onToggleSave?: (company: CompanyRecord) => void;
}

type StageStep = 'internal' | 'external' | 'web_search';
type SourceStatus = 'idle' | 'running' | 'completed' | 'approved';

export default function StagedDiscoveryWorkflow({
  initialTargetProfile = DEFAULT_TVB_TARGET_PROFILE,
  onFinalizeResults,
  onOpenLeadModal,
  savedLeads,
  onToggleSave,
}: StagedDiscoveryWorkflowProps) {
  // Target Configuration State
  const [targetProfile, setTargetProfile] = useState<TargetProfile>(initialTargetProfile);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Canonical Target Profile Propagation: Keep in sync with parent configuration
  useEffect(() => {
    if (initialTargetProfile) {
      setTargetProfile(initialTargetProfile);
    }
  }, [initialTargetProfile]);

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
  const [internalSettings, setInternalSettings] = useState<InternalWorkflowSettings>(() => loadInternalSettings());
  const [settingsOpenRequest, setSettingsOpenRequest] = useState(0);
  const [verificationResults, setVerificationResults] = useState<Record<string, InternalVerificationOutcome> | null>(null);
  const [isRunningOfflineVerification, setIsRunningOfflineVerification] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  const [phase1Result, setPhase1Result] = useState<Phase1ImportResult | null>(null);
  const [isPhase1Parsing, setIsPhase1Parsing] = useState(false);
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
  const [webLogs, setWebLogs] = useState<{ time: string; text: string; stage?: string }[]>([]);
  const [webProgress, setWebProgress] = useState<{ current: number; total: number; strategy?: string; discovered?: number } | null>(null);
  const [isWebLogsExpanded, setIsWebLogsExpanded] = useState(false);

  // Shared Table row adapter for Web Search stage
  const webSearchSharedRows: SharedCompanyRow[] = React.useMemo(() => {
    const statusMap: Record<string, { status: string; label: string }> = {
      VERIFIED: { status: 'FOUND', label: 'VERIFIED' },
      QUALIFIED: { status: 'FOUND', label: 'VERIFIED' },
      REVIEW: { status: 'NEEDS_REVIEW', label: 'NEEDS REVIEW' },
      PARTIALLY_VERIFIED: { status: 'NEEDS_REVIEW', label: 'NEEDS REVIEW' },
      UNVERIFIED: { status: 'UNVERIFIED', label: 'UNVERIFIED' },
      REJECTED: { status: 'MISSING', label: 'REJECTED' },
    };

    return webSearchResults.map((res, idx) => {
      const comp = res.company;
      const anyComp = comp as any;
      const domain =
        comp.canonicalDomain ||
        (comp.website ? comp.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '');
      const website = comp.website || (domain ? `https://${domain}` : '');
      const canonical = statusMap[res.verificationStatus] || {
        status: 'UNVERIFIED',
        label: res.verificationStatus || 'UNVERIFIED',
      };

      const founded = anyComp.foundedYear || anyComp.yearFounded || 'Not disclosed';
      const funding =
        anyComp.totalFunding ||
        comp.fundingOrRevenue ||
        (comp.totalFundingDisclosed ? `$${comp.totalFundingDisclosed}M` : 'Not disclosed');
      const stage = anyComp.fundingStage || comp.latestRound || anyComp.fundingType || 'Not disclosed';
      const geo =
        anyComp.geography || comp.headquarters || comp.country || comp.city || 'Not disclosed';

      return {
        id: comp.name,
        index: idx + 1,
        name: comp.name,
        description: comp.description || null,
        domain,
        website,
        industry: comp.industry || 'Not disclosed',
        geography: geo,
        founded: String(founded),
        funding: String(funding),
        stage: String(stage),
        status: canonical.status,
        statusLabel: canonical.label,
        raw: res,
      };
    });
  }, [webSearchResults]);

  // Stage & Live Export Modal State (Sections 44, 52, 53)
  const [exportModalConfig, setExportModalConfig] = useState<{
    isOpen: boolean;
    stage?: PipelineStageLabel;
    stagedResults: CompanyVerificationResult[];
    title?: string;
    subtitle?: string;
  } | null>(null);

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
      setWebLogs([]);
      setWebProgress(null);
      setIsWebLogsExpanded(false);
      setSelectedFile(null);
      setPhase1Result(null);
      setManualText('');
      setStatusMessage('');
      setErrorMessage(null);
      setCurrentStep('internal');
    }
  };

  // --- INTERNAL STAGE HANDLERS (PHASE 1 IN-BROWSER PIPELINE) ---
  const handleInternalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
        setErrorMessage('Internal Workflow currently accepts only CSV (.csv) and Excel workbook (.xlsx) files.');
        setStatusMessage('Unsupported file type. Choose a CSV or XLSX file.');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      setVerificationResults(null);
      setInternalResults([]);
      setInternalApproved(new Set());
      setInternalStats(null);
      setInternalProgress(null);
      setInternalStatus('idle');
      setIsPhase1Parsing(true);
      setErrorMessage(null);
      setStatusMessage(`Parsing "${file.name}" locally in browser...`);

      try {
        const result = await processPhase1File(file, file.name);
        if (result.errors.length > 0 && result.companies.length === 0) {
          setErrorMessage(result.errors[0].message);
          setPhase1Result(null);
          setStatusMessage('File import encountered an error.');
        } else {
          setPhase1Result(result);
          setStatusMessage(`File "${file.name}" prepared: ${result.companies.length} companies extracted.`);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to process file locally.');
        setPhase1Result(null);
        setStatusMessage('File processing failed.');
      } finally {
        setIsPhase1Parsing(false);
      }
    }
  };

  const handleParsePastedText = async () => {
    if (!manualText.trim()) {
      setErrorMessage('Please paste candidate text or table.');
      return;
    }
    setVerificationResults(null);
    setInternalResults([]);
    setInternalApproved(new Set());
    setInternalStats(null);
    setInternalProgress(null);
    setInternalStatus('idle');
    setIsPhase1Parsing(true);
    setErrorMessage(null);
    setStatusMessage('Parsing pasted candidates locally in browser...');

    try {
      const isMd = manualText.includes('|') || manualText.includes('#');
      const filename = isMd ? 'pasted-candidates.md' : 'pasted-candidates.csv';
      const result = await processPhase1File(manualText, filename);
      if (result.errors.length > 0 && result.companies.length === 0) {
        setErrorMessage(result.errors[0].message);
        setPhase1Result(null);
        setStatusMessage('Text parsing encountered an error.');
      } else {
        setPhase1Result(result);
        setStatusMessage(`Pasted text prepared: ${result.companies.length} companies extracted.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse text.');
      setPhase1Result(null);
      setStatusMessage('Text parsing failed.');
    } finally {
      setIsPhase1Parsing(false);
    }
  };

  const handleInternalSearchModeChange = (mode: 'offline' | 'online') => {
    const updated = { ...internalSettings, targetProfile: { ...internalSettings.targetProfile, searchMode: mode } };
    setInternalSettings(updated);
    // saveInternalSettings deliberately persists Offline as the next-session default.
    saveInternalSettings(updated);
    setStatusMessage(mode === 'offline'
      ? 'Offline mode selected. Internal verification will use only uploaded data and saved rules.'
      : 'Online mode is a placeholder and is not wired yet. No network verification will run.');
  };

  const handleRunInternalVerificationPipeline = async () => {
    if (internalSettings.targetProfile.searchMode === 'online') {
      setStatusMessage('Online verification is not wired yet. Switch to Offline to run Internal verification locally.');
      return;
    }
    if (!phase1Result || phase1Result.companies.length === 0) {
      setErrorMessage('Upload and parse a CSV or XLSX file before running Internal verification.');
      setStatusMessage('No parsed company records are available to verify.');
      return;
    }

    setIsRunningOfflineVerification(true);
    setErrorMessage(null);
    setInternalProgress(null);
    setInternalStatus('running');
    setStatusMessage('Evaluating parsed company records against the saved Internal Target Profile offline...');
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const outcomes: Record<string, InternalVerificationOutcome> = {};
      const localResults: CompanyVerificationResult[] = [];
      for (const company of phase1Result.companies) {
        const input = toOfflineVerificationInput(company);
        const outcome = evaluateInternalRecord(input, internalSettings);
        outcomes[company.companyId] = outcome;
        localResults.push(toLocalCompanyVerificationResult(company, input, outcome));
      }

      setVerificationResults(outcomes);
      setInternalResults(localResults);
      const approved = new Set<string>();
      localResults.forEach(result => {
        if (result.verificationStatus === 'QUALIFIED' || result.verificationStatus === 'PARTIALLY_VERIFIED') {
          approved.add(result.company.name);
        }
      });
      setInternalApproved(approved);
      const summary = Object.values(outcomes).reduce((acc, item) => {
        acc[item.status] += 1;
        return acc;
      }, { VERIFIED: 0, REVIEW: 0, UNVERIFIED: 0, REJECTED: 0 } as Record<InternalVerificationOutcome['status'], number>);
      setInternalStats({
        totalReceived: localResults.length,
        totalProcessed: localResults.length,
        qualified: summary.VERIFIED,
        rejected: summary.REJECTED,
        partiallyVerified: summary.REVIEW,
        review: summary.REVIEW,
        unverified: summary.UNVERIFIED,
        errors: 0,
      });
      setInternalProgress({ current: localResults.length, total: localResults.length });
      setInternalStatus('completed');
      setStatusMessage(
        'Offline verification complete: ' + summary.VERIFIED + ' VERIFIED, ' +
        summary.UNVERIFIED + ' UNVERIFIED, ' + summary.REVIEW + ' REVIEW, ' +
        summary.REJECTED + ' REJECTED. No network calls were made.'
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Offline verification failed.');
      setInternalStatus('idle');
      setStatusMessage('Offline verification failed; the imported records were not discarded.');
    } finally {
      setIsRunningOfflineVerification(false);
    }
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

      const incomingList = (data.results || []) as CompanyVerificationResult[];
      const nextApproved = new Set(externalApproved);

      setExternalResults(prevResults => {
        let merged = [...prevResults];
        for (const incoming of incomingList) {
          const matchIdx = merged.findIndex(curr =>
            isSameCompanyIdentity(
              { name: curr.company.name, website: curr.company.website },
              { name: incoming.company.name, website: incoming.company.website }
            )
          );

          if (matchIdx >= 0) {
            const oldName = merged[matchIdx].company.name;
            if (oldName !== incoming.company.name) {
              nextApproved.delete(oldName);
            }
            merged[matchIdx] = incoming;
          } else {
            merged.push(incoming);
          }

          if (incoming.verificationStatus === 'QUALIFIED' || incoming.verificationStatus === 'VERIFIED') {
            nextApproved.add(incoming.company.name);
          }
        }
        return merged;
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
    setWebLogs([]);
    const targetCount = typeof targetProfile.targetCount === 'number'
      ? targetProfile.targetCount
      : (targetProfile.customTargetCount || 15);
    setWebProgress({ current: 0, total: targetCount, discovered: 0 });
    setStatusMessage('Initializing Huntlyst Web Discovery on Houston runtime...');

    const existingDomains = [
      ...internalResults.map(r => r.company.website),
      ...externalResults.map(r => r.company.website),
    ].filter(Boolean) as string[];

    const huntId = `hunt_stage3_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
      const response = await fetch('/api/discovery/web?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          targetProfile,
          targetCount,
          excludeDomains: existingDomains,
          huntId,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Web discovery failed with HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let partialBuffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          partialBuffer += decoder.decode(value, { stream: true });
          const lines = partialBuffer.split('\n\n');
          partialBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const event: PipelineStreamEvent = JSON.parse(trimmed.slice(6));

              if (event.type === 'log') {
                setWebLogs((prev) => [
                  ...prev,
                  { time: timestamp(), text: event.message, stage: event.stageName },
                ]);
                setStatusMessage(event.message);

                if (event.message?.includes('Strategy ') || event.message?.includes('Executing Strategy')) {
                  const stratMatch = event.message.match(/(Strategy \d+:[^.(]+)/i) || event.message.match(/Executing (Strategy [^.(]+)/i);
                  if (stratMatch) {
                    setWebProgress((prev) => prev ? { ...prev, strategy: stratMatch[1].trim() } : null);
                  }
                }
              } else if (event.type === 'candidate_found') {
                setStatusMessage(event.message);
                if (event.stats?.discovered) {
                  setWebProgress((prev) => prev ? { ...prev, discovered: event.stats?.discovered } : null);
                }
              } else if (event.type === 'company_qualified') {
                setStatusMessage(event.message);
                if (event.verificationResult) {
                  const qualifiedItem = event.verificationResult as CompanyVerificationResult;
                  setWebSearchResults((prev) => {
                    const exists = prev.some(p => p.company.name.toLowerCase() === qualifiedItem.company.name.toLowerCase());
                    return exists ? prev : [...prev, qualifiedItem];
                  });
                  setWebSearchApproved((prev) => new Set([...prev, qualifiedItem.company.name]));
                  setWebProgress((prev) => prev ? { ...prev, current: prev.current + 1 } : null);
                }
              } else if (event.type === 'complete') {
                const finalResults = (event.results || []) as CompanyVerificationResult[];
                if (finalResults.length > 0) {
                  setWebSearchResults(finalResults);
                  const nextApproved = new Set<string>();
                  finalResults.forEach((r: CompanyVerificationResult) => {
                    if (r.verificationStatus === 'QUALIFIED' || r.verificationStatus === 'VERIFIED' || r.verificationStatus === 'PARTIALLY_VERIFIED') {
                      nextApproved.add(r.company.name);
                    }
                  });
                  setWebSearchApproved(nextApproved);
                }
                setWebStatus('completed');
                setStatusMessage(event.message || `Web discovery complete: ${finalResults.length} leads found.`);
              } else if (event.type === 'error') {
                throw new Error(event.message || 'Web discovery failed');
              }
            } catch (pErr) {
              // Ignore partial frame parse error
            }
          }
        }
      } else {
        // Fallback for standard JSON response
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Web discovery failed');
        }
        const incomingResults = (data.results || []) as CompanyVerificationResult[];
        setWebSearchResults(incomingResults);
        const nextApproved = new Set<string>();
        incomingResults.forEach((r) => {
          if (r.verificationStatus === 'QUALIFIED' || r.verificationStatus === 'VERIFIED' || r.verificationStatus === 'PARTIALLY_VERIFIED') {
            nextApproved.add(r.company.name);
          }
        });
        setWebSearchApproved(nextApproved);
        setWebStatus('completed');
        setStatusMessage(`Discovered and verified ${incomingResults.length} candidate companies.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Web discovery error');
      setWebStatus('completed');
      setStatusMessage('Web discovery halted with an error.');
    } finally {
      // Guaranteed terminal state: never stay stuck in running
      setWebStatus((prev) => (prev === 'running' ? 'completed' : prev));
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

      const updater = (prev: CompanyVerificationResult[]) =>
        prev.map(c =>
          isSameCompanyIdentity(
            { name: c.company.name, website: c.company.website },
            { name: updated.company.name, website: updated.company.website }
          )
            ? updated
            : c
        );

      if (currentStep === 'internal') {
        setInternalResults(updater);
      } else if (currentStep === 'external') {
        setExternalResults(updater);
      } else {
        setWebSearchResults(updater);
      }

      setStatusMessage(`Stage "${stage}" retry complete for ${updated.company.name}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Stage retry error');
    } finally {
      setIsRetryingCandidate(false);
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
            <span className="text-[9px] text-[#766E65] uppercase block font-bold">Target Coverage</span>
            <span className="text-[#1E1B18] font-bold truncate block capitalize">
              {targetProfile.regions.includes('Global') ? 'Global' : (targetProfile.regions.join(', ') || 'Custom')}
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
        <div className="text-[11px] font-mono uppercase text-[#766E65] font-bold mb-3 flex flex-wrap items-center justify-between gap-2">
          <span>Staged Discovery Path (Strict Human Approval Gates)</span>
          <div className="flex items-center gap-2">
            {(internalResults.length > 0 || externalResults.length > 0 || webSearchResults.length > 0) && (
              <button
                type="button"
                onClick={() => setExportModalConfig({
                  isOpen: true,
                  stagedResults: [...internalResults, ...externalResults, ...webSearchResults],
                  title: 'Live Discovery Pipeline Export',
                  subtitle: `Point-in-time snapshot of ${internalResults.length + externalResults.length + webSearchResults.length} candidates across active stages.`,
                })}
                className="px-2.5 py-1 rounded-lg border border-[#1E1B18] bg-[#FAF6EE] hover:bg-[#FFE7DC] text-[#1E1B18] text-[10px] font-bold flex items-center gap-1 shadow-sketch-xs transition-colors"
                title="Export live snapshot without interrupting workflow"
              >
                <span>📦</span>
                <span>Live Export ({internalResults.length + externalResults.length + webSearchResults.length})</span>
              </button>
            )}
            <span>Zero False Claims • UNKNOWN ≠ FAIL</span>
          </div>
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
            <div className="text-[10px] text-[#766E65] font-normal">CSV / XLSX upload</div>
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
      <div className={currentStep === 'internal' ? 'block' : 'hidden'}>
        <div className="space-y-5 animate-in fade-in">
          <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
            <div className="border-b border-[#F0EAD8] pb-3">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-[#1E1B18] flex items-center gap-2">
                    <span>📁</span> Stage 1: Internal Candidate Discovery & Verification
                  </h3>
                  <p className="text-xs text-[#766E65] mt-1 font-mono">
                    Upload a CSV (.csv) or Excel workbook (.xlsx), parse it locally, configure the Internal Target Profile, then run the offline verification pipeline. Online mode is currently a placeholder.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 xl:justify-end shrink-0">
                  <button type="button" onClick={() => setSettingsOpenRequest(value => value + 1)}
                    className="px-3 py-2 rounded-lg border-2 border-[#1E1B18] bg-white text-xs font-bold font-mono hover:bg-[#FAF6EE] shadow-sketch-xs">
                    ⚙ Settings
                  </button>
                  <div className="inline-flex items-center p-0.5 rounded-lg border-2 border-[#1E1B18] bg-[#FAF6EE]">
                    <button type="button" onClick={() => handleInternalSearchModeChange('offline')}
                      className={internalSettings.targetProfile.searchMode === 'offline' ? 'px-3 py-2 rounded-md bg-[#1E1B18] text-white text-xs font-bold' : 'px-3 py-2 rounded-md text-[#766E65] text-xs font-bold'}>
                      Offline
                    </button>
                    <button type="button" onClick={() => handleInternalSearchModeChange('online')}
                      className={internalSettings.targetProfile.searchMode === 'online' ? 'px-3 py-2 rounded-md bg-[#FF6B35] text-white text-xs font-bold' : 'px-3 py-2 rounded-md text-[#766E65] text-xs font-bold'}>
                      Online
                    </button>
                  </div>
                  <button type="button" onClick={handleRunInternalVerificationPipeline}
                    disabled={isRunningOfflineVerification || isPhase1Parsing || !phase1Result || phase1Result.companies.length === 0}
                    className="sketch-btn px-4 py-2.5 text-xs font-bold text-white bg-[#FF6B35] border-2 border-[#1E1B18] rounded-xl hover:bg-[#E55A2B] shadow-sketch-sm disabled:opacity-50 flex items-center gap-2">
                    {isRunningOfflineVerification ? (
                      <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Verifying locally...</span></>
                    ) : (
                      <><span>✔</span><span>Run Internal Verification Pipeline</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* File Upload Dropzone */}
              <div className="p-5 border-2 border-dashed border-[#1E1B18] rounded-xl bg-[#FAF6EE] text-center space-y-3">
                <div className="text-3xl">📄</div>
                <div>
                  <label htmlFor="file-upload" className="font-display font-bold text-sm text-[#FF6B35] hover:underline cursor-pointer">
                    {isPhase1Parsing ? 'Parsing file in browser...' : 'Choose a file to prepare & preview'}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleInternalFileChange}
                    disabled={isPhase1Parsing}
                    className="hidden"
                  />
                  <p className="text-[11px] text-[#766E65] mt-1 font-mono">
                    Supported input: CSV (.csv) and Excel workbook (.xlsx)
                  </p>
                </div>
                {selectedFile && (
                  <div className="p-2 bg-white rounded-lg border border-[#DCD6C9] text-xs font-mono font-bold text-[#1E1B18] truncate flex items-center justify-between">
                    <span className="truncate">Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {isPhase1Parsing && (
                        <span className="w-3 h-3 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setPhase1Result(null);
                        }}
                        className="text-[11px] text-[#C62828] hover:underline font-bold"
                        title="Remove file"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Paste Text Fallback */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-[#1E1B18] block">
                    Or Paste Candidate Data (CSV or Markdown Table):
                  </label>
                  {manualText.trim() && (
                    <button
                      type="button"
                      disabled={isPhase1Parsing}
                      onClick={handleParsePastedText}
                      className="text-[11px] font-mono font-bold text-[#FF6B35] hover:underline"
                    >
                      Prepare & Preview ⚡
                    </button>
                  )}
                </div>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="e.g.&#10;| Company | Website | Industry | Country | Founding Year | Total Funding |&#10;| --- | --- | --- | --- | --- | --- |&#10;| Synthesized | https://synthesized.io | AI/ML | United Kingdom | 2018 | $4.2M |"
                  rows={4}
                  className="w-full p-3 text-xs font-mono border-2 border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {manualText.trim() && !phase1Result && (
                  <button
                    type="button"
                    disabled={isPhase1Parsing}
                    onClick={handleParsePastedText}
                    className="sketch-btn px-4 py-2 text-xs font-bold text-[#1E1B18] bg-white border-2 border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE] shadow-sketch-xs flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>Parse Pasted Candidates Locally</span>
                  </button>
                )}

              </div>

              {internalResults.length > 0 && (
                <div className="text-xs font-mono text-[#766E65]">
                  <span>Analyzed: <strong>{internalResults.length}</strong> candidates</span>
                  <span className="mx-2">•</span>
                  <span className="text-[#2E7D32] font-bold">Approved for Next Stage: {internalApproved.size}</span>
                </div>
              )}
            </div>
          </div>

          {/* Company Records Table & Toolbar (Exact Visual Reference Reproduction) */}
          <CompanyRecordsTable
            phase1Result={phase1Result}
            internalResults={internalResults}
            settingsOpenRequest={settingsOpenRequest}
            verificationResults={verificationResults}
            onSettingsSaved={(updatedSettings) => {
              setInternalSettings(updatedSettings);
              saveInternalSettings(updatedSettings);
            }}
            onToast={(msg) => setStatusMessage(msg)}
            savedLeads={savedLeads}
            onToggleSave={onToggleSave}
          />

          {/* 🛑 APPROVAL GATE 1 BANNER (Section 8 & 9) */}
          {internalResults.length > 0 && (
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
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STAGE 2: EXTERNAL DISCOVERY                                              */}
      {/* ========================================================================= */}
      <div className={currentStep === 'external' ? 'block' : 'hidden'}>
        <div className="space-y-5 animate-in fade-in">
          <ExternalResearchWorkflow
            carriedCandidates={internalResults
              .filter((r) => internalApproved.has(r.company.name))
              .map((r) => ({ name: r.company.name, website: r.company.website }))}
            onUpdateResults={(newResults) => {
              setExternalResults(newResults);
              const nextApproved = new Set(externalApproved);
              for (const r of newResults) {
                if (r.verificationStatus === 'VERIFIED') {
                  nextApproved.add(r.company.name);
                }
              }
              setExternalApproved(nextApproved);
            }}
            onOpenLeadModal={onOpenLeadModal}
            savedLeads={savedLeads}
            onToggleSave={onToggleSave}
          />

          {/* 🛑 APPROVAL GATE 2 BANNER */}
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
      </div>

      {/* ========================================================================= */}
      {/* STAGE 3: HUNTLYST WEB DISCOVERY                                          */}
      {/* ========================================================================= */}
      <div className={currentStep === 'web_search' ? 'block' : 'hidden'}>
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

          {/* Real Processing Progress Bar & Telemetry for Web Search */}
          {(webStatus === 'running' || webProgress) && (
            <div className="p-4 bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18] space-y-3 shadow-sketch-sm animate-in fade-in">
              <div className="flex justify-between items-center text-xs font-mono font-bold flex-wrap gap-2">
                <span className="flex items-center gap-2 text-[#1E1B18]">
                  {webStatus === 'running' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35] animate-ping shrink-0" />
                  ) : (
                    <span className="text-[#2E7D32]">✓</span>
                  )}
                  <span>
                    Stage 3: Autonomous Web Discovery Pipeline
                    {webProgress?.strategy ? ` (${webProgress.strategy})` : ''}
                  </span>
                </span>
                <span className="text-[#FF6B35] font-bold text-sm">
                  {webSearchResults.length} / {webProgress?.total || (typeof targetProfile.targetCount === 'number' ? targetProfile.targetCount : 15)} Qualified
                  {webProgress?.discovered ? ` (${webProgress.discovered} discovered)` : ''}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-white rounded-full border border-[#1E1B18] overflow-hidden">
                <div
                  className="h-full bg-[#FF6B35] transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (webSearchResults.length /
                          Math.max(
                            webProgress?.total ||
                              (typeof targetProfile.targetCount === 'number'
                                ? targetProfile.targetCount
                                : 15),
                            1
                          )) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>

              {/* Telemetry Stream Toggle & Mini Terminal */}
              {webLogs.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsWebLogsExpanded(!isWebLogsExpanded)}
                      className="text-[11px] font-mono text-[#766E65] hover:text-[#1E1B18] font-bold flex items-center gap-1.5"
                    >
                      <span>📡</span>
                      <span>
                        Houston Telemetry Stream ({webLogs.length} events)
                      </span>
                      <span>{isWebLogsExpanded ? '▲ Hide' : '▼ View Live Logs'}</span>
                    </button>
                    <span className="text-[10px] font-mono text-[#8C847A]">
                      8 Query Strategies • Real-Time SSE
                    </span>
                  </div>

                  {isWebLogsExpanded && (
                    <div className="mt-2 bg-[#1E1B18] text-[#FAF6EE] p-3.5 rounded-xl font-mono text-[11px] space-y-1.5 max-h-48 overflow-y-auto border border-[#3E3832]">
                      {webLogs.slice(-20).map((l, i) => (
                        <div key={i} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-[#8C847A] shrink-0 text-[10px]">{l.time}</span>
                          <span className="text-[#FF6B35]">›</span>
                          <span className="text-[#E0DACB]">{l.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty initial state before Web Search runs */}
          {webStatus === 'idle' && webSearchResults.length === 0 && (
            <div className="paper-card bg-[#FFFDF9] rounded-2xl p-10 text-center border-2 border-[#1E1B18] shadow-sketch-sm space-y-2">
              <div className="text-2xl">🌐</div>
              <h4 className="font-display text-lg font-bold text-[#1E1B18]">
                No research results yet.
              </h4>
              <p className="text-xs font-mono text-[#766E65] max-w-md mx-auto">
                No research results yet. Start a search or research operation to discover companies.
              </p>
            </div>
          )}

          {/* Zero Match Guidance Notice */}
          {webStatus === 'completed' && webSearchResults.length === 0 && !errorMessage && (
            <div className="p-4 bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18] space-y-2 shadow-sketch-sm">
              <div className="font-bold text-xs text-[#1E1B18] flex items-center gap-1.5">
                <span>ℹ️</span> No candidate companies matching strict parameters could be discovered.
              </div>
              <p className="text-xs text-[#766E65] font-mono">
                Huntlyst enforces strict zero-hallucination verification. To find more candidates, consider adjusting your target criteria in Target Settings (e.g. broadening geography or funding ranges) and re-launching Stage 3.
              </p>
            </div>
          )}

          {/* Web Search Results Table */}
          {webSearchResults.length > 0 && (
            <div className="space-y-4">
              <SharedCompanyTable
                title="Web Search Candidates Verified"
                subtitle="Live venture search results evaluated against your deterministic criteria."
                icon={<span>🌐</span>}
                rows={webSearchSharedRows}
                selectable={true}
                selectedIds={webSearchApproved}
                onToggleSelect={(id) => toggleWebSearchApproval(id)}
                onSelectAll={() => {
                  if (webSearchApproved.size === webSearchResults.length) {
                    setWebSearchApproved(new Set());
                  } else {
                    setWebSearchApproved(new Set(webSearchResults.map((r) => r.company.name)));
                  }
                }}
                onDeselectAll={() => setWebSearchApproved(new Set())}
                onView={(row) => onOpenLeadModal?.(row.raw.company)}
                savedLeads={savedLeads}
                onToggleSave={onToggleSave}
                onToast={(msg) => setStatusMessage(msg)}
                toolbarActions={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExportModalConfig({
                          isOpen: true,
                          stage: 'Stage 3: Research / Enrichment',
                          stagedResults: webSearchResults,
                          title: 'Export Stage 3: Web Discovery & Research',
                          subtitle: `${webSearchResults.length} web search candidates evaluated against target profile.`,
                        })
                      }
                      className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] rounded-lg border border-[#1E1B18] shadow-sketch-xs flex items-center gap-1.5 transition-colors"
                    >
                      <span>📦</span>
                      <span>Export Stage 3 ({webSearchResults.length})</span>
                    </button>
                    <span className="text-xs font-mono text-[#2E7D32] font-bold px-2 py-1 bg-[#E8F5E9] rounded-lg border border-[#C8E6C9]">
                      Approved: {webSearchApproved.size} / {webSearchResults.length}
                    </span>
                  </div>
                }
                extraRowActions={(row, closeMenu) => {
                  const res = row.raw as CompanyVerificationResult;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        handleRetryCandidateStage(res, 'RESEARCH');
                      }}
                      disabled={isRetryingCandidate}
                      className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-[#FAF6EE] text-[#1E1B18] flex items-center gap-2 disabled:opacity-50"
                    >
                      <span>🔄</span>
                      <span>Retry Verification</span>
                    </button>
                  );
                }}
              />
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

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setExportModalConfig({
                  isOpen: true,
                  stagedResults: [...internalResults, ...externalResults, ...webSearchResults],
                  title: 'Export Staged Discovery Pipeline',
                  subtitle: `Export all ${internalResults.length + externalResults.length + webSearchResults.length} candidates evaluated across stages.`,
                })}
                className="sketch-btn px-4 py-3 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border-2 border-[#1E1B18] rounded-xl shadow-sketch-sm shrink-0 flex items-center gap-1.5"
              >
                <span>📦</span>
                <span>Export Pipeline ({internalResults.length + externalResults.length + webSearchResults.length})</span>
              </button>

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
        </div>
      </div>

      {/* Target Configuration Modal */}
      {isConfigModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customize Target Profile Modal"
          className="fixed inset-0 z-50 bg-[#1E1B18]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
        >
          <div className="bg-[#FFFDF9] rounded-2xl max-w-5xl w-full border-2 border-[#1E1B18] shadow-sketch max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
                onClose={() => setIsConfigModalOpen(false)}
                onLaunchHunt={(cfg: HuntConfig) => {
                  if (cfg.targetProfile) {
                    setTargetProfile(cfg.targetProfile);
                  }
                  setIsConfigModalOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Staged & Live Export Modal (Sections 44, 52, 53) */}
      {exportModalConfig?.isOpen && (
        <ExportModal
          isOpen={exportModalConfig.isOpen}
          onClose={() => setExportModalConfig(null)}
          stagedResults={exportModalConfig.stagedResults}
          initialStage={exportModalConfig.stage}
          title={exportModalConfig.title}
          subtitle={exportModalConfig.subtitle}
          onToast={(msg) => setStatusMessage(msg)}
        />
      )}
    </div>
  );
}
