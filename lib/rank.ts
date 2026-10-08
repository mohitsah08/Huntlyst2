/**
 * Ranking & Deduplication Module
 * 
 * Deduplicates by root domain, computes confidence scores,
 * and ranks companies by confidence score.
 */

import { CompanyRecord, ValidatedCompany, EmailVerificationResult, HuntConfig, TVB_EVALUATION_CONFIG } from './types';
import { extractDomain } from './discovery';
import { parseFundingDetails } from './validation';

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
 * Continuous, granular, deterministic multi-factor formula:
 * - Funding Fit (0-20): Proximity to target range and strict boundary compliance
 * - Technology & Sector Fit (0-20): Taxonomy match depth (sub-industry, sector, or keyword)
 * - Geographic Fit (0-20): Target country, region, and US presence compliance
 * - Founder / Decision-Maker (0-20): Role rank (CEO > Founder > Executive) and authenticity
 * - Contact Deliverability (0-20): DNS MX / deliverability verification vs synthesis
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

  // 1. Funding Fit (max 20)
  const minFunding = config.funding?.min ?? 100_000;
  const maxFunding = config.funding?.max ?? 10_000_000;
  const rawFunding = record.fundingOrRevenue || record.funding?.totalRaised || '';
  const parsedFunding = parseFundingDetails(rawFunding);

  if (parsedFunding && parsedFunding.amountUsd > 0) {
    const usd = parsedFunding.amountUsd;
    if (usd >= minFunding && usd <= maxFunding) {
      // Base score for being strictly in-range: 15
      // Closeness bonus (0 to 5) centered around geometric or arithmetic midpoint
      const mid = (minFunding + maxFunding) / 2;
      const span = (maxFunding - minFunding) / 2;
      const proximity = Math.max(0, 1 - Math.abs(usd - mid) / (span || 1));
      breakdown.funding = Math.round(15 + proximity * 5);
    } else if (usd < minFunding) {
      // Below min: partial credit if close, declining down to 2
      const ratio = usd / (minFunding || 1);
      breakdown.funding = Math.max(2, Math.round(ratio * 12));
    } else {
      // Exceeds max: severe penalty for exceeding investment criteria
      const excessRatio = usd / (maxFunding || 1);
      if (excessRatio <= 1.5) breakdown.funding = 8;
      else if (excessRatio <= 3.0) breakdown.funding = 4;
      else breakdown.funding = 1;
    }
  } else if (rawFunding && (rawFunding.includes('$') || rawFunding.includes('€') || rawFunding.includes('£') || rawFunding.includes('seed') || rawFunding.includes('series'))) {
    breakdown.funding = 10; // Unparsed qualitative mention
  } else {
    breakdown.funding = 0;
  }

  // 2. Technology & Industry Fit (max 20)
  const industry = (record.industry || record.sector || '').toLowerCase();
  const desc = (record.description || '').toLowerCase();
  const targetedSectors = (config.targetProfile?.industries || config.sectors || []).map(s => s.toLowerCase()).filter(s => s !== 'all');
  const targetedSubIndustries = (config.targetProfile?.subIndustries || []).map(s => s.toLowerCase());

  let techScore = 0;
  if (targetedSubIndustries.length > 0 && targetedSubIndustries.some(sub => industry.includes(sub) || desc.includes(sub))) {
    techScore = 20; // Exact sub-industry match
  } else if (targetedSectors.length > 0 && targetedSectors.some(sec => industry.includes(sec) || desc.includes(sec))) {
    techScore = 17; // Sector category match
  } else if (
    industry.includes('saas') || industry.includes('software') || industry.includes('ai') || 
    industry.includes('artificial intelligence') || desc.includes('platform') || desc.includes('api') || desc.includes('cloud')
  ) {
    techScore = targetedSectors.length === 0 ? 18 : 12; // General tech platform
  } else if (industry.length > 2) {
    techScore = 8; // Non-tech known industry
  } else {
    techScore = 3;
  }
  breakdown.technology = techScore;

  // 3. Geographic Fit (max 20)
  const targetCountries = (config.geography.countries || []).map(c => c.toLowerCase());
  const targetRegions = (config.geography.regions || []).map(r => r.toLowerCase());
  const excluded = (config.geography.excludedCountries || []).map(e => e.toLowerCase());
  const country = (record.country || '').toLowerCase();
  const isNoUSRestriction = config.geography.usPresence === 'any' || 
    (config.geography.usPresence as string) === 'dont_care' || 
    (config.geography.usPresence as string) === 'no_restriction';
  const isUS = country.includes('united states') || country === 'us' || country === 'usa';

  if (isUS && !isNoUSRestriction && excluded.includes('united states')) {
    breakdown.geography = 0; // Excluded country hard violation
  } else if (targetCountries.length > 0) {
    if (targetCountries.some(tc => country.includes(tc))) {
      breakdown.geography = 20; // Direct target country match
    } else {
      breakdown.geography = 4; // Country outside target
    }
  } else if (targetRegions.length > 0) {
    if (targetRegions.some(tr => country.includes(tr) || (record.location || '').toLowerCase().includes(tr))) {
      breakdown.geography = 18; // Regional match
    } else {
      breakdown.geography = 8;
    }
  } else {
    // Global hunt
    if (isUS && isNoUSRestriction) {
      breakdown.geography = 18;
    } else if (!isUS && country.length > 2) {
      breakdown.geography = 19; // Valid global non-US entity
    } else {
      breakdown.geography = 9;
    }
  }

  // 4. Founder / Decision-Maker Fit (max 20)
  const founder = record.founderOrCeoName || record.founder?.name || record.contactProfile?.primary_contact?.full_name;
  const isPlaceholder = !founder || founder.toUpperCase().includes('UPGRADE TO UNLOCK') || founder.length < 3;

  if (isPlaceholder) {
    breakdown.founder = 0;
  } else {
    const role = (record.contactProfile?.primary_contact?.current_role || '').toLowerCase();
    const cleanFounder = founder.replace(/\s+(?:and|or|with|&)\s*$/i, '').trim();
    let fScore = 14;

    if (role.includes('ceo') || cleanFounder.toLowerCase().includes('ceo')) {
      fScore = 20; // Direct CEO match
    } else if (role.includes('founder') || cleanFounder.toLowerCase().includes('founder')) {
      fScore = 19; // Founder / Co-founder
    } else if (role.includes('chief') || role.includes('president') || role.includes('vp')) {
      fScore = 16; // Executive officer
    } else if (cleanFounder.split(' ').length >= 2) {
      fScore = 15; // Complete personal name verified
    }

    // Bonus for verified LinkedIn profile
    if (record.linkedinUrl || record.contactProfile?.primary_contact?.linkedin_url) {
      fScore = Math.min(20, fScore + 1);
    }
    breakdown.founder = fScore;
  }

  // 5. Contact Deliverability (max 20)
  const hasVerifiedEmail = record.emailVerified && (record.founderOrCeoEmail || record.email?.address);
  const rawEmail = record.founderOrCeoEmail || record.email?.address || record.contactProfile?.company_email?.value;

  if (hasVerifiedEmail) {
    breakdown.contact = 20; // DNS MX / SMTP verified professional email
  } else if (rawEmail && rawEmail.includes('@')) {
    const isDomainMatch = record.website && rawEmail.split('@')[1] && record.website.includes(rawEmail.split('@')[1]);
    if (isDomainMatch) {
      breakdown.contact = 15; // Corporate domain verified syntax
    } else {
      breakdown.contact = 11; // Synthesized / unverified
    }
  } else {
    breakdown.contact = config.emailVerification === 'none' ? 16 : 0;
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