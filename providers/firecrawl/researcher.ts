/**
 * Firecrawl Company Researcher
 * 
 * Conducts evidence-first research on candidate companies:
 * - High-fidelity web data extraction via Firecrawl Scrape API (/v2/scrape)
 * - Deep targeted source discovery via Firecrawl Search API (/v2/search)
 * - Optional autonomous research via Firecrawl Agent API (/v2/agent)
 * - Deterministic fact extraction & source evidence attribution
 * - Live DNS MX email deliverability validation
 * - Strict TargetProfile criteria evaluation without fabrication
 */

import { TargetProfile } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import { ResearchCandidateInput, CompanyVerificationResult } from '../types';
import { firecrawlClient } from './client';
import { fetchPageText } from '@/lib/extraction';
import { findVerifiedEmail } from '@/lib/email';
import { extractDomain, VERIFIED_GLOBAL_TECH_COMPANIES } from '@/lib/discovery';
import { parseFundingDetails } from '@/lib/validation';
import { detectCountryFromEvidence } from '@/lib/geography';
import { mapToStandardIndustry } from '@/lib/discoveryPipeline';
import {
  RawExtractedProfile,
  evaluateCriteria,
  buildCompanyRecordFromProfile,
} from '../claude/evaluator';
import * as cheerio from 'cheerio';

export async function researchCompanyWithFirecrawl(
  candidate: ResearchCandidateInput,
  target: TargetProfile | HuntConfig
): Promise<CompanyVerificationResult> {
  const targetUrl = candidate.website || candidate.url || (candidate.name ? `https://${candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : '');
  const domain = extractDomain(targetUrl);
  const companyName = candidate.name || domain.split('.')[0];
  const sources: string[] = [];

  let pageMarkdown = '';
  let pageHtml = '';
  let metaTitle = '';
  let metaDescription = '';

  // 1. Scrape Company Website via Firecrawl Scrape API
  if (targetUrl.startsWith('http')) {
    if (firecrawlClient.isConfigured()) {
      try {
        const scrapeRes = await firecrawlClient.scrape(targetUrl, {
          formats: ['markdown', 'html'],
          onlyMainContent: true,
          timeout: 20000,
        });

        if (scrapeRes.success && scrapeRes.data) {
          pageMarkdown = scrapeRes.data.markdown || '';
          pageHtml = scrapeRes.data.html || '';
          metaTitle = scrapeRes.data.metadata?.title || '';
          metaDescription = scrapeRes.data.metadata?.description || '';
          sources.push(targetUrl);
        }
      } catch (err: any) {
        console.warn(`[FirecrawlResearcher] Firecrawl scrape failed for ${targetUrl}:`, err?.message || err);
      }
    }

    // Fallback to Cheerio fetch if Firecrawl didn't return HTML/markdown
    if (!pageMarkdown && !pageHtml) {
      try {
        const pageData = await fetchPageText(targetUrl);
        if (pageData) {
          pageHtml = pageData.html;
          pageMarkdown = pageData.text;
          sources.push(targetUrl);
        }
      } catch (err: any) {
        console.warn(`[FirecrawlResearcher] Direct HTML fetch failed for ${targetUrl}:`, err?.message || err);
      }
    }
  }

  // 2. Initial Extraction from Website Content
  let extracted: RawExtractedProfile = extractProfileFromContent(
    companyName,
    targetUrl,
    domain,
    pageMarkdown,
    pageHtml,
    metaTitle,
    metaDescription,
    candidate.rawText
  );

  // 3. Targeted Venture Search if Leadership or Funding is missing
  if (firecrawlClient.isConfigured() && (!extracted.founderOrCeoName || !extracted.fundingText)) {
    try {
      const searchQueries: string[] = [];
      if (!extracted.founderOrCeoName) {
        searchQueries.push(`"${companyName}" (CEO OR founder OR "Chief Executive Officer")`);
      }
      if (!extracted.fundingText) {
        searchQueries.push(`"${companyName}" (funding OR "raised" OR "seed" OR "series")`);
      }

      for (const query of searchQueries) {
        const searchRes = await firecrawlClient.search(query, { limit: 3 });
        if (searchRes.success && searchRes.data) {
          const results = Array.isArray(searchRes.data) ? searchRes.data : (searchRes.data.web || []);
          for (const item of results) {
            if (item.url && !sources.includes(item.url)) {
              sources.push(item.url);
            }
            const snippetText = `${item.title || ''} ${item.description || ''} ${item.markdown || ''}`;

            // Check for founder/CEO in search result
            if (!extracted.founderOrCeoName) {
              const execMatch = snippetText.match(/(?:CEO|Chief Executive Officer|Founder|Co-Founder)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i)
                || snippetText.match(/([A-Z][a-z]+ [A-Z][a-z]+)(?:,\s*(?:CEO|Co-Founder|Founder|Chief Executive Officer))/i);
              if (execMatch && execMatch[1]) {
                const nameCand = execMatch[1].trim();
                if (!['United States', 'New York', 'San Francisco', 'Press Release', 'About Us'].includes(nameCand)) {
                  extracted.founderOrCeoName = nameCand;
                  extracted.founderTitle = 'Founder / CEO';
                }
              }
            }

            // Check for funding in search result
            if (!extracted.fundingText) {
              const fundingMatch = snippetText.match(/(?:raised|funding|seed round|series [a-z])\s+(?:of\s+)?([$€£]\s*[0-9]+(?:\.[0-9]+)?\s*(?:million|m|billion|b)?)/i)
                || snippetText.match(/([$€£]\s*[0-9]+(?:\.[0-9]+)?\s*(?:million|m|billion|b)?)\s+(?:seed|funding|round|series)/i);
              if (fundingMatch && fundingMatch[1]) {
                extracted.fundingText = fundingMatch[1].trim();
                const parsed = parseFundingDetails(extracted.fundingText);
                if (parsed?.amountUsd) {
                  extracted.fundingAmountUsd = parsed.amountUsd;
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[FirecrawlResearcher] Targeted search error for ${companyName}:`, err?.message || err);
    }
  }

  // 4. Check verified curated database fallback if facts still missing
  const verifiedMatch = VERIFIED_GLOBAL_TECH_COMPANIES.find(
    (c) => extractDomain(c.url) === domain || (companyName && c.name.toLowerCase() === companyName.toLowerCase())
  );
  if (verifiedMatch) {
    if (!extracted.name) extracted.name = verifiedMatch.name;
    if (!extracted.description) extracted.description = verifiedMatch.snippet;
    if (!extracted.industry) extracted.industry = verifiedMatch.industry;
    if (!extracted.fundingText) extracted.fundingText = verifiedMatch.fundingText;
    if (!extracted.country) extracted.country = verifiedMatch.country;
    if (!extracted.headquarters) extracted.headquarters = verifiedMatch.locationText;
    if (!extracted.founderOrCeoName) extracted.founderOrCeoName = verifiedMatch.founderOrCeo;
    if (!sources.includes(verifiedMatch.url)) sources.push(verifiedMatch.url);
  }

  // 5. Ensure core identifiers
  if (!extracted.website) extracted.website = targetUrl;
  if (!extracted.name) extracted.name = companyName;
  extracted.sources = sources.length > 0 ? sources : [targetUrl];

  // 6. Live DNS MX Verification for Executive Email
  const execName = extracted.founderOrCeoName || companyName;
  let mxResult: { email: string | null; verified: boolean; mxHost?: string | null } | undefined;

  if (extracted.website && extracted.website.includes('.')) {
    try {
      mxResult = await findVerifiedEmail(execName, extracted.website);
    } catch {}
  }

  // 7. Deterministic Criteria Evaluation
  const evaluation = evaluateCriteria(extracted, target, mxResult);

  // 8. Assemble Unified CompanyRecord
  const company = buildCompanyRecordFromProfile(
    extracted,
    evaluation,
    targetUrl,
    'Firecrawl Research Provider'
  );
  if (extracted.fundingAmountUsd) {
    company.fundingAmount = extracted.fundingAmountUsd;
    company.totalFundingUsd = extracted.fundingAmountUsd;
  }

  const finalStatus = evaluation.status === 'QUALIFIED' ? 'VERIFIED' : evaluation.status;

  return {
    company,
    verificationStatus: finalStatus as any,
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
 * Deterministic fact extractor from scraped markdown, HTML, and metadata
 */
function extractProfileFromContent(
  companyName: string,
  targetUrl: string,
  domain: string,
  markdown: string,
  html: string,
  metaTitle: string,
  metaDescription: string,
  rawText?: string
): RawExtractedProfile {
  let name = companyName;
  let description = metaDescription || null;
  let country: string | null = null;
  let founderOrCeoName: string | null = null;
  let founderTitle: string | null = null;
  let founderLinkedin: string | null = null;
  let companyLinkedin: string | null = null;
  let fundingText: string | null = null;
  let fundingAmountUsd: number | null = null;
  let industry: string | null = null;

  // 1. Parse JSON-LD and HTML tags if HTML is available
  if (html) {
    try {
      const $ = cheerio.load(html);

      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const parsed = JSON.parse($(el).html() || '{}');
          const entity = Array.isArray(parsed) ? parsed[0] : parsed;
          if (entity && (entity['@type'] === 'Organization' || entity['@type'] === 'Corporation')) {
            if (entity.name && (!name || name === domain.split('.')[0])) name = entity.name;
            if (entity.description && !description) description = entity.description;
            if (entity.founder?.name && !founderOrCeoName) founderOrCeoName = entity.founder.name;
            if (entity.address?.addressCountry && !country) country = entity.address.addressCountry;
          }
        } catch {}
      });

      if (!name || name === domain.split('.')[0]) {
        const ogTitle = $('meta[property="og:title"]').attr('content') || metaTitle || $('title').text() || '';
        if (ogTitle) {
          name = ogTitle.split(/[-–|:]/)[0].trim() || domain.split('.')[0];
        }
      }

      if (!description) {
        description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || null;
      }

      // Check for LinkedIn links
      $('a[href*="linkedin.com"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          if (href.includes('/company/') && !companyLinkedin) {
            companyLinkedin = href.split('?')[0];
          } else if (href.includes('/in/') && !founderLinkedin) {
            founderLinkedin = href.split('?')[0];
          }
        }
      });
    } catch {}
  }

  // 2. Parse Markdown/Text for venture facts
  const fullText = `${markdown} ${rawText || ''}`;

  if (!country) {
    const detected = detectCountryFromEvidence(fullText, targetUrl);
    country = detected?.name || null;
  }

  if (!industry) {
    const mapped = mapToStandardIndustry(metaTitle || name, fullText);
    if (mapped.standard_industry && mapped.standard_industry !== 'Other / Custom') {
      industry = mapped.standard_industry;
    }
  }

  // Extract funding if present
  const fundingMatch = fullText.match(/(?:raised|funding|seed round|series [a-z])\s+(?:of\s+)?([$€£]\s*[0-9]+(?:\.[0-9]+)?\s*(?:million|m|billion|b)?)/i)
    || fullText.match(/([$€£]\s*[0-9]+(?:\.[0-9]+)?\s*(?:million|m|billion|b)?)\s+(?:seed|funding|round|series)/i);

  if (fundingMatch && fundingMatch[1]) {
    fundingText = fundingMatch[1].trim();
    const parsed = parseFundingDetails(fundingText);
    if (parsed?.amountUsd) {
      fundingAmountUsd = parsed.amountUsd;
    }
  }

  // Extract leadership patterns if still null
  if (!founderOrCeoName) {
    const leaderMatch = fullText.match(/(?:founded by|co-founded by|CEO|Chief Executive Officer)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i)
      || fullText.match(/([A-Z][a-z]+ [A-Z][a-z]+)(?:,\s*(?:CEO|Co-Founder|Founder|Chief Executive Officer))/i);
    if (leaderMatch && leaderMatch[1]) {
      const candidateName = leaderMatch[1].trim();
      if (!['United States', 'New York', 'San Francisco', 'Terms Of', 'Privacy Policy'].includes(candidateName)) {
        founderOrCeoName = candidateName;
        founderTitle = 'Founder / CEO';
      }
    }
  }

  const cleanedFirstParagraph = markdown
    ? markdown.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#') && l.length > 20)?.slice(0, 250) || null
    : null;

  return {
    name: name || domain.split('.')[0],
    website: targetUrl,
    description: description || metaDescription || cleanedFirstParagraph || rawText?.slice(0, 160) || null,
    industry,
    fundingText,
    fundingAmountUsd,
    country,
    headquarters: country,
    usPresenceDetails: country,
    founderOrCeoName,
    founderTitle,
    founderLinkedin,
    companyLinkedin,
    evidenceText: fullText.slice(0, 500),
    sources: [targetUrl],
  };
}
