/**
 * Deterministic, browser-safe qualification for Stage 1 Internal Workflow.
 * Intentionally performs no network, DNS, AI-provider, or API calls.
 */
import type { InternalWorkflowSettings } from '@/lib/internalSettings';

export type InternalVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'REVIEW' | 'REJECTED';

export interface OfflineVerificationInput {
  id: string;
  companyName?: unknown;
  domain?: unknown;
  website?: unknown;
  industry?: unknown;
  subIndustry?: unknown;
  geography?: unknown;
  revenue?: unknown;
  totalFunding?: unknown;
  latestRoundFunding?: unknown;
  companyStage?: unknown;
  foundingYear?: unknown;
  companyAge?: unknown;
  companyStatus?: unknown;
  executiveNames?: unknown[];
  emails?: unknown[];
  ambiguousFields?: string[];
}

export interface InternalVerificationOutcome {
  companyId: string;
  status: InternalVerificationStatus;
  score: number;
  reasons: string[];
  passedCriteria: string[];
  failedCriteria: string[];
  missingCriteria: string[];
  ambiguousCriteria: string[];
}

const PLACEHOLDERS = new Set([
  '', 'n/a', 'na', 'none', 'null', 'unknown', 'not known',
  'not disclosed', 'not found', 'upgrade to unlock', 'not available',
  '—', '-', 'tbd',
]);

function valueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function exists(value: unknown): boolean {
  return !PLACEHOLDERS.has(valueText(value).toLowerCase());
}

function normalize(value: unknown): string {
  return valueText(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchesOneOf(value: unknown, targets: string[]): boolean {
  const actual = normalize(value);
  if (!actual) return false;
  return targets.some(target => {
    const expected = normalize(target);
    return expected && (actual === expected || actual.includes(expected) || expected.includes(actual));
  });
}

/** Parse common numeric formats ($2,000,000, 2m, 750k, 3.5 billion, 25 lakh, 1 crore). */
export function parseOfflineAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = valueText(value).toLowerCase().replace(/,/g, '');
  if (!raw || PLACEHOLDERS.has(raw)) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  if (!Number.isFinite(amount)) return null;
  if (/\b(b|bn|billion|billions)\b/.test(raw)) return amount * 1_000_000_000;
  if (/\b(m|mm|million|millions)\b/.test(raw)) return amount * 1_000_000;
  if (/\b(k|thousand|thousands)\b/.test(raw)) return amount * 1_000;
  if (/\b(lakh|lakhs|lac|lacs)\b/.test(raw)) return amount * 100_000;
  if (/\b(crore|crores|cr)\b/.test(raw)) return amount * 10_000_000;
  return amount;
}

function validDomain(value: unknown, website: unknown): boolean {
  const candidate = valueText(value) || valueText(website);
  if (!candidate) return false;
  let host = candidate.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
  host = host.replace(/^www\./, '').replace(/:\d+$/, '');
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host);
}

function isEmail(value: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueText(value));
}

function inactiveStatus(value: unknown): boolean {
  const status = normalize(value);
  return ['inactive', 'closed', 'dissolved', 'bankrupt', 'shut down', 'ceased operations'].some(token => status.includes(token));
}

function activeStatus(value: unknown): boolean {
  const status = normalize(value);
  return ['active', 'operating', 'currently operating', 'live', 'open'].some(token => status.includes(token));
}

export function evaluateInternalRecord(
  input: OfflineVerificationInput,
  settings: InternalWorkflowSettings,
  currentYear = new Date().getFullYear(),
): InternalVerificationOutcome {
  const passedCriteria: string[] = [];
  const failedCriteria: string[] = [];
  const missingCriteria: string[] = [];
  const ambiguousCriteria: string[] = [];
  const reasons: string[] = [];
  const target = settings.targetProfile;
  const mandatory = new Set(target.mandatoryCriteria || ['industry', 'funding', 'stage']);
  const requiredFields = new Set(target.requiredFields || ['companyName', 'domain']);

  const pass = (key: string, reason: string) => { passedCriteria.push(key); reasons.push(reason); };
  const fail = (key: string, reason: string) => { failedCriteria.push(key); reasons.push(reason); };
  const missing = (key: string, reason: string) => { missingCriteria.push(key); reasons.push(reason); };
  const ambiguous = (key: string, reason: string) => { ambiguousCriteria.push(key); reasons.push(reason); };

  // Company name and domain are always required, even if someone edits other settings.
  if (!exists(input.companyName)) missing('companyName', 'Company name is missing.');
  else pass('companyName', 'Company name is present.');

  if (!validDomain(input.domain, input.website)) missing('domain', 'Company domain/website is missing or invalid.');
  else pass('domain', 'Company domain/website is present.');

  const companyAge = exists(input.companyAge)
    ? Number(input.companyAge)
    : (Number(input.foundingYear) > 0 ? currentYear - Number(input.foundingYear) : null);
  const executive = (input.executiveNames || []).find(exists);
  const email = (input.emails || []).find(exists);
  const fundingValue = target.fundingBasis === 'latestRound' ? input.latestRoundFunding : input.totalFunding;

  const fieldValues: Record<string, unknown> = {
    industry: input.industry,
    subIndustry: input.subIndustry,
    geography: input.geography,
    revenue: input.revenue,
    funding: fundingValue,
    stage: input.companyStage,
    companyAge: companyAge,
    website: input.website,
    companyStatus: input.companyStatus,
    executive,
    email,
  };

  const requiredLabels: Record<string, string> = {
    industry: 'Industry', subIndustry: 'Sub-industry', geography: 'Geography',
    revenue: 'Annual revenue',
    funding: target.fundingBasis === 'latestRound' ? 'Latest-round funding' : 'Total funding',
    stage: 'Company stage', companyAge: 'Company age/founding year', website: 'Company website',
    companyStatus: 'Active company status', executive: 'Founder/CEO/decision-maker', email: 'Contact email',
  };

  for (const key of requiredFields) {
    if (key === 'companyName' || key === 'domain') continue;
    if (!exists(fieldValues[key])) missing(key, (requiredLabels[key] || key) + ' is required but missing.');
  }

  // Invalid or ambiguous imported fields require a human review; values are never guessed.
  for (const field of input.ambiguousFields || []) {
    ambiguous(field, field + ' is invalid or ambiguous in the imported record.');
  }

  const industries = [...(target.industries || []), ...(target.subIndustries || [])].filter(exists);
  if (industries.length > 0 && mandatory.has('industry')) {
    if (!exists(input.industry)) missing('industry', 'Industry is needed to evaluate the configured target.');
    else if (!matchesOneOf(input.industry, industries) && !matchesOneOf(input.subIndustry, target.subIndustries || [])) {
      fail('industry', 'Industry does not match the configured target (' + industries.join(', ') + ').');
    } else pass('industry', 'Industry matches the configured target.');
  }

  const geographies = (target.geographies || []).filter(exists);
  if (geographies.length > 0 && mandatory.has('geography')) {
    if (!exists(input.geography)) missing('geography', 'Geography is required by the target but missing.');
    else if (!matchesOneOf(input.geography, geographies)) fail('geography', 'Geography does not match (' + geographies.join(', ') + ').');
    else pass('geography', 'Geography matches the configured target.');
  }

  const revenueMin = target.revenueMin;
  const revenueMax = target.revenueMax;
  if ((revenueMin != null || revenueMax != null) && mandatory.has('revenue')) {
    const revenue = parseOfflineAmount(input.revenue);
    if (revenue === null) missing('revenue', 'Annual revenue is required to evaluate the configured range.');
    else if ((revenueMin !== null && revenue < revenueMin) || (revenueMax !== null && revenue > revenueMax)) {
      fail('revenue', 'Annual revenue is outside the configured range (' + (revenueMin ?? 'no minimum') + ' to ' + (revenueMax ?? 'no maximum') + ' USD).');
    } else pass('revenue', 'Annual revenue is within the configured range.');
  }

  if (mandatory.has('funding')) {
    const funding = parseOfflineAmount(fundingValue);
    if (funding === null) missing('funding', requiredLabels.funding + ' is required to evaluate the configured range.');
    else if (funding < target.fundingMin || funding > target.fundingMax) {
      fail('funding', requiredLabels.funding + ' is outside the configured range (' + target.fundingMin + ' to ' + target.fundingMax + ' USD).');
    } else pass('funding', requiredLabels.funding + ' is within the configured range.');
  }

  const stages = (target.stages || []).filter(exists);
  if (stages.length > 0 && mandatory.has('stage')) {
    if (!exists(input.companyStage)) missing('stage', 'Company stage is required by the target but missing.');
    else if (!matchesOneOf(input.companyStage, stages)) fail('stage', 'Company stage does not match (' + stages.join(', ') + ').');
    else pass('stage', 'Company stage matches the configured target.');
  }

  if ((target.minCompanyAge != null || target.maxCompanyAge != null) && mandatory.has('companyAge')) {
    const age = Number(companyAge);
    if (!Number.isFinite(age) || age < 0) missing('companyAge', 'Company age or founding year is needed for the configured age range.');
    else if ((target.minCompanyAge !== null && age < target.minCompanyAge) || (target.maxCompanyAge !== null && age > target.maxCompanyAge)) {
      fail('companyAge', 'Company age is outside the configured range (' + (target.minCompanyAge ?? 'no minimum') + ' to ' + (target.maxCompanyAge ?? 'no maximum') + ' years).');
    } else pass('companyAge', 'Company age is within the configured range.');
  }

  if (target.websiteRequirement === 'Required' || mandatory.has('website')) {
    if (!exists(input.website)) missing('website', 'A company website is required but missing.');
    else pass('website', 'Required company website is present.');
  }

  if (settings.verificationRules.requireActiveStatus || mandatory.has('companyStatus')) {
    if (!exists(input.companyStatus)) missing('companyStatus', 'Company status is needed to confirm it is active.');
    else if (inactiveStatus(input.companyStatus)) fail('companyStatus', 'Company is explicitly marked inactive or closed.');
    else if (!activeStatus(input.companyStatus)) ambiguous('companyStatus', 'Company status "' + valueText(input.companyStatus) + '" is not clearly active.');
    else pass('companyStatus', 'Company is marked active.');
  }

  if (target.executiveRequired.ceo || target.executiveRequired.cofounder || mandatory.has('executive')) {
    if (!executive) missing('executive', 'Required founder/CEO/decision-maker information is missing.');
    else pass('executive', 'Required executive information is present.');
  }

  if (target.emailRequirement === 'Required' || mandatory.has('email')) {
    if (!email) missing('email', 'A required company or executive email is missing.');
    else if (!isEmail(email)) ambiguous('email', 'The supplied email has an invalid format; offline mode does not check deliverability.');
    else pass('email', 'A contact email has valid syntax (deliverability not checked offline).');
  }

  let status: InternalVerificationStatus;
  if (failedCriteria.length > 0) status = 'REJECTED';
  else if (ambiguousCriteria.length > 0) status = 'REVIEW';
  else if (missingCriteria.length > 0) status = 'UNVERIFIED';
  else status = 'VERIFIED';

  const evaluated = passedCriteria.length + failedCriteria.length + missingCriteria.length + ambiguousCriteria.length;
  const score = evaluated === 0 ? 100 : Math.round((passedCriteria.length / evaluated) * 100);
  if (status === 'VERIFIED') reasons.unshift('All required configured criteria passed against the uploaded data only.');
  if (status === 'UNVERIFIED') reasons.unshift('Required information is missing; no external verification was attempted.');
  if (status === 'REVIEW') reasons.unshift('Conflicting or ambiguous information requires human review.');
  if (status === 'REJECTED') reasons.unshift('At least one mandatory target criterion clearly failed.');

  return { companyId: input.id, status, score, reasons, passedCriteria, failedCriteria, missingCriteria, ambiguousCriteria };
}
