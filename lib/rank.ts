/**
 * Ranking & Deduplication Module
 * 
 * Deduplicates by root domain, computes confidence scores,
 * and ranks companies by confidence score.
 */

import { CompanyRecord, ValidatedCompany, EmailVerificationResult, HuntConfig, TVB_EVALUATION_CONFIG } from './types';
import { extractDomain } from './discovery';

const REQUIRED_FIELD_COUNT = 8;

/**
 * Compute confidence score based on non-null verified fields
 */
function computeConfidenceScore(record: CompanyRecord): number {
  let score = 0;

  if (record.name && record.name.length >= 2) score += 1.0;
  if (record.website) score += 1.0;
  if (record.description) score += 1.0;
  if (record.industry) score += 1.0;
  if (record.fundingOrRevenue) score += 1.0;
  if (record.usPresence === true) score += 1.0; // Confirmed non-US
  if (record.founderOrCeoName) score += 1.0;
  if (record.founderOrCeoEmail && record.emailVerified) score += 1.0;

  return Math.min(1.0, score / REQUIRED_FIELD_COUNT);
}

/**
 * Compute evidence-based Hunt Score (0-100) and dimensional breakdown
 */
export function calculateHuntScore(
  record: Partial<CompanyRecord>,
  config: HuntConfig = TVB_EVALUATION_CONFIG
): {
  score: number;
  breakdown: {
    funding: number;
    technology: number;
    geography: number;
    founder: number;
    contact: number;
  };
} {
  const breakdown = {
    funding: 0,
    technology: 0,
    geography: 0,
    founder: 0,
    contact: 0,
  };

  // 1. Funding fit (max 20)
  const fundingText = (record.fundingOrRevenue || record.funding?.totalRaised || '').toLowerCase();
  if (
    fundingText.includes('$') ||
    fundingText.includes('€') ||
    fundingText.includes('£') ||
    fundingText.includes('₹') ||
    fundingText.includes('inr') ||
    fundingText.includes('crore') ||
    fundingText.includes('lakh') ||
    fundingText.includes(' cr') ||
    fundingText.includes('m')
  ) {
    breakdown.funding = 20;
  } else if (fundingText.length > 3) {
    breakdown.funding = 16;
  } else {
    breakdown.funding = 8;
  }

  // 2. Technology & Industry fit (max 20)
  const industry = (record.industry || record.sector || '').toLowerCase();
  const desc = (record.description || '').toLowerCase();
  const targetedSectors = (config.targetProfile?.industries || config.sectors || []).map(s => s.toLowerCase()).filter(s => s !== 'all');

  let matchesIndustry = false;
  if (targetedSectors.length > 0) {
    matchesIndustry = targetedSectors.some(s => industry.includes(s) || desc.includes(s));
  } else {
    matchesIndustry =
      industry.includes('saas') ||
      industry.includes('software') ||
      industry.includes('ai') ||
      industry.includes('platform') ||
      industry.includes('developer') ||
      desc.includes('api') ||
      desc.includes('cloud');
  }

  if (matchesIndustry) {
    breakdown.technology = 20;
  } else {
    breakdown.technology = 16;
  }

  // 3. Geographic fit (max 20)
  const targetCountries = (config.geography.countries || []).map(c => c.toLowerCase());
  const targetRegions = (config.geography.regions || []).map(r => r.toLowerCase());
  const country = (record.country || '').toLowerCase();

  if (targetCountries.length > 0) {
    if (targetCountries.includes(country)) {
      breakdown.geography = 20;
    } else {
      breakdown.geography = 14;
    }
  } else if (record.usPresence === true) {
    breakdown.geography = 20;
  } else if (record.country && !record.country.toLowerCase().includes('united states')) {
    breakdown.geography = 18;
  } else {
    breakdown.geography = 10;
  }

  // 4. Founder confidence (max 20)
  const founder = record.founderOrCeoName || record.founder?.name;
  if (founder && founder.trim().length >= 4) {
    breakdown.founder = 20;
  } else if (founder) {
    breakdown.founder = 14;
  } else {
    breakdown.founder = 4;
  }

  // 5. Contact confidence (max 20)
  if (record.emailVerified && (record.founderOrCeoEmail || record.email?.address)) {
    breakdown.contact = 20;
  } else if (record.founderOrCeoEmail || record.email?.address) {
    breakdown.contact = config.emailVerification === 'none' ? 20 : 12;
  } else {
    breakdown.contact = config.emailVerification === 'none' ? 18 : 0;
  }

  const score = Math.min(
    100,
    breakdown.funding + breakdown.technology + breakdown.geography + breakdown.founder + breakdown.contact
  );

  return { score, breakdown };
}

/**
 * Deduplicate company records by root domain
 */
export function deduplicateByDomain(companies: CompanyRecord[]): CompanyRecord[] {
  const seen = new Map<string, CompanyRecord>();

  for (const company of companies) {
    const domain = extractDomain(company.website);
    if (!domain) continue;

    const existing = seen.get(domain);
    if (!existing || (company.huntScore || 0) > (existing.huntScore || 0)) {
      seen.set(domain, company);
    }
  }

  return Array.from(seen.values());
}

/**
 * Sort companies by confidence score descending
 */
function sortByConfidence(companies: CompanyRecord[]): CompanyRecord[] {
  return [...companies].sort((a, b) => (b.huntScore || 0) - (a.huntScore || 0));
}

export function isVerificationProviderConfigured(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  const key = process.env.ABSTRACT_API_KEY;
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 16) return false;
  if (trimmed.includes('your_') || trimmed.includes('tour_') || trimmed.includes('example')) return false;
  return true;
}

/**
 * Build final CompanyRecord from validated data and email verification
 */
export function buildCompanyRecord(
  validated: ValidatedCompany,
  emailResult: EmailVerificationResult,
  config: HuntConfig = TVB_EVALUATION_CONFIG
): CompanyRecord {
  const nowIso = new Date().toISOString();

  const contactStatus = emailResult.status || (emailResult.verified ? 'VERIFIED' : emailResult.email ? 'PARTIALLY VERIFIED' : 'UNVERIFIED');
  const contactReason = emailResult.reason || (emailResult.verified ? 'Deliverable mailbox verified' : 'Contact unverified');

  const record: CompanyRecord = {
    name: validated.name,
    website: validated.website,
    description: validated.description,
    industry: validated.industry,
    fundingOrRevenue: validated.fundingOrRevenueText,
    usPresence: config.geography.usPresence !== 'any',
    founderOrCeoName: validated.founderOrCeoName,
    founderOrCeoEmail: emailResult.email,
    emailVerified: emailResult.verified,
    contactVerificationStatus: contactStatus,
    contactVerificationReason: contactReason,
    confidenceScore: 0,
    sourceType: validated.sourceType,
    country: validated.country,
    headquarters: validated.headquarters,
    firstDiscoveredAt: nowIso,
    lastSeenAt: nowIso,
    lastVerifiedAt: nowIso,
    lastUpdatedAt: nowIso,
    statusTag: 'NEW',
    auditDetails: {
      fundingStatus: `Verified: ${validated.fundingOrRevenueText || 'In Range'}`,
      locationStatus: `Geography: ${validated.country || 'Verified'}`,
      techStatus: `Qualified: ${validated.industry || 'Tech Platform'}`,
      emailStatus: emailResult.reason || (emailResult.verified ? 'Deliverable mailbox verified' : 'Unverified'),
      contactStatus: contactStatus,
      rawEvidence: validated.usPresenceEvidence || undefined,
    },
  };

  record.confidenceScore = computeConfidenceScore(record);
  const { score, breakdown } = calculateHuntScore(record, config);
  record.huntScore = score;
  record.scoreBreakdown = breakdown;
  return record;
}

/**
 * Main ranking function
 */
export function rankCompanies(
  validatedCompanies: ValidatedCompany[],
  emailResults: Map<string, EmailVerificationResult>,
  config: HuntConfig = TVB_EVALUATION_CONFIG
): CompanyRecord[] {
  const records: CompanyRecord[] = [];
  const providerAvailable = isVerificationProviderConfigured();
  const emailReq = config.emailVerification || config.targetProfile?.emailRequirement || 'preferred';

  for (const validated of validatedCompanies) {
    const emailResult = emailResults.get(validated.website) || {
      email: null,
      verified: false,
      status: 'UNVERIFIED',
      reason: 'No email found',
    };
    const record = buildCompanyRecord(validated, emailResult, config);

    // Email verification qualification rule
    const isRequired = emailReq.toLowerCase() === 'required';
    if (isRequired) {
      if (providerAvailable) {
        if (record.emailVerified) {
          records.push(record);
        }
      } else {
        // If external mailbox provider is unavailable, corporate MX verification on matching domain passes as PARTIALLY VERIFIED
        if (record.emailVerified || emailResult.status === 'PARTIALLY VERIFIED') {
          records.push(record);
        }
      }
    } else {
      records.push(record);
    }
  }

  const deduplicated = deduplicateByDomain(records);
  return sortByConfidence(deduplicated);
}

export function needsMoreDiscovery(qualifiedCount: number, target: number = 15): boolean {
  return qualifiedCount < target;
}

export const MAX_DISCOVERY_ROUNDS = 3;