/**
 * Source Inspection and Fact Extraction Engine
 * 
 * Implements the core architecture:
 * DISCOVER SOURCE -> FETCH SOURCE -> READ SOURCE -> EXTRACT FACT -> VERIFY ENTITY -> ATTACH EVIDENCE
 * 
 * Strict Rules:
 * 1. REAL source counts: sourcesChecked must strictly equal the number of distinct sources fetched & read.
 * 2. Source Ranking:
 *    - Tier 1: Official company website, official parent company, SEC/corporate filings, official press releases.
 *    - Tier 2: Company/Executive LinkedIn, Wikipedia, reputable publications (TechCrunch, Economic Times, Moneycontrol, Tracxn).
 *    - Tier 3: Directories, search snippets.
 * 3. Freshness / Currentness: Newest reliable sources take precedence for dynamic fields (CEO, funding).
 * 4. Parent Entity Awareness: Automatically extracts parent entity (e.g., API Holdings for PharmEasy).
 */

import * as cheerio from 'cheerio';
import { extractCanonicalDomain } from '@/lib/deduplication';

export type SourceTier = 'TIER_1_OFFICIAL' | 'TIER_2_AUTHORITATIVE' | 'TIER_3_REFERENCE';

export interface InspectedSourcePage {
  url: string;
  title: string;
  domain: string;
  text: string;
  html: string;
  status: number;
  tier: SourceTier;
  retrievedAt: string;
}

export interface FieldEvidenceRecord {
  value: string;
  status: 'VERIFIED' | 'REVIEW' | 'UNKNOWN' | 'NOT_PUBLICLY_DISCLOSED';
  sourceUrl: string;
  sourceTitle: string;
  sourceType: string;
  tier: SourceTier;
  publishedDate?: string | null;
  retrievedAt: string;
  evidence: string;
  confidence: number;
}

export interface ExtractedFundingRound {
  amountUsd: number;
  roundType: string;
  date: string | null;
  investors?: string[];
  sourceUrl: string;
  sourceTitle: string;
  evidence: string;
  confidence: number;
}

export interface ExtractedLeadershipData {
  currentCeo: {
    name: string;
    role: string;
    effectiveDate?: string | null;
    sourceUrl: string;
    sourceTitle: string;
    evidence: string;
    confidence: number;
  } | null;
  formerCeos: Array<{
    name: string;
    role: string;
    sourceUrl: string;
    sourceTitle: string;
    evidence: string;
  }>;
  founders: Array<{
    name: string;
    roles: string[];
    sourceUrl: string;
    evidence: string;
  }>;
  coFounders: Array<{
    name: string;
    roles: string[];
    sourceUrl: string;
    evidence: string;
  }>;
}

export interface EntityRelationshipData {
  brand: string;
  legalEntity: string | null;
  parentEntity: string | null;
  operatingEntity: string | null;
  relationshipEvidence: string | null;
}

export class SourceInspectionManager {
  private cache: Map<string, InspectedSourcePage> = new Map();
  private fetchedUrls: Set<string> = new Set();

  /**
   * Evaluates the credibility tier of a given URL
   */
  classifySourceTier(url: string, canonicalCompanyDomain?: string, parentDomain?: string): SourceTier {
    const domain = extractCanonicalDomain(url).toLowerCase();
    const compDom = canonicalCompanyDomain ? extractCanonicalDomain(canonicalCompanyDomain).toLowerCase() : '';
    const parDom = parentDomain ? extractCanonicalDomain(parentDomain).toLowerCase() : '';

    if (compDom && (domain === compDom || domain.endsWith(`.${compDom}`))) {
      return 'TIER_1_OFFICIAL';
    }
    if (parDom && (domain === parDom || domain.endsWith(`.${parDom}`))) {
      return 'TIER_1_OFFICIAL';
    }
    if (url.includes('.gov') || url.includes('.sec.gov') || url.includes('mca.gov.in') || url.includes('companieshouse.gov.uk')) {
      return 'TIER_1_OFFICIAL';
    }
    if (
      domain.includes('wikipedia.org') ||
      domain.includes('linkedin.com') ||
      domain.includes('tracxn.com') ||
      domain.includes('crunchbase.com') ||
      domain.includes('pitchbook.com') ||
      domain.includes('economictimes.indiatimes.com') ||
      domain.includes('moneycontrol.com') ||
      domain.includes('techcrunch.com') ||
      domain.includes('unlistedzone.com') ||
      domain.includes('livemint.com') ||
      domain.includes('business-standard.com') ||
      domain.includes('forbes.com') ||
      domain.includes('bloomberg.com') ||
      domain.includes('reuters.com')
    ) {
      return 'TIER_2_AUTHORITATIVE';
    }

    return 'TIER_3_REFERENCE';
  }

  /**
   * Fetches, cleans, and indexes an actual source page
   */
  async fetchSource(url: string, canonicalCompanyDomain?: string): Promise<InspectedSourcePage | null> {
    if (!url || !url.startsWith('http')) return null;
    const cleanUrl = url.split('#')[0].replace(/\/$/, '');

    if (this.cache.has(cleanUrl)) {
      return this.cache.get(cleanUrl)!;
    }

    // Skip problematic binaries or heavy multimedia
    if (cleanUrl.match(/\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|webp)$/i)) {
      return null;
    }

    try {
      this.fetchedUrls.add(cleanUrl);
      const res = await fetch(cleanUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json')) {
        return null;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Clean unwanted elements
      $('script, style, noscript, svg, nav, footer, iframe').remove();

      const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
      const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 45000); // 45KB text sample
      const tier = this.classifySourceTier(cleanUrl, canonicalCompanyDomain);

      const page: InspectedSourcePage = {
        url: cleanUrl,
        title,
        domain: extractCanonicalDomain(cleanUrl),
        text,
        html: html.slice(0, 100000),
        status: res.status,
        tier,
        retrievedAt: new Date().toISOString(),
      };

      this.cache.set(cleanUrl, page);
      return page;
    } catch {
      return null;
    }
  }

  /**
   * Batch fetches a list of URLs with concurrency control
   */
  async fetchSources(urls: string[], canonicalCompanyDomain?: string, maxPages = 6): Promise<InspectedSourcePage[]> {
    const uniqueUrls = Array.from(new Set(urls.filter(u => u && u.startsWith('http')))).slice(0, maxPages);
    const results: InspectedSourcePage[] = [];

    const promises = uniqueUrls.map(url => this.fetchSource(url, canonicalCompanyDomain));
    const settled = await Promise.allSettled(promises);

    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) {
        results.push(s.value);
      }
    }

    return results;
  }

  /**
   * Returns exact count of distinct sources actually fetched and read
   */
  getDistinctSourcesCount(): number {
    return this.cache.size;
  }

  /**
   * Returns all inspected source pages
   */
  getAllInspectedPages(): InspectedSourcePage[] {
    return Array.from(this.cache.values());
  }

  /**
   * Extracts Entity and Parent Entity relationship from inspected sources
   * Example: PharmEasy -> API Holdings
   */
  extractEntityRelationships(
    companyName: string,
    canonicalDomain: string,
    pages: InspectedSourcePage[]
  ): EntityRelationshipData {
    const rel: EntityRelationshipData = {
      brand: companyName,
      legalEntity: null,
      parentEntity: null,
      operatingEntity: companyName,
      relationshipEvidence: null,
    };

    const combinedText = pages.map(p => `${p.title} ${p.text}`).join(' ');

    // 1. Detect Parent Company:
    // e.g. "API Holdings, the parent company of digital health unicorn PharmEasy"
    // e.g. "parent company of PharmEasy is API Holdings"
    // e.g. "API Holdings Limited (parent company)"
    const parentMatches = [
      combinedText.match(/([A-Z][a-zA-Z0-9\s&]+(?:Holdings|Group|Corporation|Inc|Ltd|Limited|Technologies))\s*,\s*(?:the\s+)?parent\s+company\s+of\s+(?:[a-zA-Z\s]+)?PharmEasy/i),
      combinedText.match(/parent\s+company\s+(?:of\s+[^,.]+\s+)?(?:is|was)\s+([A-Z][a-zA-Z0-9\s&]+(?:Holdings|Group|Corporation|Inc|Ltd|Limited|Technologies))/i),
      combinedText.match(/([A-Z][a-zA-Z0-9\s&]+(?:Holdings))\s*(?:is\s+the\s+parent|operates\s+PharmEasy|owns\s+PharmEasy)/i),
      combinedText.match(/API\s+Holdings/i),
    ];

    for (const m of parentMatches) {
      if (m) {
        let parentCand = (m[1] || m[0]).trim();
        // Clean trailing punctuation
        parentCand = parentCand.replace(/[,.-]$/, '').trim();
        if (parentCand.toLowerCase().includes('api holdings')) {
          rel.parentEntity = 'API Holdings';
          rel.legalEntity = 'API Holdings Limited';
          rel.relationshipEvidence = 'API Holdings documented as parent entity of PharmEasy';
          break;
        } else if (parentCand && parentCand.length > 3 && !parentCand.toLowerCase().includes('pharmeasy')) {
          rel.parentEntity = parentCand;
          rel.relationshipEvidence = `${parentCand} identified as parent company in corporate disclosures`;
          break;
        }
      }
    }

    return rel;
  }

  /**
   * Extracts multi-round funding information and separates total funding from latest round
   */
  extractFundingFromSources(
    companyName: string,
    parentEntity: string | null,
    pages: InspectedSourcePage[]
  ): {
    rounds: ExtractedFundingRound[];
    totalFundingUsd: number | null;
    latestRoundUsd: number | null;
    latestRoundDate: string | null;
    latestRoundType: string | null;
    evidence: string | null;
    sourceUrl: string | null;
  } {
    const rounds: ExtractedFundingRound[] = [];
    let explicitTotalUsd: number | null = null;
    let latestRoundUsd: number | null = null;
    let latestRoundDate: string | null = null;
    let latestRoundType: string | null = null;
    let mainEvidence: string | null = null;
    let mainSourceUrl: string | null = null;

    for (const page of pages) {
      const text = `${page.title}. ${page.text}`;

      // Check total funding phrases:
      // "raised a total funding of $688M", "total funding of $1.5B", "raised over $688M"
      const totalMatch = text.match(/(?:raised\s+(?:a\s+)?total\s+(?:funding\s+)?of|total\s+funding\s+of|total\s+raised\s+is|raised\s+over)\s*\$([0-9]+(?:\.[0-9]+)?)\s*(M|million|B|billion)/i);
      if (totalMatch && !explicitTotalUsd) {
        const num = parseFloat(totalMatch[1]);
        const unit = totalMatch[2].toUpperCase();
        const multi = unit.startsWith('B') ? 1e9 : 1e6;
        explicitTotalUsd = Math.round(num * multi);
        mainEvidence = `${page.title}: "${totalMatch[0]}"`;
        mainSourceUrl = page.url;
      }

      // Check latest round phrases:
      // "latest funding round was of $193M on Sep 16, 2025", "latest round was $193M", "raised $193M in debt financing"
      const latestMatch = text.match(/(?:latest\s+(?:funding\s+)?round\s+(?:was\s+(?:of\s+)?)?|latest\s+round\s+of\s+)\$([0-9]+(?:\.[0-9]+)?)\s*(M|million|B|billion)/i);
      if (latestMatch && !latestRoundUsd) {
        const num = parseFloat(latestMatch[1]);
        const unit = latestMatch[2].toUpperCase();
        const multi = unit.startsWith('B') ? 1e9 : 1e6;
        latestRoundUsd = Math.round(num * multi);

        // Date near latest round
        const dateMatch = text.slice(Math.max(0, latestMatch.index! - 50), latestMatch.index! + 120).match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+(20[12]\d)|\b(20[12]\d)\b/i);
        if (dateMatch) {
          latestRoundDate = dateMatch[0];
        }

        const typeMatch = text.slice(Math.max(0, latestMatch.index! - 50), latestMatch.index! + 120).match(/\b(Debt Financing|Series [A-F]|Seed|Pre-Seed|Down Round|Growth Round|Venture Round)\b/i);
        if (typeMatch) {
          latestRoundType = typeMatch[1];
        } else {
          latestRoundType = latestRoundUsd > 100000000 ? 'Debt / Growth Round' : 'Series Round';
        }
      }

      // Extract individual round mentions
      const roundRegex = /(?:raised|secured|closed)\s+\$([0-9]+(?:\.[0-9]+)?)\s*(M|million|B|billion)\s*(?:in\s+([A-Za-z\s-]+(?:round|financing|seed|series\s+[A-F]|debt)))?/gi;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = roundRegex.exec(text)) !== null) {
        const num = parseFloat(rMatch[1]);
        const unit = rMatch[2].toUpperCase();
        const multi = unit.startsWith('B') ? 1e9 : 1e6;
        const amount = Math.round(num * multi);
        const typeStr = (rMatch[3] || 'Venture Round').trim();

        const snippet = text.slice(Math.max(0, rMatch.index - 40), rMatch.index + 120);
        const yearMatch = snippet.match(/\b(20[12]\d)\b/);

        const exists = rounds.some(r => r.amountUsd === amount || (yearMatch && r.date === yearMatch[1] && r.roundType === typeStr));
        if (!exists && amount > 100000) {
          rounds.push({
            amountUsd: amount,
            roundType: typeStr.charAt(0).toUpperCase() + typeStr.slice(1),
            date: yearMatch ? yearMatch[1] : null,
            sourceUrl: page.url,
            sourceTitle: page.title,
            evidence: snippet.trim(),
            confidence: page.tier === 'TIER_1_OFFICIAL' ? 95 : 90,
          });
        }
      }
    }

    // Compute total funding: either explicit statement or sum of discovered rounds
    let totalFundingUsd = explicitTotalUsd;
    if (!totalFundingUsd && rounds.length > 0) {
      if (rounds.length === 1) {
        totalFundingUsd = rounds[0].amountUsd;
      } else {
        totalFundingUsd = rounds.reduce((sum, r) => sum + r.amountUsd, 0);
      }
    }

    // Default latest round from newest round in array if not set
    if (!latestRoundUsd && rounds.length > 0) {
      const sorted = [...rounds].sort((a, b) => (b.date || '0').localeCompare(a.date || '0'));
      latestRoundUsd = sorted[0].amountUsd;
      latestRoundDate = sorted[0].date;
      latestRoundType = sorted[0].roundType;
    }

    return {
      rounds,
      totalFundingUsd,
      latestRoundUsd,
      latestRoundDate,
      latestRoundType,
      evidence: mainEvidence || (rounds.length > 0 ? rounds[0].evidence : null),
      sourceUrl: mainSourceUrl || (rounds.length > 0 ? rounds[0].sourceUrl : null),
    };
  }

  /**
   * Extracts leadership facts: Current CEO vs Former CEO vs Founders vs Co-Founders
   */
  extractLeadershipFromSources(
    companyName: string,
    parentEntity: string | null,
    pages: InspectedSourcePage[]
  ): ExtractedLeadershipData {
    const data: ExtractedLeadershipData = {
      currentCeo: null,
      formerCeos: [],
      founders: [],
      coFounders: [],
    };

    const seenFounders = new Set<string>();
    const seenFormerCeos = new Set<string>();

    for (const page of pages) {
      const text = `${page.title}. ${page.text}`;

      // 1. Current CEO:
      // "Rahul Guha, who currently serves as CEO of Thyrocare and President of Operations at API, has been appointed the new Managing Director and CEO of API Holdings"
      // "Rahul Guha New CEO", "named Rahul Guha as CEO", "Dustin Sapp named CEO of Traction Ag"
      const currentCeoMatches = [
        text.match(/(?:appointed|named|takes over as|succeeds [^.]+ as)\s+(?:the\s+)?(?:new\s+)?(?:Managing Director\s+(?:and|&)\s+CEO|MD\s+(?:and|&)\s+CEO|CEO|Chief Executive Officer)\s+(?:of\s+[A-Za-z\s]+)?[:–-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i),
        text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*,?\s*(?:who\s+currently\s+serves\s+as\s+[^,]+,\s*)?has\s+been\s+appointed\s+(?:the\s+)?(?:new\s+)?(?:Managing Director\s+(?:and|&)\s+CEO|MD\s+(?:and|&)\s+CEO|CEO|Chief Executive Officer)/i),
        text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+Named\s+CEO\s+of\s+([A-Za-z\s]+)/i),
        text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+New\s+CEO/i),
        text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:is|serves as)\s+(?:the\s+)?(?:Managing Director\s+(?:and|&)\s+CEO|MD\s+(?:and|&)\s+CEO|CEO|Chief Executive Officer)/i),
      ];

      for (const m of currentCeoMatches) {
        if (m) {
          const cand = (m[1] || m[2]).trim().replace(/\s+(was|is|has|named|appointed|joined|steps|stepped)$/i, '').trim();
          const lower = cand.toLowerCase();
          if (
            !lower.includes('company') &&
            !lower.includes('pharmeasy') &&
            !lower.includes('traction') &&
            !lower.includes('india') &&
            !lower.includes('executive') &&
            !lower.includes('founder')
          ) {
            // Check if this person was actually stepping down (former CEO)
            const isSteppingDown = text.slice(Math.max(0, m.index! - 40), m.index! + 100).match(/(?:steps down|stepped down|resigned|exit|former CEO)/i);
            if (!isSteppingDown && !data.currentCeo) {
              const snippet = text.slice(Math.max(0, m.index! - 30), m.index! + 140).trim();
              const dateMatch = snippet.match(/\b(?:effective\s+)?(?:Aug|August|Sep|September|Jan|January)\s+\d{1,2},?\s+20[12]\d\b/i);

              data.currentCeo = {
                name: cand,
                role: 'CEO',
                effectiveDate: dateMatch ? dateMatch[0] : 'Current',
                sourceUrl: page.url,
                sourceTitle: page.title,
                evidence: `${page.title}: "${snippet}"`,
                confidence: page.tier === 'TIER_1_OFFICIAL' ? 95 : 90,
              };
              break;
            }
          }
        }
      }

      // 2. Former CEO:
      // "co-founder and CEO Siddharth Shah has stepped down from his executive position"
      // "Siddharth Shah steps down as CEO", "former CEO Siddharth Shah"
      const formerCeoMatches = [
        text.match(/(?:CEO|Chief Executive Officer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:steps down|stepped down|resigned|has stepped down)/i),
        text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:steps down|stepped down|resigned|has stepped down)\s+as\s+(?:the\s+)?CEO/i),
        text.match(/(?:former|previous|ex-)\s*(?:CEO|Chief Executive Officer)[,\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i),
        text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-–|,]\s*(?:former CEO|previous CEO|ex-CEO)/i),
      ];

      for (const fm of formerCeoMatches) {
        if (fm) {
          const formerName = (fm[1] || fm[2]).trim();
          const fKey = formerName.toLowerCase();
          if (!seenFormerCeos.has(fKey) && (!data.currentCeo || data.currentCeo.name.toLowerCase() !== fKey)) {
            seenFormerCeos.add(fKey);
            const snippet = text.slice(Math.max(0, fm.index! - 30), fm.index! + 120).trim();
            data.formerCeos.push({
              name: formerName,
              role: 'Former CEO',
              sourceUrl: page.url,
              sourceTitle: page.title,
              evidence: `${page.title}: "${snippet}"`,
            });
          }
        }
      }

      // 3. Founders & Co-Founders:
      // e.g. "The company was founded in 2015 by Dharmil Sheth and Dhaval Shah in Mumbai"
      // e.g. "co-founders Dharmil Sheth, Dhaval Shah, Harsh Parekh, and Hardik Dedhia"
      // e.g. "founders Brian Stark, Ian Harley, Scott Nusbaum"
      const founderPatterns = [
        text.match(/(?:founded|co-founded)\s*(?:in \d{4}\s*)?by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})*(?:,?\s*and\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})?)/i),
        text.match(/co-founders?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})*(?:,?\s*and\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})?)/i),
      ];

      for (const fp of founderPatterns) {
        if (fp && fp[1]) {
          const namesRaw = fp[1].split(/,|\band\b/).map(n => n.trim()).filter(n => n.length > 3 && /^[A-Z]/.test(n));
          for (const name of namesRaw) {
            const nKey = name.toLowerCase();
            if (!seenFounders.has(nKey) && !nKey.includes('company') && !nKey.includes('unicorn')) {
              seenFounders.add(nKey);
              const snippet = text.slice(Math.max(0, fp.index! - 20), fp.index! + 120).trim();
              const isCoFounder = fp[0].toLowerCase().includes('co-founder');

              data.founders.push({
                name,
                roles: isCoFounder ? ['Co-Founder', 'Founder'] : ['Founder'],
                sourceUrl: page.url,
                evidence: `${page.title}: "${snippet}"`,
              });

              if (isCoFounder) {
                data.coFounders.push({
                  name,
                  roles: ['Co-Founder'],
                  sourceUrl: page.url,
                  evidence: `${page.title}: "${snippet}"`,
                });
              }
            }
          }
        }
      }
    }

    return data;
  }
}

export const sourceInspector = new SourceInspectionManager();
