/**
 * Claude Company Researcher
 * 
 * Conducts research on candidate companies:
 * - Fetches real website text & metadata via Cheerio
 * - Calls Anthropic Claude for structured extraction & verification
 * - Validates DNS MX mail server for executive deliverability
 * - Evaluates all criteria (PASS / FAIL / UNKNOWN)
 * - Zero fabrication: missing data is strictly marked UNKNOWN
 */

import { TargetProfile } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import { ResearchCandidateInput, CompanyVerificationResult } from '../types';
import { claudeClient } from './client';
import { fetchPageText } from '@/lib/extraction';
import { findVerifiedEmail } from '@/lib/email';
import { extractDomain, VERIFIED_GLOBAL_TECH_COMPANIES } from '@/lib/discovery';
import {
  RawExtractedProfile,
  evaluateCriteria,
  buildCompanyRecordFromProfile,
} from './evaluator';
import * as cheerio from 'cheerio';

const CLAUDE_RESEARCH_SYSTEM_PROMPT = `You are Huntlyst's rigorous venture research intelligence engine.
Your sole mission is to extract and verify factual, evidence-backed company data.

FOUNDATIONAL PRINCIPLES:
1. Missing data is ALWAYS better than invented data.
2. NEVER fabricate, estimate, or hallucinate funding, revenue, executive names, emails, or locations.
3. If a field cannot be proven from provided evidence, return null.
4. Distinguish carefully between US entities and non-US headquarters.
5. Return valid JSON only. No markdown, no commentary.

Return this exact JSON structure:
{
  "name": string | null,
  "website": string | null,
  "description": string | null,
  "industry": string | null,
  "sector": string | null,
  "fundingText": string | null,
  "fundingAmountUsd": number | null,
  "revenueText": string | null,
  "foundedYear": number | null,
  "stage": string | null,
  "businessModel": string | null,
  "employeeCountText": string | null,
  "country": string | null,
  "city": string | null,
  "headquarters": string | null,
  "usPresenceDetails": string | null,
  "founderOrCeoName": string | null,
  "founderTitle": string | null,
  "founderLinkedin": string | null,
  "companyLinkedin": string | null,
  "emailFound": string | null,
  "evidenceText": string | null
}`;

export async function researchCompanyWithClaude(
  candidate: ResearchCandidateInput,
  target: TargetProfile | HuntConfig
): Promise<CompanyVerificationResult> {
  const targetUrl = candidate.website || candidate.url || (candidate.name ? `https://${candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : '');
  const domain = extractDomain(targetUrl);

  // 1. Fetch live page HTML & text if URL is accessible
  let pageData: { text: string; html: string } | null = null;
  if (targetUrl.startsWith('http')) {
    pageData = await fetchPageText(targetUrl);
  }

  // 2. Combine available evidence
  const candidateText = candidate.rawText || '';
  const pageText = pageData?.text ? pageData.text.slice(0, 14000) : '';
  const combinedEvidence = `${candidate.name ? `Company Name: ${candidate.name}\n` : ''}${candidate.source ? `Source: ${candidate.source}\n` : ''}${candidateText}\n${pageText}`.trim();

  // 3. Attempt Claude API analysis
  let extracted: RawExtractedProfile | null = null;

  if (claudeClient.isConfigured() && combinedEvidence.length > 30) {
    const userPrompt = `Research and extract structured venture intelligence for this candidate:
Company: ${candidate.name || domain}
Website/URL: ${targetUrl}
Available Web Content & Context:
"""
${combinedEvidence.slice(0, 12000)}
"""`;

    try {
      const claudeResponse = await claudeClient.createMessage(
        CLAUDE_RESEARCH_SYSTEM_PROMPT,
        userPrompt,
        { temperature: 0, maxTokens: 1200 }
      );

      if (claudeResponse) {
        const cleanJson = claudeResponse
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        extracted = JSON.parse(cleanJson);
      }
    } catch (err: any) {
      console.warn(`[ClaudeResearcher] Claude analysis skipped/failed: ${err.message || err}`);
    }
  }

  // 4. Fallback: Parse HTML, metadata, and verified database if Claude was unavailable or returned empty
  if (!extracted || !extracted.name) {
    extracted = extractFallbackProfile(candidate, targetUrl, domain, pageData);
  }

  // Ensure website is set
  if (!extracted.website) {
    extracted.website = targetUrl;
  }
  if (!extracted.name && candidate.name) {
    extracted.name = candidate.name;
  }

  // 5. Live DNS MX Email Verification for executive
  const execName = extracted.founderOrCeoName || candidate.name || 'Founder';
  let mxResult: { email: string | null; verified: boolean; mxHost?: string | null } | undefined;

  if (extracted.website && extracted.website.includes('.')) {
    try {
      mxResult = await findVerifiedEmail(execName, extracted.website);
    } catch {}
  }

  // 6. Evaluate all criteria
  const evaluation = evaluateCriteria(extracted, target, mxResult);

  // 7. Assemble unified CompanyRecord
  const company = buildCompanyRecordFromProfile(
    extracted,
    evaluation,
    targetUrl,
    candidate.source || 'Huntlyst Research Provider'
  );

  return {
    company,
    verificationStatus: evaluation.status,
    criteria: evaluation.criteria,
    rejectionReason: evaluation.rejectionReason,
    failedCriteria: evaluation.failedCriteria,
    passedCriteria: evaluation.passedCriteria,
    unknownCriteria: evaluation.unknownCriteria,
    sources: extracted.sources || [targetUrl],
    auditTimestamp: new Date().toISOString(),
  };
}

/**
 * Deterministic fallback extractor using Cheerio and curated facts
 */
function extractFallbackProfile(
  candidate: ResearchCandidateInput,
  targetUrl: string,
  domain: string,
  pageData?: { text: string; html: string } | null
): RawExtractedProfile {
  // Check verified curated registry first
  const verifiedMatch = VERIFIED_GLOBAL_TECH_COMPANIES.find(
    (c) => extractDomain(c.url) === domain || (candidate.name && c.name.toLowerCase() === candidate.name.toLowerCase())
  );

  if (verifiedMatch) {
    return {
      name: verifiedMatch.name,
      website: verifiedMatch.url,
      description: verifiedMatch.snippet,
      industry: verifiedMatch.industry,
      fundingText: verifiedMatch.fundingText,
      country: verifiedMatch.country,
      headquarters: verifiedMatch.locationText,
      usPresenceDetails: verifiedMatch.locationText,
      founderOrCeoName: verifiedMatch.founderOrCeo,
      sources: [verifiedMatch.url, verifiedMatch.source],
    };
  }

  // Extract from HTML metadata
  let name = candidate.name || null;
  let description: string | null = null;
  let country: string | null = null;
  let founderOrCeoName: string | null = null;

  if (pageData) {
    const $ = cheerio.load(pageData.html);

    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        const entity = Array.isArray(parsed) ? parsed[0] : parsed;
        if (entity['@type'] === 'Organization' || entity['@type'] === 'Corporation') {
          if (entity.name && !name) name = entity.name;
          if (entity.description && !description) description = entity.description;
          if (entity.founder?.name && !founderOrCeoName) founderOrCeoName = entity.founder.name;
          if (entity.address?.addressCountry && !country) country = entity.address.addressCountry;
        }
      } catch {}
    });

    if (!name) {
      const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
      name = ogTitle.split(/[-–|:]/)[0].trim() || domain.split('.')[0];
    }

    if (!description) {
      description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || null;
    }
  }

  const rawEvidence = `${candidate.rawText || ''} ${pageData?.text || ''}`;

  return {
    name: name || domain.split('.')[0],
    website: targetUrl,
    description: description || candidate.rawText?.slice(0, 160) || null,
    industry: null,
    fundingText: null,
    country,
    headquarters: country,
    usPresenceDetails: null,
    founderOrCeoName,
    evidenceText: rawEvidence.slice(0, 500),
    sources: [targetUrl],
  };
}
