'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CompanyRecord,
  RunAgentResult,
  PipelineStreamEvent,
  RunHistoryItem,
  SettingsConfig,
  HuntConfig,
  TVB_EVALUATION_CONFIG,
  RejectedCompanyRecord,
} from '@/lib/types';
import { formatTargetSummary } from '@/lib/targetProfileData';
import { loadSettings } from '@/lib/settings';
import { calculateHuntScore } from '@/lib/rank';
import { downloadCsvFile, downloadPdfFile, downloadDocxFile } from '@/lib/export';

// Modular Subviews & Components
import HuntlystLogo from '@/components/HuntlystLogo';
import SplashScreen from '@/components/SplashScreen';
import HuntLoadingScreen from '@/components/HuntLoadingScreen';
import ExportModal from '@/components/ExportModal';
import LeadDetailModal from '@/components/LeadDetailModal';
import SettingsView from '@/components/SettingsView';
import AboutView from '@/components/AboutView';
import SavedLeadsView from '@/components/SavedLeadsView';
import DiscoverView from '@/components/DiscoverView';
import HuntHistoryView from '@/components/HuntHistoryView';
import ConfirmationModal from '@/components/ConfirmationModal';

// 6 Workflow Steps for "How Huntlyst hunts" (Section 7)
const HUNT_WORKFLOW_STEPS = [
  {
    num: '01',
    title: 'Discover',
    desc: 'Find new companies and sources',
    icon: (
      <svg className="w-6 h-6 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
        <circle cx="11" cy="11" r="3" stroke="#FF6B35" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Research',
    desc: 'Extract company intelligence',
    icon: (
      <svg className="w-6 h-6 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" stroke="#FF6B35" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Validate',
    desc: 'Check target-profile criteria',
    icon: (
      <svg className="w-6 h-6 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        <circle cx="12" cy="7" r="1.5" fill="#FF6B35" stroke="none" />
      </svg>
    ),
  },
  {
    num: '04',
    title: 'Find Founder',
    desc: 'Identify CEO / Co-founder',
    icon: (
      <svg className="w-6 h-6 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" stroke="#FF6B35" />
      </svg>
    ),
  },
  {
    num: '05',
    title: 'Verify Contact',
    desc: 'Validate professional email',
    icon: (
      <svg className="w-6 h-6 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" stroke="#FF6B35" />
      </svg>
    ),
  },
  {
    num: '06',
    title: 'Qualify',
    desc: 'Return only matching leads',
    icon: (
      <svg className="w-6 h-6 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" stroke="#FF6B35" strokeWidth="2.4" />
      </svg>
    ),
  },
];

type NavSection = 'home' | 'discover' | 'results' | 'saved' | 'history' | 'settings' | 'about';
type Status = 'idle' | 'running' | 'success' | 'error';
type SortField = 'name' | 'funding' | 'sector' | 'location' | 'huntScore';

export default function HomePage() {
  const [activeNav, setActiveNav] = useState<NavSection>('home');
  const [status, setStatus] = useState<Status>('idle');
  const [currentProgressIndex, setCurrentProgressIndex] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [logs, setLogs] = useState<{ time: string; text: string; stage?: string }[]>([]);
  const [results, setResults] = useState<RunAgentResult | null>(null);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);
  const isHuntingRef = useRef(false);
  const activeHuntIdRef = useRef<string | null>(null);
  const [pipelineStats, setPipelineStats] = useState<RunAgentResult['stats']>({
    discovered: 0,
    extracted: 0,
    nonUsPassed: 0,
    fundingQualified: 0,
    founderFound: 0,
    contactsChecked: 0,
    emailVerified: 0,
    emailsPartiallyVerified: 0,
    emailsUnverified: 0,
    finalRanked: 0,
    durationMs: 0,
  });

  // Persistence States
  const [savedLeads, setSavedLeads] = useState<CompanyRecord[]>([]);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [settings, setSettings] = useState<SettingsConfig>(loadSettings());
  const [currentStrategy, setCurrentStrategy] = useState<string>('');
  const [duplicatesFiltered, setDuplicatesFiltered] = useState<number>(0);

  // Filtering & Sorting on Results
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('All Sectors');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedScoreFilter, setSelectedScoreFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('huntScore');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Modals
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Splash Screen State (Session-guarded, defaults to true to prevent initial dashboard flash)
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [activeHuntConfig, setActiveHuntConfig] = useState<HuntConfig>(TVB_EVALUATION_CONFIG);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultsTab, setResultsTab] = useState<'qualified' | 'rejected'>('qualified');

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Check splash screen on mount: if already shown in this session, dismiss immediately
  useEffect(() => {
    try {
      const shown = sessionStorage.getItem('huntlyst_splash_shown');
      if (shown) {
        setShowSplash(false);
      }
    } catch {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    try {
      sessionStorage.setItem('huntlyst_splash_shown', 'true');
    } catch {}
  };

  // Load saved state on mount
  useEffect(() => {
    try {
      // Saved leads
      const savedRaw = localStorage.getItem('huntlyst_saved_companies') || localStorage.getItem('tvb_saved_companies');
      if (savedRaw) {
        setSavedLeads(JSON.parse(savedRaw));
      }

      // Run History
      const historyRaw = localStorage.getItem('huntlyst_run_history') || localStorage.getItem('tvb_run_history');
      if (historyRaw) {
        setRunHistory(JSON.parse(historyRaw));
      }

      // Last Run
      const lastRun = localStorage.getItem('huntlyst_last_run_timestamp') || localStorage.getItem('tvb_last_run_timestamp');
      if (lastRun) {
        setLastRunTime(lastRun);
      }

      // Cached current run
      const cachedRun = localStorage.getItem('huntlyst_current_run') || localStorage.getItem('tvb_current_run');
      if (cachedRun) {
        setResults(JSON.parse(cachedRun));
      }

      // Settings
      setSettings(loadSettings());
    } catch {}
  }, []);

  // Toast Helper
  const showToast = (msg: string) => setToastMessage(msg);
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Country Name Helper
  const getCountryName = (loc: string | null, url: string): string => {
    const text = `${loc || ''} ${url}`.toLowerCase();
    if (text.includes('singapore') || text.includes('.sg')) return 'Singapore';
    if (text.includes('germany') || text.includes('berlin') || text.includes('munich') || text.includes('.de')) return 'Germany';
    if (text.includes('uk') || text.includes('united kingdom') || text.includes('london') || text.includes('.uk')) return 'United Kingdom';
    if (text.includes('uae') || text.includes('dubai') || text.includes('.ae')) return 'UAE';
    if (text.includes('india') || text.includes('bengaluru') || text.includes('bangalore') || text.includes('.in')) return 'India';
    if (text.includes('israel') || text.includes('tel aviv') || text.includes('.il')) return 'Israel';
    if (text.includes('switzerland') || text.includes('zurich') || text.includes('.ch')) return 'Switzerland';
    if (text.includes('france') || text.includes('paris') || text.includes('.fr')) return 'France';
    if (text.includes('netherlands') || text.includes('amsterdam') || text.includes('.nl')) return 'Netherlands';
    if (text.includes('sweden') || text.includes('stockholm') || text.includes('.se')) return 'Sweden';
    if (text.includes('finland') || text.includes('helsinki') || text.includes('.fi')) return 'Finland';
    if (text.includes('estonia') || text.includes('tallinn') || text.includes('.ee')) return 'Estonia';
    if (text.includes('australia') || text.includes('sydney') || text.includes('.au')) return 'Australia';
    if (text.includes('canada') || text.includes('toronto') || text.includes('.ca')) return 'Canada';
    return 'Non-US Hub';
  };

  // Toggle Save Lead
  const handleToggleSave = (company: CompanyRecord) => {
    const exists = savedLeads.some((c) => c.website === company.website || c.name === company.name);
    let next: CompanyRecord[];
    if (exists) {
      next = savedLeads.filter((c) => c.website !== company.website && c.name !== company.name);
      showToast(`Removed "${company.name}" from your shortlist.`);
    } else {
      next = [...savedLeads, company];
      showToast(`Saved "${company.name}" to your shortlist! ⭐`);
    }
    setSavedLeads(next);
    try {
      localStorage.setItem('huntlyst_saved_companies', JSON.stringify(next));
    } catch {}
  };

  const handleRemoveSavedLead = (name: string) => {
    const next = savedLeads.filter((c) => c.name !== name);
    setSavedLeads(next);
    try {
      localStorage.setItem('huntlyst_saved_companies', JSON.stringify(next));
    } catch {}
    showToast(`Removed "${name}" from shortlist.`);
  };

  // Start Real Discovery Pipeline (Section 8)
  const handleStartHunt = async (huntConfig?: HuntConfig) => {
    if (isHuntingRef.current) {
      console.warn('[HUNT REJECTED] Hunt already in progress. Ignoring duplicate trigger.');
      return;
    }
    isHuntingRef.current = true;

    const activeCfg = huntConfig || TVB_EVALUATION_CONFIG;
    const huntId = activeCfg.id && activeCfg.id.startsWith('hunt_') && !activeCfg.id.includes('default')
      ? activeCfg.id
      : `hunt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    activeHuntIdRef.current = huntId;

    console.log(`[HUNT START]\nhuntId: ${huntId}\ntimestamp: ${new Date().toISOString()}`);
    console.log(`[API START]\nendpoint: /api/run-agent?stream=true\nhuntId: ${huntId}`);

    setActiveHuntConfig(activeCfg);
    setErrorMessage(null);
    setStatus('running');
    const targetDisplay = activeCfg.geography.countries.length > 0
      ? activeCfg.geography.countries.join(', ')
      : activeCfg.geography.regions.length > 0
      ? activeCfg.geography.regions.join(', ')
      : 'Global Non-US';

    setStatusMessage(`Initializing hunt: ${targetDisplay} (${activeCfg.targetLeads} leads)...`);
    setLogs([]);
    setCurrentStrategy('');
    setDuplicatesFiltered(0);
    setCurrentProgressIndex(1);
    setPipelineStats({
      discovered: 0,
      extracted: 0,
      nonUsPassed: 0,
      fundingQualified: 0,
      founderFound: 0,
      contactsChecked: 0,
      emailVerified: 0,
      emailsPartiallyVerified: 0,
      emailsUnverified: 0,
      finalRanked: 0,
      durationMs: 0,
    });

    const timestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
      const response = await fetch('/api/run-agent?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ ...activeCfg, huntId }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

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

            if (event.stats) {
              setPipelineStats(event.stats);
            }

            if (event.type === 'log' || event.type === 'candidate_found' || event.type === 'company_qualified') {
              if (event.type === 'log') {
                setLogs((prev) => [
                  ...prev,
                  { time: timestamp(), text: event.message, stage: event.stageName },
                ]);
              }
              setStatusMessage(event.message);

              if (event.message?.includes('Strategy ') || event.message?.includes('Executing Strategy')) {
                const stratMatch = event.message.match(/(Strategy \d+:[^.(]+)/i) || event.message.match(/Executing (Strategy [^.(]+)/i);
                if (stratMatch) setCurrentStrategy(stratMatch[1].trim());
              }
              if (event.message?.includes('duplicates filtered') || event.message?.includes('duplicates prevented')) {
                const dupeMatch = event.message.match(/(\d+)\s+duplicates/i);
                if (dupeMatch) setDuplicatesFiltered((prev) => Math.max(prev, parseInt(dupeMatch[1], 10)));
              }

              if (event.stage) {
                // Strictly monotonic progression: never rewind backwards
                setCurrentProgressIndex((prev) => Math.max(prev, event.stage!));
              } else if (event.stageName?.includes('Discovery') || event.stageName?.includes('Discovering')) {
                setCurrentProgressIndex((prev) => Math.max(prev, 1));
              } else if (event.stageName?.includes('Research') || event.stageName?.includes('Extraction')) {
                setCurrentProgressIndex((prev) => Math.max(prev, 2));
              } else if (event.stageName?.includes('Validation') || event.stageName?.includes('Validating')) {
                setCurrentProgressIndex((prev) => Math.max(prev, 3));
              } else if (event.stageName?.includes('Founder')) {
                setCurrentProgressIndex((prev) => Math.max(prev, 4));
              } else if (event.stageName?.includes('Contact') || event.stageName?.includes('Email')) {
                setCurrentProgressIndex((prev) => Math.max(prev, 5));
              } else if (event.stageName?.includes('Qualifying')) {
                setCurrentProgressIndex((prev) => Math.max(prev, 6));
              }
            } else if (event.type === 'complete' && event.result) {
              console.log(`[API COMPLETE]\nendpoint: /api/run-agent?stream=true\nhuntId: ${huntId}`);
              setResults(event.result);
              setCurrentProgressIndex(6);
              setStatus('success');
              setStatusMessage(
                `Hunt complete: ${event.result.companies.length} qualified leads found.`
              );

              const nowIso = new Date().toISOString();
              setLastRunTime(nowIso);
              try {
                localStorage.setItem('huntlyst_last_run_timestamp', nowIso);
                localStorage.setItem('huntlyst_current_run', JSON.stringify(event.result));
              } catch {}

              // Add to Run History
              const newRun: RunHistoryItem = {
                id: huntId,
                timestamp: nowIso,
                requestedCount: activeCfg.targetLeads || settings.agent.targetLeadsCount || 15,
                discoveredCount: event.result.stats?.discovered || event.result.totalDiscovered || 60,
                extractedCount: event.result.stats?.extracted || 40,
                qualifiedCount: event.result.companies.length,
                rejectedCount:
                  (event.result.stats?.discovered || 60) - event.result.companies.length,
                verifiedEmailsCount: event.result.companies.filter(
                  (c) => c.emailVerified || c.founderOrCeoEmail
                ).length,
                durationSeconds: Math.round((event.result.stats?.durationMs || 3000) / 1000),
                status: 'Completed',
                sector: activeCfg.sectors.join(', ') || selectedSector,
                companies: event.result.companies,
                rejectedCompanies: event.result.rejectedCompanies || [],
              };

              setRunHistory((prev) => {
                const next = [newRun, ...prev];
                try {
                  localStorage.setItem('huntlyst_run_history', JSON.stringify(next));
                } catch {}
                return next;
              });

              showToast(
                `Hunt discovered ${event.result.companies.length} qualified technology companies! ✨`
              );
            } else if (event.type === 'error') {
              console.log(`[API ERROR]\nendpoint: /api/run-agent?stream=true\nhuntId: ${huntId}\nerror: ${event.message || event.error}`);
              throw new Error(event.message || event.error);
            }
          } catch (parseErr) {
            // Ignore JSON parse errors on partial frames
          }
        }
      }
    } catch (err: any) {
      console.log(`[API ERROR]\nendpoint: /api/run-agent?stream=true\nhuntId: ${activeHuntIdRef.current || 'unknown'}\nerror: ${err.message || 'Pipeline execution failed.'}`);
      setStatus('error');
      setErrorMessage(err.message || 'Pipeline execution failed.');
      setStatusMessage('Hunt paused due to an error.');
      showToast(`Error: ${err.message || 'Pipeline execution failed.'}`);
    } finally {
      isHuntingRef.current = false;
    }
  };

  // Finalize Staged Discovery Results (Section: Multi-Stage Workflow)
  const handleFinalizeStagedResults = (
    qualifiedCompanies: CompanyRecord[],
    rejectedCompanies: RejectedCompanyRecord[]
  ) => {
    const resultObj: RunAgentResult = {
      companies: qualifiedCompanies,
      rejectedCompanies: rejectedCompanies,
      totalDiscovered: qualifiedCompanies.length + rejectedCompanies.length,
      totalQualified: qualifiedCompanies.length,
      stats: {
        discovered: qualifiedCompanies.length + rejectedCompanies.length,
        extracted: qualifiedCompanies.length + rejectedCompanies.length,
        nonUsPassed: qualifiedCompanies.length,
        fundingQualified: qualifiedCompanies.length,
        founderFound: qualifiedCompanies.filter((c) => !!c.founderOrCeoName).length,
        emailVerified: qualifiedCompanies.filter((c) => c.emailVerified).length,
        finalRanked: qualifiedCompanies.length,
        durationMs: 0,
      },
    };

    setResults(resultObj);
    setActiveNav('results');
    showToast(`Staged discovery complete! ${qualifiedCompanies.length} leads approved.`);

    const nowIso = new Date().toISOString();
    setLastRunTime(nowIso);
    try {
      localStorage.setItem('huntlyst_last_run_timestamp', nowIso);
      localStorage.setItem('huntlyst_current_run', JSON.stringify(resultObj));
    } catch {}

    // Add to Run History
    const newRun: RunHistoryItem = {
      id: `hunt-staged-${Date.now().toString(36)}`,
      timestamp: nowIso,
      requestedCount: qualifiedCompanies.length,
      discoveredCount: qualifiedCompanies.length + rejectedCompanies.length,
      extractedCount: qualifiedCompanies.length + rejectedCompanies.length,
      qualifiedCount: qualifiedCompanies.length,
      rejectedCount: rejectedCompanies.length,
      verifiedEmailsCount: qualifiedCompanies.filter(
        (c) => c.emailVerified || c.founderOrCeoEmail
      ).length,
      durationSeconds: 0,
      status: 'Completed',
      sector: activeHuntConfig.sectors.join(', ') || selectedSector,
      companies: qualifiedCompanies,
      rejectedCompanies: rejectedCompanies,
    };

    setRunHistory((prev) => {
      const next = [newRun, ...prev];
      try {
        localStorage.setItem('huntlyst_run_history', JSON.stringify(next));
      } catch {}
      return next;
    });
  };


  // Delete run from history
  const handleDeleteRun = (id: string) => {
    const next = runHistory.filter((r) => r.id !== id);
    setRunHistory(next);
    try {
      localStorage.setItem('huntlyst_run_history', JSON.stringify(next));
    } catch {}
    showToast('Hunt record deleted.');
  };

  const handleViewHistoricalRun = (run: RunHistoryItem) => {
    if (run.companies && run.companies.length > 0) {
      setResults({
        companies: run.companies,
        totalDiscovered: run.discoveredCount,
        totalQualified: run.qualifiedCount,
      });
      setActiveNav('results');
      showToast(`Loaded ${run.companies.length} companies from historical hunt.`);
    }
  };

  // Extract unique sectors & countries from results
  const availableSectors = useMemo(() => {
    if (!results?.companies) return [];
    const set = new Set<string>();
    results.companies.forEach((c) => {
      const s = c.industry || c.sector;
      if (s) set.add(s);
    });
    return Array.from(set);
  }, [results]);

  const availableCountries = useMemo(() => {
    if (!results?.companies) return [];
    const set = new Set<string>();
    results.companies.forEach((c) => {
      const country = c.country || c.location || getCountryName(c.auditDetails?.locationStatus || '', c.website);
      if (country) set.add(country);
    });
    return Array.from(set);
  }, [results]);

  // Filtered & Sorted Companies for Results View (Section 11)
  const filteredCompanies = useMemo(() => {
    if (!results?.companies) return [];

    let list = results.companies.filter((c) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(query) ||
        (c.founderOrCeoName && c.founderOrCeoName.toLowerCase().includes(query)) ||
        (c.founder?.name && c.founder.name.toLowerCase().includes(query)) ||
        ((c.industry || c.sector) && (c.industry || c.sector)!.toLowerCase().includes(query)) ||
        (c.description && c.description.toLowerCase().includes(query)) ||
        (c.founderOrCeoEmail && c.founderOrCeoEmail.toLowerCase().includes(query));

      const matchesSector =
        selectedSector === 'All Sectors' ||
        (c.industry || c.sector || '').toLowerCase().includes(selectedSector.toLowerCase());

      const country = c.country || c.location || getCountryName(c.auditDetails?.locationStatus || '', c.website);
      const matchesCountry = selectedCountry === 'ALL' || country === selectedCountry;

      const score = c.huntScore || calculateHuntScore(c).score;
      const matchesScore =
        selectedScoreFilter === 'ALL' ||
        (selectedScoreFilter === 'HIGH' && score >= 85) ||
        (selectedScoreFilter === 'PERFECT' && score >= 95);

      return matchesSearch && matchesSector && matchesCountry && matchesScore;
    });

    // Sorting
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'huntScore') {
        valA = a.huntScore || calculateHuntScore(a).score;
        valB = b.huntScore || calculateHuntScore(b).score;
      } else if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === 'sector') {
        valA = (a.industry || a.sector || '').toLowerCase();
        valB = (b.industry || b.sector || '').toLowerCase();
      } else if (sortField === 'location') {
        valA = (a.country || a.location || '').toLowerCase();
        valB = (b.country || b.location || '').toLowerCase();
      } else if (sortField === 'funding') {
        valA = a.fundingOrRevenue || '';
        valB = b.fundingOrRevenue || '';
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [results, searchQuery, selectedSector, selectedCountry, selectedScoreFilter, sortField, sortAsc]);

  // Telemetry counts
  const totalDiscovered = results?.totalDiscovered || pipelineStats?.discovered || 0;
  const totalQualified = results?.companies ? results.companies.length : (pipelineStats?.finalRanked || 0);
  const verifiedEmails = results?.companies
    ? results.companies.filter((c) => c.emailVerified || c.founderOrCeoEmail).length
    : (pipelineStats?.emailVerified || 0);
  const rejectedCandidates: RejectedCompanyRecord[] = results?.rejectedCompanies || [];
  const rejectedCount = rejectedCandidates.length > 0 ? rejectedCandidates.length : Math.max(0, totalDiscovered - totalQualified);

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#1E1B18] flex flex-col font-sans selection:bg-[#FFE7DC] selection:text-[#FF6B35]">
      {/* Intro / Splash Screen on initial application startup */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#1E1B18] text-[#FAF6EE] px-4 py-3 rounded-2xl shadow-sketch-lg border-2 border-[#1E1B18] text-xs font-mono font-bold animate-in fade-in slide-in-from-bottom duration-150">
          <span className="text-[#FF6B35] text-base">✦</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================================================== */}
      {/* 3. HEADER (Section 3)                              */}
      {/* ================================================== */}
      <header className="border-b-[1.8px] border-[#2C2724] bg-[#FAF6EE] sticky top-0 z-40 px-4 sm:px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* Left: Huntlyst Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveNav('home')}
              className="text-left focus:outline-none"
            >
              <HuntlystLogo size="md" />
            </button>
            <div className="hidden sm:flex flex-col border-l border-[#D9D0C1] pl-3 py-0.5">
              <span className="text-[11px] font-mono font-bold text-[#1E1B18] leading-tight">
                Company Discovery & Lead Intelligence
              </span>
              <span className="text-[10px] font-mono text-[#766E65]">
                Autonomous Venture Research
              </span>
            </div>
          </div>

          {/* Center: Hero Statement (Section 3) */}
          <div className="hidden lg:flex flex-col items-center text-center">
            <div className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-[#1E1B18]">
              <span className="text-[#FF6B35]">✦</span>
              <span className="marker-highlight px-1">Find the companies worth knowing.</span>
              <span className="text-[#FF6B35]">✦</span>
            </div>
            <span className="font-hand text-xs text-[#5A544E] tracking-wide mt-0.5">
              Autonomous research for high-potential technology companies.
            </span>
          </div>

          {/* Right: Build • Connect • Scale & Action */}
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono font-bold text-[#766E65] bg-[#FFFDF9] px-3 py-1.5 rounded-full border border-[#D9D0C1]">
              <span>Build</span>
              <span className="text-[#FF6B35]">•</span>
              <span>Connect</span>
              <span className="text-[#FF6B35]">•</span>
              <span>Scale</span>
            </div>

            {((results && results.companies.length > 0) || rejectedCandidates.length > 0) && (
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.8px] border-[#2C2724] bg-white hover:bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] shadow-sketch-sm"
              >
                <span>📦</span>
                <span>Export ({totalDiscovered || (results?.companies.length || 0) + rejectedCandidates.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveNav('about')}
              className="bg-[#FF6B35] hover:bg-[#F05820] text-white font-display font-bold text-xs sm:text-sm px-4 py-1.5 rounded-full border-[1.8px] border-[#2C2724] shadow-sketch hover:shadow-sketch-hover transition-all flex items-center gap-1"
            >
              <span>Huntlyst</span>
              <span className="text-xs">↗</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border-2 border-[#1E1B18] bg-white text-sm"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col md:flex-row p-4 sm:p-6 gap-6">
        {/* ================================================== */}
        {/* 4. SIDEBAR NAVIGATION (Section 4)                  */}
        {/* ================================================== */}
        <aside
          className={`${
            mobileMenuOpen ? 'block' : 'hidden'
          } md:block w-full md:w-56 shrink-0 flex flex-col justify-between space-y-6`}
        >
          <div className="space-y-4">
            <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
              {[
                {
                  key: 'home',
                  label: 'Home',
                  badge: undefined,
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
                    </svg>
                  ),
                },
                {
                  key: 'discover',
                  label: 'Discover',
                  badge: undefined,
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.5" y2="16.5" />
                      <circle cx="11" cy="11" r="3" stroke="currentColor" />
                    </svg>
                  ),
                },
                {
                  key: 'results',
                  label: 'Results',
                  badge: results?.companies.length ? results.companies.length : undefined,
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  ),
                },
                {
                  key: 'saved',
                  label: 'Saved Leads',
                  badge: savedLeads.length > 0 ? savedLeads.length : undefined,
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ),
                },
                {
                  key: 'history',
                  label: 'Hunt History',
                  badge: runHistory.length > 0 ? runHistory.length : undefined,
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 15" />
                    </svg>
                  ),
                },
                {
                  key: 'settings',
                  label: 'Settings',
                  badge: undefined,
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  ),
                },
                {
                  key: 'about',
                  label: 'About',
                  badge: undefined,
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <line x1="12" y1="8" x2="12" y2="8.01" strokeWidth="2.5" />
                      <line x1="12" y1="11" x2="12" y2="16" />
                    </svg>
                  ),
                },
              ].map((item) => {
                const isActive = activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.key as NavSection);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border-[1.8px] text-xs font-bold transition-all whitespace-nowrap md:w-full ${
                      isActive
                        ? 'bg-[#FFE7DC] text-[#FF6B35] border-[#FF6B35] shadow-sketch-sm'
                        : 'bg-[#FFFDF9] text-[#1E1B18] border-[#2C2724] hover:bg-[#FAF6EE] shadow-[1px_2px_0px_#2C2724]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-[#FF6B35]' : 'text-[#766E65]'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-[#FF6B35] text-white'
                            : 'bg-[#FAF6EE] text-[#1E1B18] border border-[#2C2724]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Decorative Compass Mark */}
            <div className="hidden md:flex flex-col items-center pt-4 text-center">
              <svg
                className="w-20 h-20 text-[#2C2724]"
                viewBox="0 0 120 80"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="60" cy="40" r="28" stroke="#2C2724" strokeWidth="1.8" />
                <circle cx="60" cy="40" r="18" stroke="#FF6B35" strokeDasharray="3 2" />
                <line x1="60" y1="12" x2="60" y2="68" stroke="#2C2724" strokeWidth="1.5" />
                <line x1="32" y1="40" x2="88" y2="40" stroke="#2C2724" strokeWidth="1.5" />
                <polygon points="60,20 64,36 60,40 56,36" fill="#FF6B35" stroke="#2C2724" />
                <polygon points="60,60 63,44 60,40 57,44" fill="#FFE7DC" stroke="#2C2724" />
              </svg>
              <div className="font-hand text-xs text-[#5A544E] mt-1">
                Research first.<br />
                <span className="font-bold text-[#1E1B18]">Outreach second.</span>
              </div>
            </div>
          </div>

          {/* Sticky Tape Note: Product Principle */}
          <div className="hidden md:block relative bg-[#FFFDF9] border-[1.8px] border-[#2C2724] rounded-xl p-3.5 shadow-sketch-sm text-xs space-y-2">
            <div className="tape-strip" />
            <div className="font-display text-base font-bold text-[#1E1B18] pt-1">
              Huntlyst Standard <span className="text-[#FF6B35]">✦</span>
            </div>
            <p className="text-[11px] text-[#5A544E] font-hand leading-relaxed">
              &quot;Missing data is better than invented data.&quot;
            </p>
            <div className="font-hand text-[10px] text-[#8C847A] pt-1 border-t border-[#F0EAD8]">
              ↳ Zero fabricated leads.
            </div>
          </div>
        </aside>

        {/* ================================================== */}
        {/* MAIN CONTENT AREA                                  */}
        {/* ================================================== */}
        <main className="flex-1 min-w-0">
          {/* VIEW 1: HOME DASHBOARD (Sections 5, 6, 7) */}
          {activeNav === 'home' && (
            <div className="space-y-6 pb-12 animate-in fade-in duration-200">
              {/* Hero Banner (Section 5) */}
              <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-8 relative shadow-sketch border-2 border-[#1E1B18] space-y-5">
                <div className="tape-strip" />
                <div className="tape-strip-right" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35]/30">
                      ⚡ Autonomous Lead Intelligence
                    </span>
                    <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E1B18] leading-[1.1] tracking-tight">
                      Find the companies <br className="hidden sm:inline" />
                      <span className="marker-highlight px-1">worth knowing.</span>
                    </h1>
                    <p className="text-sm sm:text-base text-[#4A443D] leading-relaxed">
                      Huntlyst autonomously discovers, researches and qualifies companies against your target profile.
                    </p>
                    <p className="font-hand text-sm text-[#FF6B35] font-bold">
                      ✎ &quot;Let the research begin.&quot;
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveNav('discover');
                        handleStartHunt();
                      }}
                      className="sketch-btn py-3.5 px-6 rounded-xl border-2 border-[#1E1B18] bg-[#FF6B35] hover:bg-[#F05820] text-white font-display text-lg font-bold shadow-sketch hover:shadow-sketch-hover transition-all flex items-center justify-center gap-2"
                    >
                      <span>▶</span>
                      <span>Start a Hunt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveNav(results?.companies ? 'results' : 'discover')}
                      className="sketch-btn py-3 px-5 rounded-xl border-2 border-[#1E1B18] bg-[#FFFDF9] hover:bg-[#FAF6EE] text-[#1E1B18] font-bold text-xs shadow-sketch-sm flex items-center justify-center gap-2"
                    >
                      <span>📋</span>
                      <span>{results?.companies ? `View Results (${results.companies.length})` : 'Configure Hunt Profile'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
                <div className="paper-card p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm">
                  <span className="text-[10px] text-[#766E65] uppercase block font-bold">Discovered</span>
                  <span className="font-display text-2xl font-bold text-[#1E1B18] mt-1 block">
                    {totalDiscovered}
                  </span>
                </div>
                <div className="paper-card p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm bg-[#E8F5E9]">
                  <span className="text-[10px] text-[#2E7D32] uppercase block font-bold">Qualified</span>
                  <span className="font-display text-2xl font-bold text-[#2E7D32] mt-1 block">
                    {totalQualified}
                  </span>
                </div>
                <div className="paper-card p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm">
                  <span className="text-[10px] text-[#766E65] uppercase block font-bold">Rejected</span>
                  <span className="font-display text-2xl font-bold text-[#C62828] mt-1 block">
                    {rejectedCount}
                  </span>
                </div>
                <div className="paper-card p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm">
                  <span className="text-[10px] text-[#766E65] uppercase block font-bold">Verified MX</span>
                  <span className="font-display text-2xl font-bold text-[#FF6B35] mt-1 block">
                    {verifiedEmails}
                  </span>
                </div>
                <div className="paper-card p-4 rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm">
                  <span className="text-[10px] text-[#766E65] uppercase block font-bold">Shortlist</span>
                  <span className="font-display text-2xl font-bold text-[#1E1B18] mt-1 block">
                    {savedLeads.length}
                  </span>
                </div>
              </div>

              {/* 6. TARGET PROFILE & 7. HOW HUNTLYST HUNTS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* How Huntlyst Hunts (Section 7) */}
                <div className="lg:col-span-8 paper-card p-6 rounded-2xl border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏹</span>
                      <h3 className="font-display text-xl font-bold text-[#1E1B18]">
                        How Huntlyst hunts
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-[#766E65]">
                      6-stage autonomous verification
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2">
                    {HUNT_WORKFLOW_STEPS.map((step, idx) => (
                      <div
                        key={step.num}
                        className="relative flex flex-col items-center text-center group"
                      >
                        <div className="w-full p-2.5 rounded-xl border-[1.5px] border-[#2C2724] bg-[#FFFDF9] shadow-[1px_2px_0px_#2C2724] min-h-[140px] flex flex-col justify-between hover:border-[#FF6B35] transition-colors">
                          <div className="w-5 h-5 rounded-full border border-[#2C2724] flex items-center justify-center font-display text-[10px] font-bold bg-[#FFE7DC] text-[#FF6B35] mx-auto">
                            {step.num}
                          </div>
                          <div className="my-1 text-[#1E1B18] group-hover:text-[#FF6B35] transition-colors">
                            {step.icon}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-[#1E1B18]">{step.title}</div>
                            <div className="font-sans text-[10px] text-[#5A544E] leading-tight mt-0.5">
                              {step.desc}
                            </div>
                          </div>
                        </div>

                        {idx < HUNT_WORKFLOW_STEPS.length - 1 && (
                          <span className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 text-[#FF6B35] font-bold text-xs z-10 select-none">
                            →
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. TARGET PROFILE (Section 6) */}
                <div className="lg:col-span-4 paper-card p-6 rounded-2xl border-2 border-[#1E1B18] shadow-sketch-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-2">
                      <span className="font-display text-lg font-bold text-[#1E1B18]">
                        Target Profile
                      </span>
                      <span className="text-[10px] font-mono bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded font-bold">
                        15+ qualified leads
                      </span>
                    </div>

                    <ul className="space-y-2 text-xs font-mono">
                      <li className="flex items-center gap-2">
                        <span className="text-[#2E7D32] font-bold">✓</span>
                        <span>$1M–$5M funding / revenue</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#2E7D32] font-bold">✓</span>
                        <span>Tech-related platform</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#2E7D32] font-bold">✓</span>
                        <span>Minimal / no US presence</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#2E7D32] font-bold">✓</span>
                        <span>CEO / Co-founder available</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#2E7D32] font-bold">✓</span>
                        <span>Verified professional email</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveNav('discover')}
                      className="sketch-btn w-full py-2.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center justify-center gap-2"
                    >
                      <span>▶</span> Start a Hunt
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Hunt History Summary (Section 15) */}
              <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-4">
                <div className="flex items-center justify-between border-b border-[#F0EAD8] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📜</span>
                    <h3 className="font-display text-xl font-bold text-[#1E1B18]">
                      Recent Hunts
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('history')}
                    className="text-xs font-mono text-[#FF6B35] hover:underline font-bold"
                  >
                    View All History ({runHistory.length}) →
                  </button>
                </div>

                {runHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs font-mono text-[#766E65] bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                    Nothing hunted yet. Start your first hunt from the Discover tab!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {runHistory.slice(0, 3).map((run) => (
                      <div
                        key={run.id}
                        className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-[#1E1B18]">
                            {new Date(run.timestamp).toLocaleDateString()}
                          </span>
                          <span className="text-[#2E7D32] font-bold">
                            {run.qualifiedCount} Qualified
                          </span>
                        </div>
                        <p className="text-[#5A544E] text-[11px]">
                          Target: {run.requestedCount} • Discovered: {run.discoveredCount} candidates
                        </p>
                        <button
                          type="button"
                          onClick={() => handleViewHistoricalRun(run)}
                          className="text-[#FF6B35] font-mono text-[11px] font-bold hover:underline block pt-1"
                        >
                          Review Leads →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: DISCOVER PAGE (Sections 9 & 10) */}
          {activeNav === 'discover' && (
            <DiscoverView
              config={settings}
              isRunning={status === 'running'}
              currentStep={currentProgressIndex}
              currentMessage={statusMessage}
              logs={logs}
              candidatesFound={totalDiscovered}
              qualifiedCount={totalQualified}
              onStartHunt={handleStartHunt}
              onViewResults={() => setActiveNav('results')}
              onFinalizeStagedResults={handleFinalizeStagedResults}
              onOpenLeadModal={(comp) => setSelectedCompany(comp)}
            />
          )}

          {/* VIEW 3: HUNT RESULTS (Section 11) */}
          {activeNav === 'results' && (
            <div className="space-y-6 pb-12 animate-in fade-in duration-200">
              {/* Header Banner */}
              <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 relative shadow-sketch-sm border-2 border-[#1E1B18]">
                <div className="tape-strip" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">📋</span>
                      <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                        Hunt Results
                      </h1>
                    </div>
                    <p className="text-xs font-mono text-[#766E65] mt-1">
                      {results?.companies ? `${results.companies.length} qualified companies matching target profile.` : 'No active hunt results.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {((results && results.companies.length > 0) || rejectedCandidates.length > 0) && (
                      <button
                        type="button"
                        onClick={() => setIsExportModalOpen(true)}
                        className="sketch-btn px-4 py-2 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center gap-1.5"
                      >
                        <span>📦</span> Export Research ({totalDiscovered || (results?.companies.length || 0) + rejectedCandidates.length})
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveNav('discover')}
                      className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center gap-1.5"
                    >
                      <span>▶</span> Start New Hunt
                    </button>
                  </div>
                </div>

                {/* Top Summary Cards (Section 11) */}
                {results?.companies && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5 pt-5 border-t border-[#F0EAD8] text-xs font-mono">
                    <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                      <span className="text-[10px] text-[#766E65] block">Candidates Found</span>
                      <span className="font-bold text-sm text-[#1E1B18]">{totalDiscovered}</span>
                    </div>
                    <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                      <span className="text-[10px] text-[#766E65] block">Researched</span>
                      <span className="font-bold text-sm text-[#1E1B18]">{results.stats?.extracted || totalDiscovered}</span>
                    </div>
                    <div className="p-3 bg-[#E8F5E9] rounded-xl border border-[#C8E6C9]">
                      <span className="text-[10px] text-[#2E7D32] block font-bold">Qualified</span>
                      <span className="font-bold text-sm text-[#2E7D32]">{totalQualified}</span>
                    </div>
                    <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                      <span className="text-[10px] text-[#766E65] block">Rejected</span>
                      <span className="font-bold text-sm text-[#C62828]">{rejectedCount}</span>
                    </div>
                    <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                      <span className="text-[10px] text-[#766E65] block">Verified Contacts</span>
                      <span className="font-bold text-sm text-[#FF6B35]">{verifiedEmails}</span>
                    </div>
                  </div>
                )}

                {/* Active Target Configuration Banner (Section 22) */}
                <div className="mt-4 p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">🎯</span>
                  <div className="text-xs font-mono leading-relaxed">
                    <span className="font-bold uppercase tracking-wider text-[#FF6B35] mr-2">TARGET:</span>
                    <span className="text-[#1E1B18] font-bold">
                      {activeHuntConfig?.targetProfile
                        ? formatTargetSummary(activeHuntConfig.targetProfile)
                        : `${activeHuntConfig?.targetLeads || 15} companies | ${activeHuntConfig?.sectors.join(', ') || 'Technology'} | ${activeHuntConfig?.funding.preset || '$1M–$5M'} | ${activeHuntConfig?.geography.countries.join(', ') || 'Global'} | Minimal/No US | CEO + Co-founder | Email Required`}
                    </span>
                  </div>
                </div>
              </div>

              {status === 'running' ? (
                <HuntLoadingScreen
                  config={activeHuntConfig}
                  currentStep={currentProgressIndex}
                  currentMessage={statusMessage}
                  currentStrategy={currentStrategy}
                  duplicatesFiltered={duplicatesFiltered}
                  candidatesFound={pipelineStats?.discovered || totalDiscovered}
                  qualifiedCount={totalQualified}
                  researchedCount={pipelineStats?.extracted}
                  validatedCount={pipelineStats?.nonUsPassed}
                  foundersFoundCount={pipelineStats?.founderFound}
                  contactsCheckedCount={pipelineStats?.contactsChecked}
                  verifiedContactsCount={pipelineStats?.emailVerified}
                  onViewResults={() => {}}
                />
              ) : status === 'error' ? (
                <HuntLoadingScreen
                  config={activeHuntConfig}
                  currentStep={currentProgressIndex}
                  currentMessage={statusMessage}
                  currentStrategy={currentStrategy}
                  duplicatesFiltered={duplicatesFiltered}
                  candidatesFound={pipelineStats?.discovered || totalDiscovered}
                  qualifiedCount={totalQualified}
                  researchedCount={pipelineStats?.extracted}
                  validatedCount={pipelineStats?.nonUsPassed}
                  foundersFoundCount={pipelineStats?.founderFound}
                  contactsCheckedCount={pipelineStats?.contactsChecked}
                  verifiedContactsCount={pipelineStats?.emailVerified}
                  errorMessage={errorMessage}
                  onRetry={() => handleStartHunt(activeHuntConfig)}
                />
              ) : !results || (results.companies.length === 0 && rejectedCandidates.length === 0) ? (
                <div className="paper-card bg-[#FFFDF9] rounded-2xl p-12 text-center border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
                  <div className="flex justify-center mx-auto">
                    <HuntlystLogo size="lg" state="idle" showWordmark={false} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-2xl font-bold text-[#1E1B18]">
                      No qualified companies found.
                    </h3>
                    <p className="text-xs text-[#766E65] max-w-md mx-auto">
                      Try widening your target profile or starting a new hunt from the Discover tab.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('discover')}
                    className="sketch-btn px-5 py-2.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm inline-flex items-center gap-2"
                  >
                    <span>▶</span> Start a Hunt
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Results Switcher: Qualified vs Rejected Candidates (Section 23) */}
                  <div className="flex items-center gap-2 border-b border-[#EBE4D5] pb-3">
                    <button
                      type="button"
                      onClick={() => setResultsTab('qualified')}
                      className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                        resultsTab === 'qualified'
                          ? 'bg-[#1E1B18] text-white border-[#1E1B18] shadow-sketch-xs'
                          : 'bg-white text-[#766E65] border-[#D9D0C1] hover:bg-[#FAF6EE]'
                      }`}
                    >
                      ✓ Qualified Companies ({totalQualified})
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultsTab('rejected')}
                      className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                        resultsTab === 'rejected'
                          ? 'bg-[#C62828] text-white border-[#C62828] shadow-sketch-xs'
                          : 'bg-white text-[#766E65] border-[#D9D0C1] hover:bg-[#FAF6EE]'
                      }`}
                    >
                      ✗ Rejected Candidates ({rejectedCount})
                    </button>
                  </div>

                  {resultsTab === 'rejected' ? (
                    /* REJECTED CANDIDATES VIEW (Section 23) */
                    <div className="space-y-3">
                      <div className="text-xs font-mono text-[#766E65] pb-1">
                        Preserved candidates that failed qualification criteria during autonomous verification:
                      </div>

                      {rejectedCandidates.length === 0 ? (
                        <div className="paper-card bg-[#FFFDF9] rounded-xl p-8 text-center border border-[#D9D0C1] text-xs font-mono text-[#766E65]">
                          No individual candidate failures logged for this round.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {rejectedCandidates.map((rej, i) => (
                            <div
                              key={`${rej.name}-${i}`}
                              className="paper-card bg-[#FFFDF9] rounded-xl p-4 border-2 border-[#EBE4D5] shadow-sketch-xs space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-sm text-[#1E1B18] flex items-center gap-1.5">
                                    <span className="text-[#C62828]">✗</span>
                                    <span>{rej.name}</span>
                                    {rej.website && (
                                      <a
                                        href={rej.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#766E65] hover:text-[#1E1B18] text-[10px]"
                                      >
                                        ↗
                                      </a>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-[#766E65]">
                                    {rej.industry || 'Venture'} • {rej.location || 'Undetermined'}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                  {rej.rejectionReasons?.map((r) => (
                                    <span
                                      key={r}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Rule Audit Checks */}
                              <div className="space-y-1 text-xs font-mono pt-1 border-t border-[#F0EAD8]">
                                {rej.matchedRules?.map((m, idx) => (
                                  <div key={idx} className="text-[#2E7D32] flex items-center gap-1.5">
                                    <span>{m}</span>
                                  </div>
                                ))}
                                {rej.failedRules?.map((f, idx) => (
                                  <div key={idx} className="text-[#C62828] font-bold flex items-center gap-1.5">
                                    <span>{f}</span>
                                  </div>
                                ))}
                              </div>

                              {rej.sourceEvidence && (
                                <div className="text-[11px] text-[#766E65] bg-[#FAF6EE] p-2 rounded-lg border border-[#EBE4D5] line-clamp-2">
                                  <span className="font-bold text-[#1E1B18]">Evidence: </span>
                                  {rej.sourceEvidence}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* QUALIFIED COMPANIES VIEW */
                    <div className="space-y-4">
                      {/* Results Filter Toolbar */}
                      <div className="paper-card bg-[#FFFDF9] rounded-xl p-4 border border-[#D9D0C1] shadow-sketch-sm flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
                        <div className="relative flex-1 w-full">
                          <span className="absolute left-3 top-2.5 text-xs text-[#766E65]">🔍</span>
                          <input
                            type="text"
                            placeholder="Search results by company, founder, or sector..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] focus:bg-white text-[#1E1B18] outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                          {availableSectors.length > 0 && (
                            <select
                              value={selectedSector}
                              onChange={(e) => setSelectedSector(e.target.value)}
                              className="px-3 py-2 rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] outline-none"
                            >
                              <option value="All Sectors">All Sectors</option>
                              {availableSectors.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          )}

                          {availableCountries.length > 0 && (
                            <select
                              value={selectedCountry}
                              onChange={(e) => setSelectedCountry(e.target.value)}
                              className="px-3 py-2 rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] outline-none"
                            >
                              <option value="ALL">All Countries</option>
                              {availableCountries.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          )}

                          <select
                            value={selectedScoreFilter}
                            onChange={(e) => setSelectedScoreFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-[#D9D0C1] bg-[#FAF6EE] text-xs font-bold text-[#1E1B18] outline-none"
                          >
                            <option value="ALL">All Scores</option>
                            <option value="HIGH">Score 85+ (High Fit)</option>
                            <option value="PERFECT">Score 95+ (Top Tier)</option>
                          </select>
                        </div>
                      </div>

                      {/* Selective Export Action Bar (Section 65) */}
                      {selectedRowIds.size > 0 && (
                        <div className="p-3 bg-[#FFF8F5] border-2 border-[#FF6B35] rounded-xl flex items-center justify-between text-xs animate-in fade-in shadow-sketch-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#1E1B18] font-mono">
                              ✓ {selectedRowIds.size} company record{selectedRowIds.size === 1 ? '' : 's'} selected
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedRowIds(new Set())}
                              className="text-[#766E65] hover:text-[#1E1B18] underline text-[11px] font-mono"
                            >
                              Clear Selection
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsExportModalOpen(true)}
                            className="sketch-btn px-3.5 py-1.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-lg shadow-sketch-xs flex items-center gap-1.5 transition-colors"
                          >
                            <span>📦</span>
                            <span>Export Selected ({selectedRowIds.size})</span>
                          </button>
                        </div>
                      )}

                      {/* Main Table (Section 11) */}
                      <div className="paper-card bg-[#FFFDF9] rounded-2xl border-2 border-[#1E1B18] shadow-sketch-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-[#1E1B18] text-[#FAF6EE] font-mono font-bold text-[11px] uppercase tracking-wider">
                                <th className="py-3 px-3 w-10 text-center">
                                  <input
                                    type="checkbox"
                                    checked={
                                      filteredCompanies.length > 0 &&
                                      filteredCompanies.every((c) => {
                                        const id = `lead-${c.website ? c.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase() : c.name.toLowerCase().replace(/\s+/g, '-')}`;
                                        return selectedRowIds.has(id);
                                      })
                                    }
                                    onChange={(e) => {
                                      const next = new Set(selectedRowIds);
                                      if (e.target.checked) {
                                        filteredCompanies.forEach((c) => {
                                          const id = `lead-${c.website ? c.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase() : c.name.toLowerCase().replace(/\s+/g, '-')}`;
                                          next.add(id);
                                        });
                                      } else {
                                        filteredCompanies.forEach((c) => {
                                          const id = `lead-${c.website ? c.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase() : c.name.toLowerCase().replace(/\s+/g, '-')}`;
                                          next.delete(id);
                                        });
                                      }
                                      setSelectedRowIds(next);
                                    }}
                                    className="w-4 h-4 text-[#FF6B35] rounded border-[#2C2724] cursor-pointer"
                                    title="Select all visible filtered companies"
                                  />
                                </th>
                                <th className="py-3 px-4">#</th>
                                <th className="py-3 px-4">Company</th>
                                <th className="py-3 px-4">Sector</th>
                                <th className="py-3 px-4">Funding / Rev</th>
                                <th className="py-3 px-4">Location</th>
                                <th className="py-3 px-4">Leader</th>
                                <th className="py-3 px-4">Verified Contact</th>
                                <th className="py-3 px-4">Hunt Score</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0EAD8]">
                              {filteredCompanies.map((company, idx) => {
                                const { score } = calculateHuntScore(company);
                                const isSaved = savedLeads.some((c) => c.name === company.name);
                                const founder = company.founderOrCeoName || company.founder?.name || 'Executive';
                                const email = company.founderOrCeoEmail || company.email?.address;
                                const isEmailVerified = company.emailVerified || company.email?.status === 'verified';
                                const rowId = `lead-${company.website ? company.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase() : company.name.toLowerCase().replace(/\s+/g, '-')}`;
                                const isSelected = selectedRowIds.has(rowId);

                                return (
                                  <tr
                                    key={company.name}
                                    className={`transition-colors ${isSelected ? 'bg-[#FFF3E0]' : 'hover:bg-[#FFF9F2]'}`}
                                  >
                                    <td className="py-3.5 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                          const next = new Set(selectedRowIds);
                                          if (next.has(rowId)) next.delete(rowId);
                                          else next.add(rowId);
                                          setSelectedRowIds(next);
                                        }}
                                        className="w-4 h-4 text-[#FF6B35] rounded border-[#1E1B18] cursor-pointer"
                                        aria-label={`Select ${company.name}`}
                                      />
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-[#766E65]">{idx + 1}</td>
                                    <td className="py-3.5 px-4">
                                      <div className="font-bold text-[#1E1B18] text-sm flex items-center gap-1.5 flex-wrap">
                                        <span>{company.name}</span>
                                        {company.statusTag && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/30 font-mono">
                                            {company.statusTag}
                                          </span>
                                        )}
                                        {company.website && (
                                          <a
                                            href={company.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#FF6B35] hover:underline text-[10px]"
                                          >
                                            ↗
                                          </a>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-[#766E65] line-clamp-1 max-w-xs">
                                        {company.description || 'Verified enterprise candidate.'}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-[#FAF6EE] text-[#1E1B18] border border-[#EBE4D5]">
                                        {company.industry || company.sector || 'Venture'}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono font-bold text-[#1E1B18]">
                                      {company.fundingOrRevenue || '$1M–$5M'}
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#5A544E]">
                                      📍 {company.country || company.location || 'Non-US Hub'}
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <div className="font-bold text-[#1E1B18]">{founder}</div>
                                      <span className="text-[10px] text-[#766E65] font-mono">CEO / Co-founder</span>
                                    </td>
                                    <td className="py-3.5 px-4">
                                      {email ? (
                                        <span
                                          className={`inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                                            isEmailVerified
                                              ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/30'
                                              : 'bg-[#FAF6EE] text-[#8C847A]'
                                          }`}
                                        >
                                          {email}
                                        </span>
                                      ) : (
                                        <span className="text-[#8C847A] italic text-[11px]">Unverified</span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35]/30">
                                        {score} / 100
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedCompany(company)}
                                          className="p-1.5 rounded-lg border border-[#D9D0C1] bg-white hover:bg-[#FAF6EE] text-xs"
                                          title="View Details"
                                        >
                                          🔍
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleSave(company)}
                                          className={`p-1.5 rounded-lg border text-xs ${
                                            isSaved
                                              ? 'bg-[#FFE7DC] border-[#FF6B35] text-[#FF6B35]'
                                              : 'bg-white border-[#D9D0C1] hover:bg-[#FAF6EE]'
                                          }`}
                                          title={isSaved ? 'Remove from Shortlist' : 'Save to Shortlist'}
                                        >
                                          {isSaved ? '⭐' : '☆'}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: SAVED LEADS (Section 14) */}
          {activeNav === 'saved' && (
            <SavedLeadsView
              savedLeads={savedLeads}
              onRemoveLead={handleRemoveSavedLead}
              onViewLead={(c) => setSelectedCompany(c)}
              onToast={showToast}
              onNavigateToDiscovery={() => setActiveNav('discover')}
            />
          )}

          {/* VIEW 5: HUNT HISTORY (Section 15) */}
          {activeNav === 'history' && (
            <HuntHistoryView
              history={runHistory}
              onViewRun={handleViewHistoricalRun}
              onDeleteRun={handleDeleteRun}
              onToast={showToast}
              onNavigateToDiscover={() => setActiveNav('discover')}
            />
          )}

          {/* VIEW 6: SETTINGS (Section 17) */}
          {activeNav === 'settings' && (
            <SettingsView
              onToast={showToast}
              onClearCurrentRun={() => {
                setResults(null);
                try {
                  localStorage.removeItem('huntlyst_current_run');
                } catch {}
                showToast('Current hunt results cleared.');
              }}
              onClearSavedLeads={() => {
                setSavedLeads([]);
                try {
                  localStorage.removeItem('huntlyst_saved_companies');
                } catch {}
                showToast('Shortlist cleared.');
              }}
              onClearCache={() => {
                localStorage.clear();
                setResults(null);
                setSavedLeads([]);
                setRunHistory([]);
                showToast('All local storage cache reset.');
              }}
              onExportAllData={() => {
                if (results?.companies) {
                  downloadCsvFile(results.companies, 'huntlyst-complete-export.csv');
                  showToast('Exported complete data package.');
                } else {
                  showToast('No leads available to export.');
                }
              }}
            />
          )}

          {/* VIEW 7: ABOUT (Section 18) */}
          {activeNav === 'about' && <AboutView />}
        </main>
      </div>

      {/* ================================================== */}
      {/* FOOTER                                             */}
      {/* ================================================== */}
      <footer className="w-full border-t-[1.8px] border-[#2C2724] bg-[#FAF6EE] py-3 px-4 sm:px-6 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-center sm:justify-end gap-3 text-xs">
          <span className="font-hand text-sm text-[#5A544E]">
            Built by <span className="font-bold text-[#1E1B18]">Mohit Sah</span>
          </span>
          <span className="text-[#8C847A] hidden sm:inline" aria-hidden="true">•</span>
          <div className="flex items-center gap-3">
            <a
              href="https://x.com/mohitsah08"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1E1B18] hover:text-[#FF6B35] transition-colors p-1 inline-flex items-center justify-center"
              aria-label="Mohit Sah on X (Twitter)"
            >
              <i className="ti ti-brand-x text-[22px]" aria-hidden="true" />
            </a>
            <a
              href="https://www.instagram.com/mohitsah08"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1E1B18] hover:text-[#FF6B35] transition-colors p-1 inline-flex items-center justify-center"
              aria-label="Mohit Sah on Instagram"
            >
              <i className="ti ti-brand-instagram text-[22px]" aria-hidden="true" />
            </a>
            <a
              href="https://www.facebook.com/share/1To1g5xUuv/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1E1B18] hover:text-[#FF6B35] transition-colors p-1 inline-flex items-center justify-center"
              aria-label="Mohit Sah on Facebook"
            >
              <i className="ti ti-brand-facebook text-[22px]" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {selectedCompany && (
        <LeadDetailModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onSaveToggle={handleToggleSave}
          isSaved={savedLeads.some((c) => c.name === selectedCompany.name)}
          onToast={showToast}
        />
      )}

      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          companies={results?.companies || []}
          rejectedCompanies={rejectedCandidates}
          selectedIds={Array.from(selectedRowIds)}
          onToast={showToast}
          huntId={results ? 'hunt-results-active' : undefined}
          searchQuery={searchQuery}
        />
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}