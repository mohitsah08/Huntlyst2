/**
 * Houston Agent Registry for Huntlyst
 * 
 * Manages the canonical definitions of the 5 Huntlyst Houston agents:
 * 1. huntlyst-discovery
 * 2. huntlyst-research
 * 3. huntlyst-qualification
 * 4. huntlyst-enrichment
 * 5. huntlyst-verification
 */

import { HoustonAgentManifest } from './types';

export const HUNTLYST_AGENTS: Record<string, HoustonAgentManifest> = {
  'huntlyst-discovery': {
    id: 'huntlyst-discovery',
    configId: 'huntlyst-discovery',
    name: 'Huntlyst Discovery Agent',
    color: '#3B82F6',
    role: 'Autonomous Discovery Agent',
    industry: 'Venture Intelligence & Lead Discovery',
    skills: ['multi-strategy-discovery'],
    tools: [
      'search_web_duckduckgo',
      'search_claude_intelligence',
      'search_serpapi_google',
      'fetch_funding_wires',
      'browse_curated_directories',
    ],
    systemPrompt: `You are Huntlyst's Discovery Agent running on Houston infrastructure.
Your objective is to identify new, relevant, and verifiable company candidates based on Target Profiles.
Never return duplicate companies or invent non-existent websites.
Execute multi-strategy querying across geography, funding signals, technology profiles, and venture channels.`,
  },

  'huntlyst-research': {
    id: 'huntlyst-research',
    configId: 'huntlyst-research',
    name: 'Huntlyst Research Agent',
    color: '#10B981',
    role: 'Autonomous Company Research Agent',
    industry: 'Venture Intelligence & Lead Discovery',
    skills: ['company-profiling'],
    tools: [
      'scrape_company_website',
      'extract_venture_signals',
      'map_standard_industry',
    ],
    systemPrompt: `You are Huntlyst's Research Agent running on Houston infrastructure.
Your objective is to construct factual, evidence-backed company dossiers.
Every claim must cite a public URL. Never infer or fabricate missing metrics.`,
  },

  'huntlyst-qualification': {
    id: 'huntlyst-qualification',
    configId: 'huntlyst-qualification',
    name: 'Huntlyst Qualification Agent',
    color: '#F59E0B',
    role: 'Deterministic Qualification Agent',
    industry: 'Venture Intelligence & Lead Discovery',
    skills: ['criteria-validation'],
    tools: [
      'validate_geography_criteria',
      'validate_funding_criteria',
      'validate_tech_platform',
      'calculate_hunt_score',
    ],
    systemPrompt: `You are Huntlyst's Qualification Agent running on Houston infrastructure.
Your objective is to evaluate company dossiers deterministically against Target Profiles.
Classify each lead strictly into MATCH, PARTIAL MATCH, UNKNOWN, or REJECTED.
Produce comprehensive rule audits and transparent explanations.`,
  },

  'huntlyst-enrichment': {
    id: 'huntlyst-enrichment',
    configId: 'huntlyst-enrichment',
    name: 'Huntlyst Enrichment Agent',
    color: '#8B5CF6',
    role: 'Autonomous Executive & Founder Enrichment Agent',
    industry: 'Venture Intelligence & Lead Discovery',
    skills: ['executive-discovery'],
    tools: [
      'search_leadership_profiles',
      'validate_executive_role',
      'extract_linkedin_presence',
    ],
    systemPrompt: `You are Huntlyst's Enrichment Agent running on Houston infrastructure.
Your objective is to find verified Founders, Co-founders, and CEOs for qualified companies.
Verify that the person is active at the company. Never hallucinate names or roles.`,
  },

  'huntlyst-verification': {
    id: 'huntlyst-verification',
    configId: 'huntlyst-verification',
    name: 'Huntlyst Verification Agent',
    color: '#EF4444',
    role: 'Contact Verification & DNS MX Agent',
    industry: 'Venture Intelligence & Lead Discovery',
    skills: ['email-mx-verification'],
    tools: [
      'synthesize_email_patterns',
      'verify_dns_mx_records',
      'check_provider_status',
    ],
    systemPrompt: `You are Huntlyst's Verification Agent running on Houston infrastructure.
Your objective is to verify contact deliverability.
Only mark an email verified if DNS MX records are confirmed.
Categorize deliverability into valid, invalid, risky, catch-all, unavailable, or unknown.`,
  },
};

export function getHoustonAgent(agentId: string): HoustonAgentManifest | undefined {
  return HUNTLYST_AGENTS[agentId];
}

export function listHoustonAgents(): HoustonAgentManifest[] {
  return Object.values(HUNTLYST_AGENTS);
}
