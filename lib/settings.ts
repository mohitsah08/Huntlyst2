/**
 * Settings Default & Storage Management Module
 */

import { SettingsConfig } from './types';

export const DEFAULT_SETTINGS: SettingsConfig = {
  agent: {
    targetLeadsCount: 15,
    minFunding: 1000000, // $1M USD (Assignment Default)
    maxFunding: 5000000, // $5M USD (Assignment Default)
    techPlatformRequired: true, // Required (Assignment Default)
    usPresenceStrictness: 'strict_non_us', // Strict non-US (Assignment Default)
    minConfidenceThreshold: 0.8, // 80%
    maxResearchCandidates: 60,
    searchDepth: 'standard',
    deduplicationEnabled: true,
  },
  sources: {
    verifiedRegistry: true,
    rssFundingWires: true,
    openWebSearch: true,
    serpApi: true,
  },
  output: {
    defaultExportFormat: 'CSV',
    includeEvidence: true,
    includeRejectedLeads: false,
    includeTimestamp: true,
  },
  appearance: {
    paperTexture: true,
    sketchDecorations: true,
    tableDensity: 'comfortable',
    animations: true,
  },
};

const STORAGE_KEY = 'tvb_agent_settings';

export function loadSettings(): SettingsConfig {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      agent: { ...DEFAULT_SETTINGS.agent, ...parsed.agent },
      sources: { ...DEFAULT_SETTINGS.sources, ...parsed.sources },
      output: { ...DEFAULT_SETTINGS.output, ...parsed.output },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SettingsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function resetSettingsToDefault(): SettingsConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {}
  }
  return DEFAULT_SETTINGS;
}

export function isAssignmentDefault(settings: SettingsConfig): boolean {
  return (
    settings.agent.minFunding === 1000000 &&
    settings.agent.maxFunding === 5000000 &&
    settings.agent.techPlatformRequired === true &&
    settings.agent.usPresenceStrictness === 'strict_non_us' &&
    settings.agent.targetLeadsCount === 15
  );
}
