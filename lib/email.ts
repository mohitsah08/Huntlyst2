/**
 * Email Discovery & Verification Module
 * 
 * Determines real verification status for company contacts and emails:
 * - Email existence, type (professional vs personal vs generic)
 * - Company domain matching
 * - Active DNS MX records via Node.js dns/promises with bounded timeouts and in-memory caching
 * - Mailbox deliverability via Abstract API when configured
 * - Strict distinction: VERIFIED, PARTIALLY VERIFIED, UNVERIFIED, REJECTED
 * - ZERO false success: never marks email as VERIFIED unless true mailbox deliverability is confirmed
 * - Detailed error reasons: 'No email found', 'Personal email', 'Domain mismatch',
 *   'Domain does not resolve', 'MX record unavailable', 'Verification provider unavailable', 'Insufficient evidence'
 * - Controlled concurrency and error isolation for batch candidate processing
 */

import { Resolver } from 'dns/promises';
import { EmailVerificationResult, VerificationStatusType } from './types';
import { extractDomain } from './discovery';

// Use dedicated fast public DNS resolver (Google & Cloudflare) for resilient MX queries
const dnsResolver = new Resolver();
try {
  dnsResolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignore if unsupported in environment
}

const ABSTRACT_API_KEY = process.env.ABSTRACT_API_KEY;
const ABSTRACT_API_URL = 'https://emailvalidation.abstractapi.com/v1/';

export const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'zoho.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'yandex.ru',
  'tutanota.com',
  'tutamail.com',
  'fastmail.com',
]);

export const GENERIC_ROLE_PREFIXES = new Set([
  'info',
  'contact',
  'hello',
  'support',
  'sales',
  'admin',
  'team',
  'office',
  'help',
  'jobs',
  'careers',
  'marketing',
  'billing',
  'press',
  'media',
  'enquiries',
]);

/**
 * In-memory cache for MX records to avoid redundant DNS lookups across candidates
 */
const mxCache = new Map<string, { hasMx: boolean; primaryMx: string | null; error?: string }>();

/**
 * Parse full name into first and last name components
 */
export function parseName(fullName: string): { first: string; last: string } | null {
  const trimmed = fullName.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return null;

  const first = parts[0].toLowerCase().replace(/[^a-z]/g, '');
  const last = parts.length > 1
    ? parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '')
    : '';

  if (!first) return null;
  return { first, last };
}

/**
 * Generate common email pattern guesses for a founder/CEO
 */
export function generateEmailGuesses(name: string, domain: string): string[] {
  const parsed = parseName(name);
  if (!parsed || !domain) return [];

  const { first, last } = parsed;
  const guesses: string[] = [];

  // 1. firstname@domain
  guesses.push(`${first}@${domain}`);

  // 2. firstname.lastname@domain
  if (last) {
    guesses.push(`${first}.${last}@${domain}`);
    // 3. firstinitial.lastname@domain
    guesses.push(`${first[0]}.${last}@${domain}`);
    // 4. firstinitiallastname@domain
    guesses.push(`${first[0]}${last}@${domain}`);
  }

  // 5. Executive / role patterns
  guesses.push(`founder@${domain}`);
  guesses.push(`ceo@${domain}`);

  return [...new Set(guesses)];
}

/**
 * Check if the email domain matches the company domain or subdomains
 */
export function checkDomainMatch(emailDomain: string, companyWebsiteOrDomain: string): boolean {
  if (!emailDomain || !companyWebsiteOrDomain) return false;
  const cleanEmailDom = emailDomain.toLowerCase().replace(/^www\./, '').trim();
  const cleanCompDom = extractDomain(companyWebsiteOrDomain).toLowerCase();

  if (!cleanCompDom || !cleanEmailDom) return false;
  if (cleanEmailDom === cleanCompDom) return true;
  if (cleanCompDom.endsWith('.' + cleanEmailDom)) return true;
  if (cleanEmailDom.endsWith('.' + cleanCompDom)) return true;
  return false;
}

/**
 * Check if domain has active MX records in global DNS
 */
export async function checkMxRecords(domain: string): Promise<{ hasMx: boolean; primaryMx: string | null; error?: string }> {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();
  if (!cleanDomain || cleanDomain.length < 3 || !cleanDomain.includes('.')) {
    return { hasMx: false, primaryMx: null, error: 'Domain syntax invalid' };
  }

  if (mxCache.has(cleanDomain)) {
    return mxCache.get(cleanDomain)!;
  }

  try {
    // 5 second timeout to keep verification snappy and prevent hanging
    const timeoutPromise = new Promise<{ hasMx: boolean; primaryMx: string | null; error?: string }>((_, reject) =>
      setTimeout(() => reject(new Error('DNS Timeout')), 5000)
    );

    const lookupPromise = (async () => {
      try {
        const records = await dnsResolver.resolveMx(cleanDomain);
        if (records && records.length > 0) {
          records.sort((a, b) => a.priority - b.priority);
          const result = { hasMx: true, primaryMx: records[0].exchange };
          mxCache.set(cleanDomain, result);
          return result;
        }
        const result = { hasMx: false, primaryMx: null, error: 'No MX records found' };
        mxCache.set(cleanDomain, result);
        return result;
      } catch (err: any) {
        const result = { hasMx: false, primaryMx: null, error: err.code || err.message || 'DNS resolution failed' };
        mxCache.set(cleanDomain, result);
        return result;
      }
    })();

    return await Promise.race([lookupPromise, timeoutPromise]);
  } catch {
    const result = { hasMx: false, primaryMx: null, error: 'DNS lookup timeout' };
    mxCache.set(cleanDomain, result);
    return result;
  }
}

/**
 * Determine if an external email verification provider (Abstract API) is actively configured with a valid key
 */
export function isVerificationProviderConfigured(): boolean {
  if (!ABSTRACT_API_KEY) return false;
  const trimmed = ABSTRACT_API_KEY.trim();
  if (trimmed.length < 16) return false;
  if (trimmed.includes('your_') || trimmed.includes('tour_') || trimmed.includes('example')) return false;
  return true;
}

/**
 * Verify email using Abstract API (if configured)
 * Returns true mailbox deliverability without pretending verification succeeded when unconfigured.
 */
export async function verifyWithAbstractApi(email: string): Promise<{
  providerAvailable: boolean;
  deliverability: 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN' | null;
  reason: string;
}> {
  if (!isVerificationProviderConfigured()) {
    return {
      providerAvailable: false,
      deliverability: null,
      reason: 'Verification provider unavailable (No valid API key configured)',
    };
  }

  try {
    const params = new URLSearchParams({
      api_key: ABSTRACT_API_KEY!.trim(),
      email,
    });

    const response = await fetch(`${ABSTRACT_API_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return {
        providerAvailable: false,
        deliverability: null,
        reason: `Verification provider returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const deliverability = data.deliverability as 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN';

    if (deliverability === 'DELIVERABLE') {
      return {
        providerAvailable: true,
        deliverability: 'DELIVERABLE',
        reason: 'Mailbox confirmed deliverable by Abstract API',
      };
    } else if (deliverability === 'UNDELIVERABLE') {
      return {
        providerAvailable: true,
        deliverability: 'UNDELIVERABLE',
        reason: 'Mailbox rejected: undeliverable address',
      };
    } else {
      return {
        providerAvailable: true,
        deliverability: deliverability || 'RISKY',
        reason: `Provider reported deliverability as ${deliverability || 'risky/catch-all'}`,
      };
    }
  } catch (err: any) {
    return {
      providerAvailable: false,
      deliverability: null,
      reason: `Verification provider request failed: ${err.message || 'Timeout'}`,
    };
  }
}

export interface ContactVerificationInput {
  companyName: string;
  companyWebsite: string;
  leadName?: string | null;
  roleTitle?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  companyLinkedinUrl?: string | null;
  sourceUrls?: string[];
}

export interface DetailedContactVerificationResult {
  company: string;
  companyWebsite: string;
  companyDomain: string;
  leadName: string | null;
  roleTitle: string | null;
  isCeoOrFounder: boolean;
  email: string | null;
  emailExists: boolean;
  emailType: 'professional' | 'personal' | 'generic' | 'unknown';
  isProfessionalEmail: boolean;
  emailDomain: string | null;
  domainMatchesCompany: boolean;
  hasMx: boolean;
  mxHost: string | null;
  verificationStatus: VerificationStatusType;
  emailVerificationStatus: VerificationStatusType;
  verified: boolean; // Strictly true only if provider confirmed deliverability or verified registry
  evidence: string;
  reason: string;
  timestamp: string;
  linkedinUrl?: string | null;
  companyLinkedinUrl?: string | null;
  sourceUrls?: string[];
}

/**
 * Verify complete lead contact details and email with strict truthfulness
 */
export async function verifyContactLead(
  candidate: ContactVerificationInput
): Promise<DetailedContactVerificationResult> {
  const timestamp = new Date().toISOString();
  const company = candidate.companyName || 'Unknown Company';
  const companyWebsite = candidate.companyWebsite || '';
  const companyDomain = extractDomain(companyWebsite);
  const leadName = candidate.leadName?.trim() || null;
  const roleTitle = candidate.roleTitle?.trim() || 'CEO / Founder';
  const isCeoOrFounder = /ceo|founder|co-founder|chief executive|managing director|president/i.test(roleTitle);

  // 1. Determine email candidate (existing or generated from founder + company domain)
  let email = candidate.email?.trim() || null;
  if (!email && leadName && companyDomain) {
    const guesses = generateEmailGuesses(leadName, companyDomain);
    if (guesses.length > 0) {
      email = guesses[0];
    }
  }

  // If no email could be determined
  if (!email) {
    const status: VerificationStatusType = leadName && isCeoOrFounder ? 'PARTIALLY VERIFIED' : 'UNVERIFIED';
    const reason = 'No email found';

    console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: None\nVerification request: Email resolution for ${leadName || 'Executive'}\nVerification response: No email pattern or public address available\nVerification status: ${status}\nReason: ${reason}\n`);

    return {
      company,
      companyWebsite,
      companyDomain,
      leadName,
      roleTitle,
      isCeoOrFounder,
      email: null,
      emailExists: false,
      emailType: 'unknown',
      isProfessionalEmail: false,
      emailDomain: null,
      domainMatchesCompany: false,
      hasMx: false,
      mxHost: null,
      verificationStatus: status,
      emailVerificationStatus: 'UNVERIFIED',
      verified: false,
      evidence: leadName ? `Executive ${leadName} identified; email unlisted` : 'Executive identity unverified',
      reason,
      timestamp,
      linkedinUrl: candidate.linkedinUrl,
      companyLinkedinUrl: candidate.companyLinkedinUrl,
      sourceUrls: candidate.sourceUrls,
    };
  }

  // 2. Syntax validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const reason = 'Invalid email syntax';
    console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: ${email}\nVerification request: Syntax validation\nVerification response: Malformed email syntax\nVerification status: REJECTED\nReason: ${reason}\n`);

    return {
      company,
      companyWebsite,
      companyDomain,
      leadName,
      roleTitle,
      isCeoOrFounder,
      email,
      emailExists: true,
      emailType: 'unknown',
      isProfessionalEmail: false,
      emailDomain: null,
      domainMatchesCompany: false,
      hasMx: false,
      mxHost: null,
      verificationStatus: 'REJECTED',
      emailVerificationStatus: 'REJECTED',
      verified: false,
      evidence: `Malformed email: ${email}`,
      reason,
      timestamp,
      linkedinUrl: candidate.linkedinUrl,
      companyLinkedinUrl: candidate.companyLinkedinUrl,
      sourceUrls: candidate.sourceUrls,
    };
  }

  const [localPart, rawDomain] = email.split('@');
  const emailDomain = (rawDomain || '').toLowerCase().trim();
  const isPersonal = PERSONAL_EMAIL_DOMAINS.has(emailDomain);
  const isGeneric = GENERIC_ROLE_PREFIXES.has(localPart.toLowerCase());
  const emailType: 'professional' | 'personal' | 'generic' | 'unknown' = isPersonal
    ? 'personal'
    : isGeneric
    ? 'generic'
    : 'professional';
  const isProfessionalEmail = !isPersonal && emailType === 'professional';

  // 3. Personal Email check
  if (isPersonal) {
    const reason = `Personal email (@${emailDomain})`;
    const status: VerificationStatusType = leadName ? 'PARTIALLY VERIFIED' : 'UNVERIFIED';

    console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: ${email}\nVerification request: Provider check (@${emailDomain})\nVerification response: Free webmail provider detected\nVerification status: ${status}\nReason: ${reason}\n`);

    return {
      company,
      companyWebsite,
      companyDomain,
      leadName,
      roleTitle,
      isCeoOrFounder,
      email,
      emailExists: true,
      emailType: 'personal',
      isProfessionalEmail: false,
      emailDomain,
      domainMatchesCompany: false,
      hasMx: false,
      mxHost: null,
      verificationStatus: status,
      emailVerificationStatus: 'UNVERIFIED',
      verified: false,
      evidence: `Personal free webmail address (${emailDomain}) instead of corporate domain`,
      reason,
      timestamp,
      linkedinUrl: candidate.linkedinUrl,
      companyLinkedinUrl: candidate.companyLinkedinUrl,
      sourceUrls: candidate.sourceUrls,
    };
  }

  // 4. Domain matching check
  const domainMatchesCompany = checkDomainMatch(emailDomain, companyDomain);
  if (!domainMatchesCompany) {
    const reason = `Domain mismatch (@${emailDomain} vs ${companyDomain || 'unspecified'})`;
    const status: VerificationStatusType = leadName ? 'PARTIALLY VERIFIED' : 'UNVERIFIED';

    console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: ${email}\nVerification request: Domain matching (@${emailDomain} == ${companyDomain})\nVerification response: Domain mismatch\nVerification status: ${status}\nReason: ${reason}\n`);

    return {
      company,
      companyWebsite,
      companyDomain,
      leadName,
      roleTitle,
      isCeoOrFounder,
      email,
      emailExists: true,
      emailType,
      isProfessionalEmail,
      emailDomain,
      domainMatchesCompany: false,
      hasMx: false,
      mxHost: null,
      verificationStatus: status,
      emailVerificationStatus: 'UNVERIFIED',
      verified: false,
      evidence: `Email domain @${emailDomain} does not correspond to company domain ${companyDomain}`,
      reason,
      timestamp,
      linkedinUrl: candidate.linkedinUrl,
      companyLinkedinUrl: candidate.companyLinkedinUrl,
      sourceUrls: candidate.sourceUrls,
    };
  }

  // 5. DNS MX Record Verification
  const { hasMx, primaryMx, error: mxError } = await checkMxRecords(emailDomain);
  if (!hasMx) {
    const reason = mxError || 'MX record unavailable or domain does not resolve';
    const status: VerificationStatusType = 'UNVERIFIED';

    console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: ${email}\nVerification request: DNS MX resolve (${emailDomain})\nVerification response: No MX exchange resolved (${reason})\nVerification status: ${status}\nReason: ${reason}\n`);

    return {
      company,
      companyWebsite,
      companyDomain,
      leadName,
      roleTitle,
      isCeoOrFounder,
      email,
      emailExists: true,
      emailType,
      isProfessionalEmail,
      emailDomain,
      domainMatchesCompany: true,
      hasMx: false,
      mxHost: null,
      verificationStatus: status,
      emailVerificationStatus: 'UNVERIFIED',
      verified: false,
      evidence: `DNS MX lookup failed for ${emailDomain}: ${reason}`,
      reason,
      timestamp,
      linkedinUrl: candidate.linkedinUrl,
      companyLinkedinUrl: candidate.companyLinkedinUrl,
      sourceUrls: candidate.sourceUrls,
    };
  }

  // 6. Mailbox-level Provider Verification
  const providerCheck = await verifyWithAbstractApi(email);

  if (providerCheck.providerAvailable && providerCheck.deliverability === 'DELIVERABLE') {
    const status: VerificationStatusType = 'VERIFIED';
    const reason = 'Mailbox deliverability verified by provider';

    console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: ${email}\nVerification request: Abstract API Deliverability Check\nVerification response: DELIVERABLE (MX: ${primaryMx})\nVerification status: ${status}\nReason: ${reason}\n`);

    return {
      company,
      companyWebsite,
      companyDomain,
      leadName,
      roleTitle,
      isCeoOrFounder,
      email,
      emailExists: true,
      emailType,
      isProfessionalEmail,
      emailDomain,
      domainMatchesCompany: true,
      hasMx: true,
      mxHost: primaryMx,
      verificationStatus: status,
      emailVerificationStatus: 'VERIFIED',
      verified: true,
      evidence: `Verified active mailbox on ${primaryMx} (Abstract API deliverable)`,
      reason,
      timestamp,
      linkedinUrl: candidate.linkedinUrl,
      companyLinkedinUrl: candidate.companyLinkedinUrl,
      sourceUrls: candidate.sourceUrls,
    };
  } else if (providerCheck.providerAvailable && providerCheck.deliverability === 'UNDELIVERABLE') {
    const status: VerificationStatusType = 'REJECTED';
    const reason = 'Mailbox rejected: undeliverable by provider';

    console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: ${email}\nVerification request: Abstract API Deliverability Check\nVerification response: UNDELIVERABLE (MX: ${primaryMx})\nVerification status: ${status}\nReason: ${reason}\n`);

    return {
      company,
      companyWebsite,
      companyDomain,
      leadName,
      roleTitle,
      isCeoOrFounder,
      email,
      emailExists: true,
      emailType,
      isProfessionalEmail,
      emailDomain,
      domainMatchesCompany: true,
      hasMx: true,
      mxHost: primaryMx,
      verificationStatus: status,
      emailVerificationStatus: 'REJECTED',
      verified: false,
      evidence: `Mailbox confirmed undeliverable by provider on ${primaryMx}`,
      reason,
      timestamp,
      linkedinUrl: candidate.linkedinUrl,
      companyLinkedinUrl: candidate.companyLinkedinUrl,
      sourceUrls: candidate.sourceUrls,
    };
  }

  // Verification provider is unavailable or returned inconclusive (risky/catch-all)
  // HONEST REPORTING: Mark as PARTIALLY VERIFIED with exact reason
  const status: VerificationStatusType = 'PARTIALLY VERIFIED';
  const reason = providerCheck.providerAvailable
    ? `Domain MX active (${primaryMx}); Mailbox deliverability risky/catch-all`
    : `Domain MX active (${primaryMx}); Mailbox-level verification unavailable (Verification provider unavailable)`;

  console.log(`[HUNTLYST][VERIFY]\nCandidate: ${company}\nEmail: ${email}\nVerification request: DNS MX (${emailDomain})\nVerification response: Active MX (${primaryMx}) | Provider: ${providerCheck.providerAvailable ? 'Inconclusive' : 'Unavailable'}\nVerification status: ${status}\nReason: ${reason}\n`);

  return {
    company,
    companyWebsite,
    companyDomain,
    leadName,
    roleTitle,
    isCeoOrFounder,
    email,
    emailExists: true,
    emailType,
    isProfessionalEmail,
    emailDomain,
    domainMatchesCompany: true,
    hasMx: true,
    mxHost: primaryMx,
    verificationStatus: status,
    emailVerificationStatus: 'PARTIALLY VERIFIED',
    verified: false, // Strictly false because mailbox-level verification provider was unavailable
    evidence: `Domain mail exchange active (${primaryMx}); Individual mailbox deliverability unverified (Verification provider unavailable)`,
    reason,
    timestamp,
    linkedinUrl: candidate.linkedinUrl,
    companyLinkedinUrl: candidate.companyLinkedinUrl,
    sourceUrls: candidate.sourceUrls,
  };
}

/**
 * Controlled concurrency batch verification with error isolation
 * One candidate error will NEVER crash or abort the batch.
 */
export async function verifyContactsBatch(
  candidates: ContactVerificationInput[],
  concurrency = 5
): Promise<DetailedContactVerificationResult[]> {
  const results: DetailedContactVerificationResult[] = [];
  const safeConcurrency = Math.max(1, Math.min(10, concurrency));

  for (let i = 0; i < candidates.length; i += safeConcurrency) {
    const chunk = candidates.slice(i, i + safeConcurrency);
    const chunkPromises = chunk.map(async (c) => {
      try {
        return await verifyContactLead(c);
      } catch (err: any) {
        const errorReason = `Verification error: ${err.message || 'Unknown error'}`;
        console.error(`[HUNTLYST][VERIFY ERROR] Candidate ${c.companyName}: ${errorReason}`);
        return {
          company: c.companyName || 'Unknown Entity',
          companyWebsite: c.companyWebsite || '',
          companyDomain: extractDomain(c.companyWebsite || ''),
          leadName: c.leadName || null,
          roleTitle: c.roleTitle || 'Executive',
          isCeoOrFounder: false,
          email: c.email || null,
          emailExists: !!c.email,
          emailType: 'unknown' as const,
          isProfessionalEmail: false,
          emailDomain: null,
          domainMatchesCompany: false,
          hasMx: false,
          mxHost: null,
          verificationStatus: 'UNVERIFIED' as const,
          emailVerificationStatus: 'UNVERIFIED' as const,
          verified: false,
          evidence: errorReason,
          reason: errorReason,
          timestamp: new Date().toISOString(),
          linkedinUrl: c.linkedinUrl,
          companyLinkedinUrl: c.companyLinkedinUrl,
          sourceUrls: c.sourceUrls,
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Backward compatibility wrapper for verifyEmail
 */
export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const domain = email.split('@')[1] || '';
  const result = await verifyContactLead({
    companyName: domain,
    companyWebsite: `https://${domain}`,
    email,
  });

  return {
    email: result.email,
    verified: result.verified,
    status: result.emailVerificationStatus,
    emailType: result.emailType,
    domain: result.emailDomain,
    companyDomain: result.companyDomain,
    domainMatchesCompany: result.domainMatchesCompany,
    hasMx: result.hasMx,
    mxHost: result.mxHost,
    method: result.hasMx ? 'DNS MX Record Verified' : 'DNS Resolution Failed',
    evidence: result.evidence,
    timestamp: result.timestamp,
    reason: result.reason,
  };
}

/**
 * Backward compatibility wrapper for findVerifiedEmail
 */
export async function findVerifiedEmail(
  founderName: string,
  companyUrl: string
): Promise<EmailVerificationResult> {
  const domain = extractDomain(companyUrl);
  const result = await verifyContactLead({
    companyName: domain,
    companyWebsite: companyUrl,
    leadName: founderName,
  });

  return {
    email: result.email,
    verified: result.verified,
    status: result.emailVerificationStatus,
    emailType: result.emailType,
    domain: result.emailDomain,
    companyDomain: result.companyDomain,
    domainMatchesCompany: result.domainMatchesCompany,
    hasMx: result.hasMx,
    mxHost: result.mxHost,
    method: result.hasMx ? 'DNS MX Record Verified' : 'DNS Resolution Failed',
    evidence: result.evidence,
    timestamp: result.timestamp,
    reason: result.reason,
  };
}