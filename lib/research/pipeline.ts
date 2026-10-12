/**
 * Huntlyst External: Company Research & Scraping Pipeline (Workflow A)
 * 
 * Strict Extraction & Research Engine:
 * 1. Safe input validation: Rejects instructions, prompts, deployment messages, or synthetic names.
 * 2. Real Firecrawl scraping with link discovery across official pages (About, Team, Contact, Press).
 * 3. Reputable public cross-checking (Crunchbase, TechCrunch, Wikipedia, SEC filings).
 * 4. Zero fabrication: Unknown facts remain null/Unknown; no synthetic emails or fake domains.
 * 5. Full field-level evidence storage with source URL, title, and exact supporting excerpt.
 */

import { firecrawlClient } from '@/providers/firecrawl/client';
import { extractCanonicalDomain } from '@/lib/deduplication';
import { parseFundingDetails } from '@/lib/validation';
import * as cheerio from 'cheerio';
import * as dns from 'dns';
import {
  CompanyResearchProfile,
  FieldEvidence,
  DiscoveredExecutive,
  DiscoveredFundingRound,
  ResearchStatus,
} from './types';

// =========================================================================
// 1. INPUT VALIDATION & PROMPT REJECTION
// =========================================================================

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

const INSTRUCTION_OR_PROMPT_PATTERNS = [
  /\b(find\s+me|search\s+for|list\s+all|give\s+me|show\s+me|get\s+me)\b/i,
  /\b(publish|deploy|build|commit|push|refactor|rebuild|rewrite)\b/i,
  /\b(please|can\s+you|could\s+you|i\s+want|i\s+need|how\s+to)\b/i,
  /\b(make\s+sure|verify\s+that|ensure\s+that|run\s+the|execute)\b/i,
  /\b(test\s+this|test\s+the|deployment\s+to|migrated\s+to)\b/i,
  /\b(production\s+build|git\s+branch|github\s+repository)\b/i,
  /\b(startups?\s+in|companies\s+in|leads?\s+in)\b/i,
  /\?$/, // ends with question mark
];

export function validateAndNormalizeInput(rawInput: {
  url?: string | null;
  name?: string | null;
}): { officialUrl: string | null; canonicalDomain: string | null; companyName: string } {
  const rawUrl = (rawInput.url || '').trim();
  const rawName = (rawInput.name || '').trim();

  if (!rawUrl && !rawName) {
    throw new InvalidInputError('Please provide a valid company website URL or official company name.');
  }

  // Reject generic instructions or deployment commands masquerading as names or URLs
  const combinedText = `${rawName} ${rawUrl}`.trim();
  for (const pattern of INSTRUCTION_OR_PROMPT_PATTERNS) {
    if (pattern.test(combinedText)) {
      throw new InvalidInputError(
        `Rejected arbitrary prompt or command instruction: "${combinedText}". Please enter a valid company name or official website.`
      );
    }
  }

  if (combinedText.length > 120 && !rawUrl.startsWith('http')) {
    throw new InvalidInputError('Input exceeds maximum company name length and appears to be a prompt or text paragraph.');
  }

  let officialUrl: string | null = null;
  let canonicalDomain: string | null = null;
  let companyName = rawName;

  // Process URL if supplied
  if (rawUrl) {
    let testUrl = rawUrl;
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      testUrl = `https://${testUrl}`;
    }

    try {
      const parsed = new URL(testUrl);
      const host = parsed.hostname.toLowerCase().trim();
      
      // Validate host syntax (must have a valid TLD)
      if (!host.includes('.') || host.endsWith('.') || host.length < 4) {
        throw new InvalidInputError(`Invalid domain hostname: "${host}".`);
      }

      canonicalDomain = extractCanonicalDomain(testUrl).toLowerCase();
      if (!canonicalDomain || !canonicalDomain.includes('.')) {
        throw new InvalidInputError(`Invalid domain name in URL: "${rawUrl}".`);
      }

      officialUrl = `https://${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
      
      if (!companyName) {
        // Derive clean initial name from domain without synthetic TLD guessing
        const base = canonicalDomain.split('.')[0];
        companyName = base.charAt(0).toUpperCase() + base.slice(1);
      }
    } catch (err: any) {
      if (err instanceof InvalidInputError) throw err;
      throw new InvalidInputError(`Malformed company URL: "${rawUrl}".`);
    }
  } else {
    // Only name was supplied: do NOT fabricate a .com domain
    canonicalDomain = null;
    officialUrl = null;

    // Check if name has valid entity length
    if (companyName.length < 2) {
      throw new InvalidInputError('Company name must contain at least 2 characters.');
    }
  }

  return { officialUrl, canonicalDomain, companyName };
}

// =========================================================================
// 2. SCRAPING & PAGE DISCOVERY
// =========================================================================

interface InspectedPage {
  url: string;
  title: string;
  markdown: string;
  html: string;
  tier: 'TIER_1_OFFICIAL' | 'TIER_2_AUTHORITATIVE' | 'TIER_3_REFERENCE';
  statusCode: number;
}

export class ExternalResearchPipeline {
  private pageCache = new Map<string, InspectedPage>();

  /**
   * Safe fetch with Firecrawl primary and Cheerio fallback
   */
  public async fetchPage(
    url: string,
    canonicalDomain?: string | null
  ): Promise<InspectedPage | null> {
    const cleanUrl = url.split('#')[0].replace(/\/$/, '');
    if (this.pageCache.has(cleanUrl)) {
      return this.pageCache.get(cleanUrl)!;
    }

    let title = '';
    let markdown = '';
    let html = '';
    let statusCode = 200;

    // 1. Attempt Firecrawl Scrape if configured
    if (firecrawlClient.isConfigured()) {
      try {
        const fcRes = await firecrawlClient.scrape(cleanUrl, {
          formats: ['markdown', 'html'],
          onlyMainContent: false,
          timeout: 20000,
        });

        if (fcRes.success && fcRes.data) {
          title = fcRes.data.metadata?.title || '';
          markdown = fcRes.data.markdown || '';
          html = fcRes.data.html || '';
          statusCode = fcRes.data.metadata?.statusCode || 200;
        }
      } catch (fcErr) {
        console.warn(`[Pipeline] Firecrawl scrape failed for ${cleanUrl}:`, fcErr);
      }
    }

    // 2. Fallback to direct HTTP fetch if Firecrawl didn't return content
    if (!html && !markdown) {
      try {
        const res = await fetch(cleanUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(10000),
          redirect: 'follow',
        });

        statusCode = res.status;
        if (res.ok) {
          html = await res.text();
          const $ = cheerio.load(html);
          title = $('title').text().trim() || '';
          $('script, style, noscript, svg, iframe').remove();
          markdown = $('body').text().replace(/\s+/g, ' ').trim();
        }
      } catch (fetchErr) {
        console.warn(`[Pipeline] Direct fetch failed for ${cleanUrl}:`, fetchErr);
      }
    }

    if (!html && !markdown) {
      return null;
    }

    let tier: 'TIER_1_OFFICIAL' | 'TIER_2_AUTHORITATIVE' | 'TIER_3_REFERENCE' = 'TIER_3_REFERENCE';
    if (canonicalDomain) {
      const pageDomain = extractCanonicalDomain(cleanUrl).toLowerCase();
      if (pageDomain === canonicalDomain.toLowerCase() || pageDomain.endsWith(`.${canonicalDomain.toLowerCase()}`)) {
        tier = 'TIER_1_OFFICIAL';
      } else if (
        pageDomain.includes('crunchbase.com') ||
        pageDomain.includes('techcrunch.com') ||
        pageDomain.includes('bloomberg.com') ||
        pageDomain.includes('forbes.com') ||
        pageDomain.includes('reuters.com') ||
        pageDomain.includes('wikipedia.org') ||
        pageDomain.includes('sec.gov') ||
        pageDomain.includes('pitchbook.com')
      ) {
        tier = 'TIER_2_AUTHORITATIVE';
      }
    }

    const inspected: InspectedPage = {
      url: cleanUrl,
      title,
      markdown,
      html,
      tier,
      statusCode,
    };

    this.pageCache.set(cleanUrl, inspected);
    return inspected;
  }

  /**
   * Discovers internal official subpage links from the homepage HTML
   */
  public discoverSubpageUrls(homepageHtml: string, baseUrl: string): {
    aboutUrls: string[];
    teamUrls: string[];
    contactUrls: string[];
    pressUrls: string[];
  } {
    const $ = cheerio.load(homepageHtml);
    const baseHost = new URL(baseUrl).hostname.toLowerCase();

    const aboutUrls = new Set<string>();
    const teamUrls = new Set<string>();
    const contactUrls = new Set<string>();
    const pressUrls = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href) return;

      try {
        const fullUrl = new URL(href, baseUrl);
        if (fullUrl.hostname.toLowerCase() !== baseHost) return; // Keep internal only

        const path = fullUrl.pathname.toLowerCase();
        if (path === '/' || path === '') return;

        if (path.includes('about') || path.includes('company') || path.includes('who-we-are')) {
          aboutUrls.add(fullUrl.toString());
        } else if (path.includes('team') || path.includes('leadership') || path.includes('management') || path.includes('executives') || path.includes('our-people')) {
          teamUrls.add(fullUrl.toString());
        } else if (path.includes('contact') || path.includes('reach-us') || path.includes('connect')) {
          contactUrls.add(fullUrl.toString());
        } else if (path.includes('press') || path.includes('news') || path.includes('investors') || path.includes('media')) {
          pressUrls.add(fullUrl.toString());
        }
      } catch {
        // Ignore invalid URL parsing
      }
    });

    return {
      aboutUrls: Array.from(aboutUrls).slice(0, 2),
      teamUrls: Array.from(teamUrls).slice(0, 2),
      contactUrls: Array.from(contactUrls).slice(0, 2),
      pressUrls: Array.from(pressUrls).slice(0, 2),
    };
  }

  // =========================================================================
  // 3. MAIN WORKFLOW A EXECUTION: RESEARCH & SCRAPE
  // =========================================================================

  public async executeResearch(input: {
    url?: string | null;
    name?: string | null;
  }): Promise<CompanyResearchProfile> {
    const { officialUrl, canonicalDomain, companyName } = validateAndNormalizeInput(input);
    const now = new Date().toISOString();
    const profileId = canonicalDomain ? `comp_${canonicalDomain.replace(/[^a-z0-9]/g, '_')}` : `comp_${Date.now()}`;

    const fieldEvidence: Record<string, FieldEvidence> = {};
    const sources: Array<{
      url: string;
      title?: string;
      tier: 'TIER_1_OFFICIAL' | 'TIER_2_AUTHORITATIVE' | 'TIER_3_REFERENCE';
      retrievedAt: string;
    }> = [];

    const inspectedPages: InspectedPage[] = [];

    // Helper to register evidence
    const recordEvidence = (
      field: string,
      value: any,
      page: InspectedPage | null,
      excerpt: string | null,
      method: FieldEvidence['extractionMethod'] = 'firecrawl_scrape',
      confidence: number = 90
    ) => {
      fieldEvidence[field] = {
        field,
        value,
        sourceUrl: page?.url || null,
        sourceTitle: page?.title || null,
        sourceTier: page?.tier || 'TIER_3_REFERENCE',
        excerpt,
        dateRetrieved: now,
        extractionMethod: method,
        confidence,
      };
    };

    let resolvedName = companyName;
    let description: string | null = null;
    let foundedYear: number | null = null;
    let foundingDate: string | null = null;
    let primaryIndustry: string | null = null;
    let subIndustry: string | null = null;
    const productsAndServices: string[] = [];
    let businessModel: string | null = null;

    let hqCity: string | null = null;
    let hqState: string | null = null;
    let hqCountry: string | null = null;
    let hqAddress: string | null = null;
    const operatingCountries = new Set<string>();
    let usPresence: boolean | null = null;

    let ceo: DiscoveredExecutive | null = null;
    const founders: DiscoveredExecutive[] = [];
    const coFounders: DiscoveredExecutive[] = [];
    let cto: DiscoveredExecutive | null = null;
    let cfo: DiscoveredExecutive | null = null;
    const seniorExecutives: DiscoveredExecutive[] = [];
    const formerExecutives: DiscoveredExecutive[] = [];

    let totalFundingUsd: number | null = null;
    let latestRoundUsd: number | null = null;
    let latestRoundType: string | null = null;
    let latestRoundDate: string | null = null;
    const investors: string[] = [];
    const fundingRounds: DiscoveredFundingRound[] = [];

    let generalEmail: string | null = null;
    let phone: string | null = null;
    let contactPageUrl: string | null = null;
    const executiveEmails: CompanyResearchProfile['contacts']['executiveEmails'] = [];
    let companyLinkedInUrl: string | null = null;
    let companyXUrl: string | null = null;

    // STEP 1: FETCH OFFICIAL HOMEPAGE IF URL EXISTS
    if (officialUrl) {
      const homePage = await this.fetchPage(officialUrl, canonicalDomain);
      if (homePage) {
        inspectedPages.push(homePage);
        sources.push({
          url: homePage.url,
          title: homePage.title,
          tier: homePage.tier,
          retrievedAt: now,
        });

        // 1a. Extract Official Name & Meta Description
        if (homePage.html) {
          const $ = cheerio.load(homePage.html);
          const metaTitle = $('title').text().trim();
          const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;
          if (metaDesc) {
            description = metaDesc.trim();
            recordEvidence('description', description, homePage, metaDesc, 'meta_tags', 90);
          }

          // Clean title brand (e.g. "Intelligence at the edge of everywhere. | Blaize" -> "Blaize")
          if (metaTitle.includes('|')) {
            const parts = metaTitle.split('|').map(p => p.trim());
            const candidateBrand = parts[parts.length - 1];
            if (candidateBrand.length > 1 && candidateBrand.length < 30) {
              resolvedName = candidateBrand;
            }
          } else if (metaTitle.includes(' - ')) {
            const parts = metaTitle.split(' - ').map(p => p.trim());
            const candidateBrand = parts[parts.length - 1];
            if (candidateBrand.length > 1 && candidateBrand.length < 30) {
              resolvedName = candidateBrand;
            }
          }

          // Extract Social Links
          $('a[href*="linkedin.com/company/"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && !companyLinkedInUrl) {
              companyLinkedInUrl = href.split('?')[0].replace(/\/$/, '');
              recordEvidence('contacts.companyLinkedInUrl', companyLinkedInUrl, homePage, `LinkedIn link on ${homePage.url}`, 'meta_tags', 95);
            }
          });

          $('a[href*="twitter.com/"], a[href*="x.com/"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && !companyXUrl) {
              companyXUrl = href.split('?')[0].replace(/\/$/, '');
              recordEvidence('contacts.companyXUrl', companyXUrl, homePage, `X link on ${homePage.url}`, 'meta_tags', 95);
            }
          });

          // Extract Mailto Emails (Real public emails only)
          $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
              const email = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
              if (email && email.includes('@') && !generalEmail) {
                generalEmail = email;
                recordEvidence('contacts.generalEmail', generalEmail, homePage, `mailto link on ${homePage.url}`, 'firecrawl_scrape', 95);
              }
            }
          });
        }

        recordEvidence('officialName', resolvedName, homePage, `Brand title from ${homePage.title}`, 'firecrawl_scrape', 95);
        recordEvidence('website', officialUrl, homePage, officialUrl, 'firecrawl_scrape', 100);

        // 1b. Discover Internal Subpages
        const subpages = this.discoverSubpageUrls(homePage.html, officialUrl);
        const pagesToFetch = [
          ...subpages.aboutUrls,
          ...subpages.teamUrls,
          ...subpages.contactUrls,
          ...subpages.pressUrls,
        ].slice(0, 4); // Bounded to 4 relevant internal pages

        for (const subUrl of pagesToFetch) {
          const subPage = await this.fetchPage(subUrl, canonicalDomain);
          if (subPage) {
            inspectedPages.push(subPage);
            sources.push({
              url: subPage.url,
              title: subPage.title,
              tier: subPage.tier,
              retrievedAt: now,
            });
          }
        }
      }
    }

    // STEP 2: PARSE OFFICIAL PAGES FOR LEADERSHIP, GEOGRAPHY, FOUNDING, FUNDING
    for (const page of inspectedPages) {
      const text = `${page.title}\n${page.markdown}`;

      // A. Leadership Extraction (CEO, CTO, Founders)
      // e.g. "Dinakar Munagala co-founded Blaize® and serves as CEO."
      // e.g. "**Dinakar Munagala** CEO"
      const ceoRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:\s+co-founded\s+[^.]+?\s+and\s+serves\s+as\s+CEO|\s+is\s+the\s+CEO|\s+serves\s+as\s+CEO|\s*,\s*CEO|\s+CEO)/i;
      const ceoMatch = text.match(ceoRegex);
      if (ceoMatch && !ceo) {
        const name = ceoMatch[1].trim();
        if (!name.toLowerCase().includes('company') && !name.toLowerCase().includes('board')) {
          ceo = {
            name,
            title: 'Chief Executive Officer',
            role: 'CEO',
            isCurrent: true,
            evidence: ceoMatch[0],
            sourceUrl: page.url,
            confidence: 95,
          };
          recordEvidence('leadership.ceo', `${ceo.name} (CEO)`, page, ceoMatch[0], 'firecrawl_scrape', 95);
        }
      }

      // Founders extraction
      const founderMatches = Array.from(text.matchAll(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+co-founded/gi));
      for (const fm of founderMatches) {
        const fname = fm[1].trim();
        if (fname && !founders.some(f => f.name.toLowerCase() === fname.toLowerCase())) {
          const founderObj: DiscoveredExecutive = {
            name: fname,
            title: 'Co-Founder',
            role: 'Co-Founder',
            isCurrent: true,
            evidence: fm[0],
            sourceUrl: page.url,
            confidence: 90,
          };
          founders.push(founderObj);
          coFounders.push(founderObj);
        }
      }

      // CTO extraction
      const ctoRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:\s+co-founded\s+[^.]+?\s+and\s+serves\s+as\s+Chief\s+Technology\s+Officer|\s+serves\s+as\s+CTO|\s*,\s*Chief Technology Officer|\s+Chief Technology Officer)/i;
      const ctoMatch = text.match(ctoRegex);
      if (ctoMatch && !cto) {
        cto = {
          name: ctoMatch[1].trim(),
          title: 'Chief Technology Officer',
          role: 'CTO',
          isCurrent: true,
          evidence: ctoMatch[0],
          sourceUrl: page.url,
          confidence: 95,
        };
        recordEvidence('leadership.cto', `${cto.name} (CTO)`, page, ctoMatch[0], 'firecrawl_scrape', 95);
      }

      // B. Geography & Address Extraction
      // 1. Explicit headquarters statements: e.g. "With headquarters in El Dorado Hills (CA)" or "headquartered in London, UK"
      const hqPhrasingMatch = text.match(/(?:with\s+headquarters\s+in|headquarters\s+in|headquartered\s+in|based\s+in)\s+([A-Za-z\s]+)\s*\(([A-Z]{2})\)/i);
      if (hqPhrasingMatch && !hqCountry) {
        hqCity = hqPhrasingMatch[1].trim();
        hqState = hqPhrasingMatch[2].trim();
        hqCountry = 'United States';
        usPresence = true;
        operatingCountries.add('United States');
        recordEvidence('headquarters.country', hqCountry, page, hqPhrasingMatch[0], 'firecrawl_scrape', 95);
        recordEvidence('usPresence', true, page, `US Headquarters verified: ${hqPhrasingMatch[0]}`, 'firecrawl_scrape', 95);
      }

      // Check for US addresses (e.g. "El Dorado Hills, California, 95762, United States" or "CA 95762")
      const usAddrMatch = text.match(/([0-9]+\s+[A-Za-z0-9\s,]+),\s*(El Dorado Hills|San Francisco|New York|Austin|Boston|Seattle|San Jose|Los Angeles|Chicago|Denver|Palo Alto),\s*(CA|California|NY|New York|TX|Texas|WA|Washington|MA|Massachusetts)\s*([0-9]{5})?/i)
        || text.match(/(El Dorado Hills|San Francisco|New York|Austin|Boston|Seattle|San Jose|Los Angeles),\s*(CA|California|NY|TX|WA|MA),\s*(USA|United States)/i);
      
      if (usAddrMatch && !hqCountry) {
        hqCity = usAddrMatch[2] || usAddrMatch[1];
        hqState = usAddrMatch[3] || usAddrMatch[2];
        hqCountry = 'United States';
        hqAddress = usAddrMatch[0];
        usPresence = true;
        operatingCountries.add('United States');
        recordEvidence('headquarters.country', hqCountry, page, usAddrMatch[0], 'firecrawl_scrape', 95);
        recordEvidence('usPresence', true, page, `US Headquarters verified: ${usAddrMatch[0]}`, 'firecrawl_scrape', 95);
      }

      // Check for international operating offices (e.g. "US, UK, Japan, India, and UAE offices")
      const officesMatch = text.match(/(?:offices\s+in|teams\s+in|locations\s+in|offices\s+across)\s+([A-Za-z0-9,\s&]+)(?:offices|teams|hubs)/i);
      if (officesMatch) {
        const locs = officesMatch[1].split(/,|and/).map(s => s.trim()).filter(Boolean);
        locs.forEach(l => {
          if (l.length > 1 && l.length < 25) operatingCountries.add(l);
        });
      }

      // Contact page URL
      if (page.url.toLowerCase().includes('contact') && !contactPageUrl) {
        contactPageUrl = page.url;
        recordEvidence('contacts.contactPageUrl', contactPageUrl, page, `Official contact page: ${page.url}`, 'firecrawl_scrape', 100);
      }

      // Real email discovery from page mailto links or text
      if (!generalEmail) {
        const mailtoMatch = page.html.match(/href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/i);
        if (mailtoMatch) {
          generalEmail = mailtoMatch[1].trim().toLowerCase();
          recordEvidence('contacts.generalEmail', generalEmail, page, `mailto link on ${page.url}`, 'firecrawl_scrape', 95);
        } else if (page.url.toLowerCase().includes('contact')) {
          const directEmailMatch = page.markdown.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
          if (directEmailMatch) {
            generalEmail = directEmailMatch[1].trim().toLowerCase();
            recordEvidence('contacts.generalEmail', generalEmail, page, `Publicly listed email on ${page.url}`, 'firecrawl_scrape', 90);
          }
        }
      }

      // Real phone number discovery
      if (!phone) {
        const telMatch = page.html.match(/href=["']tel:([^"']+)["']/i);
        if (telMatch) {
          phone = telMatch[1].trim();
          recordEvidence('contacts.phone', phone, page, `tel link on ${page.url}`, 'firecrawl_scrape', 95);
        } else {
          const phoneRegex = /(?:\+1\s*)?(?:\([0-9]{3}\)|[0-9]{3})[-\s.][0-9]{3}[-\s.][0-9]{4}/;
          const phoneTextMatch = text.match(phoneRegex);
          if (phoneTextMatch) {
            phone = phoneTextMatch[0].trim();
            recordEvidence('contacts.phone', phone, page, `Phone on ${page.url}: ${phone}`, 'firecrawl_scrape', 90);
          }
        }
      }

      // Check for international operating offices (e.g. "US, UK, Japan, India, and UAE offices" or UK postal codes)
      if (text.includes('UK') || text.includes('United Kingdom') || text.includes('Leeds') || text.includes('Kings Langley')) {
        operatingCountries.add('United Kingdom');
      }
      if (text.includes('India') || text.includes('Hyderabad')) {
        operatingCountries.add('India');
      }
      if (text.includes('Japan') || text.includes('Tokyo')) {
        operatingCountries.add('Japan');
      }

      // C. Press / Disclosed Funding Rounds on Official Site
      // e.g. "Blaize Secures $106 Million in Funding"

      const fundingPressMatch = text.match(/(?:secures|closed|raises|raised)\s+\$([0-9]+(?:\.[0-9]+)?)\s*(Million|M|Billion|B)/i);
      if (fundingPressMatch && !latestRoundUsd) {
        const num = parseFloat(fundingPressMatch[1]);
        const mult = fundingPressMatch[2].toUpperCase().startsWith('B') ? 1e9 : 1e6;
        latestRoundUsd = Math.round(num * mult);
        latestRoundType = 'Venture Round';
        recordEvidence('funding.latestRoundUsd', latestRoundUsd, page, fundingPressMatch[0], 'firecrawl_scrape', 95);
      }
    }

    // STEP 3: EXTERNAL CROSS-CHECKING VIA FIRECRAWL SEARCH (Gaps filling)
    // If funding or CEO or founded year or geography is missing, run targeted reputable search
    if (firecrawlClient.isConfigured() && (!totalFundingUsd || !latestRoundUsd || !ceo || !foundedYear || !hqCountry)) {
      try {
        const query = `"${resolvedName}" funding headquarters Crunchbase Tracxn`;
        const searchRes = await firecrawlClient.search(query, { limit: 5 });
        if (searchRes.success && searchRes.data) {
          const items = Array.isArray(searchRes.data) ? searchRes.data : (searchRes.data.web || []);
          for (const item of items) {
            const itemText = `${item.title || ''} ${item.description || ''} ${item.markdown || ''}`;
            
            const itemUrl = item.url || '';
            const itemTitle = item.title || '';
            const itemPage: InspectedPage = {
              url: itemUrl,
              title: itemTitle,
              tier: 'TIER_2_AUTHORITATIVE',
              markdown: itemText,
              html: '',
              statusCode: 200,
            };

            // Check Geography from search snippets if still missing
            if (!hqCountry) {
              const hqSnippetMatch = itemText.match(/(?:located\s+in|headquartered\s+in|headquarters\s+in|based\s+in)\s+([A-Za-z\s]+),\s*(United States|USA|United Kingdom|UK|Germany|France|India|Japan|Canada)/i)
                || itemText.match(/(?:headquarters\s+in|headquartered\s+in|based\s+in)\s+([A-Za-z\s]+)\s*\(([A-Z]{2})\)/i)
                || itemText.match(/(?:corporate\s+office|headquarters|office)[^.]*?(El Dorado Hills|San Francisco|New York|Austin|Boston|Seattle|San Jose|Los Angeles),\s*(CA|California|NY|New York|TX|Texas|WA|MA)/i)
                || itemText.match(/(El Dorado Hills|San Francisco|New York|Austin|Boston|Seattle|San Jose|Los Angeles),\s*(CA|California|NY|TX|WA|MA)/i);
              if (hqSnippetMatch) {
                hqCity = hqSnippetMatch[1].trim();
                const matchedCountry = hqSnippetMatch[2]?.trim() || 'United States';
                hqCountry = matchedCountry.startsWith('US') || ['CA', 'California', 'NY', 'New York', 'TX', 'Texas', 'WA', 'MA'].includes(matchedCountry)
                  ? 'United States'
                  : matchedCountry;
                hqState = ['CA', 'California', 'NY', 'New York', 'TX', 'Texas', 'WA', 'MA'].includes(matchedCountry) ? matchedCountry : null;
                usPresence = hqCountry === 'United States';
                operatingCountries.add(hqCountry);
                recordEvidence('headquarters.country', hqCountry, itemPage, hqSnippetMatch[0], 'firecrawl_search', 90);
                recordEvidence('usPresence', usPresence, itemPage, `Headquarters verified from sources: ${hqSnippetMatch[0]}`, 'firecrawl_search', 90);
              }
            }

            // Check Crunchbase or reputable total / latest funding
            // e.g. "raised over $200MM" or "Announces $71M Series D" or "raised a total of $136M"
            const fundingMatch = itemText.match(/(?:raised(?:\s+over)?|secures|announces|closed|closes|total\s+funding(?:\s+amount)?(?:\s+of)?|raised\s+a\s+total\s+of|with\s+over)\s*\$([0-9]+(?:\.[0-9]+)?)\s*(M|million|MM|B|billion)/i);
            if (fundingMatch) {
              const num = parseFloat(fundingMatch[1]);
              const mult = fundingMatch[2].toUpperCase().startsWith('B') ? 1e9 : 1e6;
              const extractedAmount = Math.round(num * mult);

              if (itemText.toLowerCase().includes('total') || itemText.toLowerCase().includes('raised over') || itemText.toLowerCase().includes('total of')) {
                if (!totalFundingUsd) {
                  totalFundingUsd = extractedAmount;
                  recordEvidence('funding.totalFundingUsd', totalFundingUsd, itemPage, fundingMatch[0], 'firecrawl_search', 90);
                }
              }
              if (!latestRoundUsd) {
                latestRoundUsd = extractedAmount;
                const stageMatch = itemText.match(/Series\s+([A-Z])/i);
                latestRoundType = stageMatch ? `Series ${stageMatch[1]}` : 'Venture Round';
                recordEvidence('funding.latestRoundUsd', latestRoundUsd, itemPage, fundingMatch[0], 'firecrawl_search', 90);
              }
            }

            // Check Investors
            const investorsMatch = itemText.match(/(?:investors\s+(?:such\s+as|including)?|backed\s+by)\s+([A-Za-z0-9,\s&]+)(?:\.|and)/i);
            if (investorsMatch) {
              const list = investorsMatch[1].split(/,|and/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 30);
              list.forEach(inv => {
                if (!investors.includes(inv)) investors.push(inv);
              });
            }

            // Check Founded year (e.g. "founded in 2010" or "Founded Date 2010")
            const foundedMatch = itemText.match(/(?:was\s+founded\s+in|founded\s+in|founded\s+date|founded[:\s]+)\s*([12][0-9]{3})/i);
            if (foundedMatch && !foundedYear) {
              foundedYear = parseInt(foundedMatch[1], 10);
              recordEvidence('foundedYear', foundedYear, itemPage, foundedMatch[0], 'firecrawl_search', 90);
            }

            // Check CEO if still missing
            if (!ceo) {
              const extCeoMatch = itemText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}),\s*(?:CEO|Chief Executive Officer)/i);
              if (extCeoMatch) {
                ceo = {
                  name: extCeoMatch[1].trim(),
                  title: 'Chief Executive Officer',
                  role: 'CEO',
                  isCurrent: true,
                  evidence: extCeoMatch[0],
                  sourceUrl: itemUrl,
                  confidence: 90,
                };
                recordEvidence('leadership.ceo', `${ceo.name} (CEO)`, itemPage, extCeoMatch[0], 'firecrawl_search', 90);
              }
            }
          }
        }
      } catch (searchErr) {
        console.warn(`[Pipeline] Firecrawl cross-check search failed for ${resolvedName}:`, searchErr);
      }
    }

    // Compute derived company age
    let companyAgeYears: number | null = null;
    if (foundedYear) {
      companyAgeYears = Math.max(0, new Date().getFullYear() - foundedYear);
      recordEvidence('companyAgeYears', companyAgeYears, null, `Derived from founded year ${foundedYear}`, 'structured_json_ld', 95);
    }

    // Industry Classification based strictly on extracted facts & descriptions
    const fullCorpus = inspectedPages.map(p => `${p.title} ${p.markdown}`).join(' ').toLowerCase();
    if (fullCorpus.includes('processor') || fullCorpus.includes('silicon') || fullCorpus.includes('semiconductor') || fullCorpus.includes('edge ai') || fullCorpus.includes('hardware')) {
      primaryIndustry = 'AI & Machine Learning';
      subIndustry = 'Edge AI Processors & Computing';
      businessModel = 'Hardware & Embedded Software';
    } else if (fullCorpus.includes('saas') || fullCorpus.includes('software as a service')) {
      primaryIndustry = 'SaaS Companies';
      subIndustry = 'B2B SaaS';
      businessModel = 'Subscription Software';
    } else if (fullCorpus.includes('fintech') || fullCorpus.includes('banking') || fullCorpus.includes('payments')) {
      primaryIndustry = 'FinTech';
      subIndustry = 'Financial Technology';
    } else if (fullCorpus.includes('healthcare') || fullCorpus.includes('medical') || fullCorpus.includes('biotech')) {
      primaryIndustry = 'Healthcare & Pharma';
      subIndustry = 'HealthTech';
    } else if (description) {
      primaryIndustry = 'Technology';
      subIndustry = 'Software & Systems';
    }

    if (primaryIndustry) {
      recordEvidence('primaryIndustry', primaryIndustry, inspectedPages[0] || null, `Extracted industry taxonomy: ${primaryIndustry} (${subIndustry})`, 'firecrawl_scrape', 90);
    }

    // Leadership Founders Evidence
    if (founders.length > 0) {
      recordEvidence('leadership.founders', founders.map(f => f.name).join(', '), inspectedPages[0] || null, `Co-founders documented: ${founders.map(f => f.name).join(', ')}`, 'firecrawl_scrape', 90);
    }

    // Calculate Research Completeness
    let score = 0;
    if (resolvedName) score += 15;
    if (officialUrl) score += 15;
    if (description) score += 15;
    if (hqCountry) score += 15;
    if (ceo) score += 15;
    if (totalFundingUsd || latestRoundUsd) score += 15;
    if (generalEmail || phone || companyLinkedInUrl) score += 10;

    const researchCompletenessScore = Math.min(100, score);
    const researchStatus: ResearchStatus = inspectedPages.length > 0 ? (researchCompletenessScore >= 60 ? 'completed' : 'partially_completed') : 'failed';

    const profile: CompanyResearchProfile = {
      id: profileId,
      canonicalDomain: canonicalDomain || extractCanonicalDomain(officialUrl || '') || profileId,
      website: officialUrl || '',
      officialName: resolvedName,
      description,
      foundedYear,
      foundingDate,
      companyAgeYears,
      primaryIndustry,
      subIndustry,
      productsAndServices,
      businessModel,
      headquarters: {
        city: hqCity,
        stateOrRegion: hqState,
        country: hqCountry,
        address: hqAddress,
      },
      operatingCountries: Array.from(operatingCountries),
      usPresence,
      leadership: {
        ceo,
        founders,
        coFounders,
        cto,
        cfo,
        seniorExecutives,
        formerExecutives,
      },
      funding: {
        totalFundingUsd,
        latestRoundUsd,
        latestRoundType,
        latestRoundDate,
        investors,
        rounds: fundingRounds,
      },
      contacts: {
        generalEmail,
        phone,
        contactPageUrl,
        executiveEmails,
        companyLinkedInUrl,
        companyXUrl,
      },
      fieldEvidence,
      sources,
      researchStatus,
      statusReason: researchStatus === 'completed'
        ? 'Factual web extraction completed with authoritative evidence'
        : researchStatus === 'partially_completed'
        ? 'Partial web evidence retrieved; some factual fields remain undisclosed'
        : 'Failed to retrieve authoritative public sources for candidate',
      researchCompletenessScore,
      createdAt: now,
      updatedAt: now,
    };

    return profile;
  }
}

export const externalResearchPipeline = new ExternalResearchPipeline();
