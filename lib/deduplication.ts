/**
 * Multi-Level Deduplication & Identity Resolution Engine
 * 
 * Provides robust identity normalization and deduplication:
 * 1. Canonical Domain Resolution (strips subdomains, www, mobile, ports, paths)
 * 2. Normalized Company Name (strips corporate designations: Inc, LLC, Ltd, GmbH, etc.)
 * 3. Composite Result Fingerprinting
 * 4. Multi-level Duplicate Check (domain, normalized name, session history, global store)
 * 5. Person Identity Normalization (clean executive name + canonical company domain)
 */

// Common subdomains to strip down to root domain
const SUBDOMAINS_TO_STRIP = [
  'www', 'm', 'mobile', 'app', 'portal', 'blog', 'news', 'docs',
  'help', 'support', 'api', 'beta', 'staging', 'dev', 'web', 'login', 'en',
];

// Common corporate legal suffixes to strip for normalized name comparison
const CORPORATE_SUFFIXES = [
  'incorporated', 'inc', 'corporation', 'corp', 'limited', 'ltd',
  'llc', 'l.l.c.', 'gmbh', 's.a.', 'sa', 's.a.s.', 'sas', 'b.v.', 'bv',
  'pvt ltd', 'pvt. ltd.', 'private limited', 'pty ltd', 'pty. ltd.',
  'co.', 'co', 'company', 'holdings', 'group', 'ventures', 'technologies', 'tech'
];

// Common media, social, aggregator, and search domains that must never be treated as company leads
export const NON_COMPANY_DOMAINS = new Set([
  'wikipedia.org', 'en.wikipedia.org', 'linkedin.com', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'youtube.com', 'github.com', 'medium.com',
  'reddit.com', 'bloomberg.com', 'reuters.com', 'forbes.com', 'techcrunch.com',
  'dealroom.co', 'pitchbook.com', 'crunchbase.com', 'ycombinator.com',
  'news.ycombinator.com', 'producthunt.com', 'substack.com', 'google.com',
  'apple.com', 'microsoft.com', 'amazon.com', 'yahoo.com', 'duckduckgo.com',
  'sifted.eu', 'eu-startups.com', 'tech.eu', 'inc42.com', 'techinasia.com'
]);

export function isLikelyCompanyDomain(rawUrlOrDomain: string): boolean {
  const canonical = extractCanonicalDomain(rawUrlOrDomain);
  if (!canonical || canonical.length < 3) return false;
  if (NON_COMPANY_DOMAINS.has(canonical)) return false;
  return true;
}

/**
 * Extracts the canonical root domain from any URL or domain string.
 * Example:
 *   "https://blog.synthesized.io/about?ref=1" -> "synthesized.io"
 *   "www.mindfuel.ai/" -> "mindfuel.ai"
 *   "https://m.acme.co.uk:8080" -> "acme.co.uk"
 */
export function extractCanonicalDomain(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  let cleaned = rawUrl.trim().toLowerCase();
  
  // Remove protocols and slashes
  cleaned = cleaned.replace(/^https?:\/\//i, '').replace(/^ftp:\/\//i, '');
  
  // Take only host part (before / or ? or #)
  const hostPart = cleaned.split('/')[0].split('?')[0].split('#')[0];
  
  // Remove port if present
  let hostname = hostPart.split(':')[0].trim();

  // Strip trailing periods
  hostname = hostname.replace(/\.+$/, '');

  // Extract root domain (e.g. acmecorp.io or company.co.uk)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    // Check second-level domains like co.uk, com.au, co.in, etc.
    const isCcSld = parts.length > 2 && (parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'com' || parts[parts.length - 2] === 'org' || parts[parts.length - 2] === 'gov' || parts[parts.length - 2] === 'edu');
    const minRootParts = isCcSld ? 3 : 2;
    hostname = parts.slice(-minRootParts).join('.');
  }

  return hostname;
}

/**
 * Normalizes a company name for fuzzy and exact deduplication:
 * - Lowercases and trims
 * - Strips punctuation and accents
 * - Removes corporate legal endings (Inc, Ltd, GmbH, etc.)
 * Example:
 *   "Synthesized, Inc." -> "synthesized"
 *   "Mindfuel Technologies GmbH" -> "mindfuel"
 *   "Zetwerk Manufacturing Businesses Private Limited" -> "zetwerk manufacturing businesses"
 */
export function normalizeCompanyName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let normalized = name.toLowerCase().trim();

  // Remove diacritics / accents
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Replace punctuation with spaces
  normalized = normalized.replace(/[,.\-_/\\()&+|#@!?"':;]/g, ' ');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Strip trailing corporate suffixes
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of CORPORATE_SUFFIXES) {
      const regex = new RegExp(`\\b${suffix}$`, 'i');
      if (regex.test(normalized)) {
        normalized = normalized.replace(regex, '').trim();
        changed = true;
      }
    }
  }

  return normalized;
}

/**
 * Creates a unique SHA-256 fingerprint for a company candidate.
 */
export function createCompanyFingerprint(name: string, websiteOrDomain: string): string {
  const canonicalDomain = extractCanonicalDomain(websiteOrDomain);
  const cleanName = normalizeCompanyName(name);
  const composite = `${canonicalDomain}::${cleanName}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(composite).digest('hex').slice(0, 16);
  } catch {
    let hash = 0;
    for (let i = 0; i < composite.length; i++) {
      hash = ((hash << 5) - hash) + composite.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
  }
}

export const calculateCompositeFingerprint = createCompanyFingerprint;

/**
 * Evaluates whether a candidate company is a duplicate across:
 * 1. Current Session in-memory set
 * 2. Database Store (previously seen domains & fingerprints)
 */
export interface DeduplicationCheckResult {
  isDuplicate: boolean;
  isPreviouslySeen: boolean;
  reason?: 'canonical_domain_seen' | 'company_fingerprint_seen' | 'normalized_name_matched' | 'current_session_duplicate' | 'invalid_non_company_domain';
  canonicalDomain: string;
  normalizedName: string;
  fingerprint: string;
}

export function checkCompanyDuplicate(
  name: string,
  urlOrDomain: string,
  sessionSeenDomains: Set<string> = new Set(),
  sessionSeenFingerprints: Set<string> = new Set()
): DeduplicationCheckResult {
  const canonicalDomain = extractCanonicalDomain(urlOrDomain);
  const normalizedName = normalizeCompanyName(name);
  const fingerprint = createCompanyFingerprint(name, urlOrDomain);

  // 0. Non-company / aggregator / media domain check
  if (!isLikelyCompanyDomain(canonicalDomain) || !isLikelyCompanyDomain(urlOrDomain)) {
    return { isDuplicate: true, isPreviouslySeen: false, reason: 'invalid_non_company_domain', canonicalDomain, normalizedName, fingerprint };
  }

  // 1. Current session check: strictly reject duplicates within the same search session
  if (canonicalDomain && sessionSeenDomains.has(canonicalDomain)) {
    return { isDuplicate: true, isPreviouslySeen: false, reason: 'current_session_duplicate', canonicalDomain, normalizedName, fingerprint };
  }
  if (fingerprint && sessionSeenFingerprints.has(fingerprint)) {
    return { isDuplicate: true, isPreviouslySeen: false, reason: 'current_session_duplicate', canonicalDomain, normalizedName, fingerprint };
  }

  // 2. Global persistent store check (from past historical sessions)
  let isPreviouslySeen = false;
  let pastReason: 'canonical_domain_seen' | 'company_fingerprint_seen' | undefined;

  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { dbStore } = require('@/lib/db/store');
      if (canonicalDomain && dbStore?.isDomainPreviouslySeen(canonicalDomain)) {
        isPreviouslySeen = true;
        pastReason = 'canonical_domain_seen';
      } else if (fingerprint && dbStore?.isFingerprintSeen(fingerprint)) {
        isPreviouslySeen = true;
        pastReason = 'company_fingerprint_seen';
      }
    } catch {
      // Ignore if dbStore is not loaded in client runtime
    }
  }

  return {
    isDuplicate: false,
    isPreviouslySeen,
    reason: pastReason,
    canonicalDomain,
    normalizedName,
    fingerprint,
  };
}

/**
 * Normalizes an executive person's identity:
 * Removes titles (Mr., Ms., Dr., Prof.), middle initials, and standardizes spacing.
 */
export function normalizePersonName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return '';

  let clean = rawName.trim().replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, '');
  clean = clean.replace(/,\s*(phd|md|mba|esq)\b/i, '');
  clean = clean.replace(/\s+[a-z]\.\s+/i, ' '); // remove middle initial
  return clean.replace(/\s+/g, ' ').trim();
}
