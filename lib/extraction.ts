/**
 * Extraction Module
 * 
 * Fetches company page HTML, extracts clean text, and extracts structured data:
 * 1. Uses Anthropic Claude (if valid key is provided)
 * 2. Intelligent JSON-LD / HTML / Metadata and Snippet Extractor fallback
 *    so extraction never fails even if Anthropic API key is invalid/expired.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { ExtractedCompanyData, CandidateUrl } from './types';
import { VERIFIED_NON_US_TECH_COMPANIES, extractDomain } from './discovery';

const MODEL = 'claude-3-5-haiku-20241022';

const SYSTEM_PROMPT = `You are a precise data extraction engine. Given raw text from a company webpage, extract ONLY the following fields as valid JSON. No markdown, no preamble, no explanation.

Return exactly this JSON shape:
{
  "name": string | null,
  "description": string | null,
  "industry": string | null,
  "fundingOrRevenueText": string | null,
  "usPresenceEvidence": string | null,
  "founderOrCeoName": string | null
}

Rules:
- "name": Company name exactly as shown on the page
- "description": 1-2 sentence summary of what the company does
- "industry": Primary industry/category (e.g., "SaaS", "Fintech", "Healthtech", "Marketplace")
- "fundingOrRevenueText": Raw text snippet mentioning funding amount or revenue (e.g., "raised $2.5M Series A", "annual revenue $3M"). Include currency and numbers. Null if not found.
- "usPresenceEvidence": Raw text snippet indicating US presence OR clear non-US evidence (e.g., "based in Berlin", "headquartered in London", "serving European markets"). Null if not determinable.
- "founderOrCeoName": Full name of CEO or co-founder. Null if not found.

If a field cannot be confidently determined from the text, return null. Never guess.`;

/**
 * Fetch HTML from a URL with timeout
 */
export async function fetchPageText(url: string): Promise<{ text: string; html: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return null;
    }

    const html = await response.text();
    const text = extractTextFromHtml(html);
    return { text, html };
  } catch {
    return null;
  }
}

/**
 * Clean text extraction with Cheerio
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, .ads, .advertisement, .cookie-banner, .newsletter, svg').remove();
  
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];
  let text = '';
  
  for (const selector of mainSelectors) {
    const el = $(selector).first();
    if (el.length) {
      text = el.text();
      break;
    }
  }
  
  if (!text) {
    text = $('body').text();
  }
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
    .slice(0, 20000);
}

/**
 * Fallback Rule-Based & Metadata Extractor
 * Parses JSON-LD, OpenGraph tags, snippet context, and verified registry facts
 */
export function extractStructuredDataFallback(
  candidate: CandidateUrl,
  pageData?: { text: string; html: string } | null
): ExtractedCompanyData | null {
  const domain = extractDomain(candidate.url);

  // 1. Check if this candidate matches our verified non-US tech platform registry
  const verifiedMatch = VERIFIED_NON_US_TECH_COMPANIES.find(
    c => extractDomain(c.url) === domain || candidate.snippet.toLowerCase().includes(c.name.toLowerCase())
  );

  if (verifiedMatch) {
    return {
      name: verifiedMatch.name,
      description: verifiedMatch.snippet.split('.')[0] + '.',
      industry: verifiedMatch.industry,
      fundingOrRevenueText: verifiedMatch.fundingText,
      usPresenceEvidence: verifiedMatch.locationText,
      founderOrCeoName: verifiedMatch.founderOrCeo,
    };
  }

  // 2. Parse from HTML & metadata if page was fetched
  if (pageData) {
    const $ = cheerio.load(pageData.html);
    
    // Check JSON-LD
    let jsonLdName: string | null = null;
    let jsonLdFounder: string | null = null;
    let jsonLdCountry: string | null = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        const entity = Array.isArray(parsed) ? parsed[0] : parsed;
        if (entity['@type'] === 'Organization' || entity['@type'] === 'Corporation') {
          if (entity.name) jsonLdName = entity.name;
          if (entity.founder?.name) jsonLdFounder = entity.founder.name;
          if (entity.address?.addressCountry) jsonLdCountry = entity.address.addressCountry;
        }
      } catch {}
    });

    const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const cleanName = jsonLdName || ogTitle.split(/[-–|:]/)[0].trim() || domain.split('.')[0];

    // Search text + snippet for funding
    const combinedContent = `${candidate.snippet} ${pageData.text}`;
    const fundingMatch = combinedContent.match(/(?:raised|secures|closed|funded|funding)\s+(?:an?|of)?\s*([€$£]?\s*[\d,.]+\s*(?:million|m|b)\b)/i);
    const fundingText = fundingMatch ? fundingMatch[0] : null;

    // Search text + snippet for founder
    const founderMatch = jsonLdFounder ||
      combinedContent.match(/(?:founded by|co-founded by|founder|ceo)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i)?.[1] || null;

    // Search text for location
    const locationMatch = jsonLdCountry ||
      combinedContent.match(/(?:based in|headquartered in|located in|office in)\s+([A-Za-z\s,]{3,35})/i)?.[0] || null;

    // Determine tech industry
    const industries = ['SaaS', 'Fintech', 'Healthtech', 'AI/ML', 'Developer Tools', 'Cleantech', 'Cybersecurity', 'Platform'];
    const lowerContent = combinedContent.toLowerCase();
    const matchedIndustry = industries.find(ind => lowerContent.includes(ind.toLowerCase())) || 'Tech Platform';

    if (cleanName && cleanName.length >= 2) {
      return {
        name: cleanName,
        description: ogDesc.slice(0, 300) || `${cleanName} is a technology platform.`,
        industry: matchedIndustry,
        fundingOrRevenueText: fundingText,
        usPresenceEvidence: locationMatch,
        founderOrCeoName: founderMatch,
      };
    }
  }

  // 3. Extract from snippet if nothing else
  const snippet = candidate.snippet;
  const fundingInSnippet = snippet.match(/(?:raised|closed|seed|funding|series a)\s+[€$£]?\s*[\d,.]+\s*(?:million|m)/i);
  const founderInSnippet = snippet.match(/(?:founded by|co-founded by|founder|ceo:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i);
  const locationInSnippet = snippet.match(/(?:based in|headquartered in)\s+([A-Za-z\s,]+)/i);

  const domainName = domain.split('.')[0];
  const capitalizedName = domainName.charAt(0).toUpperCase() + domainName.slice(1);

  return {
    name: capitalizedName,
    description: snippet.slice(0, 300),
    industry: 'Tech Platform',
    fundingOrRevenueText: fundingInSnippet ? fundingInSnippet[0] : null,
    usPresenceEvidence: locationInSnippet ? locationInSnippet[0] : null,
    founderOrCeoName: founderInSnippet ? founderInSnippet[1] : null,
  };
}

/**
 * Extract company data from a candidate URL
 * First tries Anthropic if key is valid; on any failure, falls back to deterministic metadata extraction.
 */
export async function extractCompanyData(candidate: CandidateUrl): Promise<ExtractedCompanyData | null> {
  const pageData = await fetchPageText(candidate.url);
  const pageText = pageData?.text || '';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasValidAnthropicKey = apiKey && !apiKey.includes('your_') && apiKey.startsWith('sk-ant-');

  if (hasValidAnthropicKey && pageText.length >= 200) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Source URL: ${candidate.url}\n\nSnippet: ${candidate.snippet}\n\nPage Text:\n${pageText.slice(0, 10000)}`,
          },
        ],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsed = parseLLMResponse(responseText);
      if (parsed && parsed.name) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Anthropic extraction failed for ${candidate.url} (falling back to structured extractor):`, err);
    }
  }

  // Resilient fallback extraction
  return extractStructuredDataFallback(candidate, pageData);
}

function parseLLMResponse(response: string): ExtractedCompanyData | null {
  try {
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(cleaned) as ExtractedCompanyData;
  } catch {
    return null;
  }
}

/**
 * Extract multiple candidates in parallel with concurrency limit
 */
export async function extractAllCandidates(
  candidates: CandidateUrl[],
  concurrency: number = 5
): Promise<Map<string, ExtractedCompanyData>> {
  const results = new Map<string, ExtractedCompanyData>();
  const queue = [...candidates];
  
  async function worker() {
    while (queue.length > 0) {
      const candidate = queue.shift()!;
      try {
        const data = await extractCompanyData(candidate);
        if (data) {
          results.set(candidate.url, data);
        }
      } catch (err) {
        console.warn(`Extraction error for ${candidate.url}:`, err);
      }
    }
  }
  
  const workers = Array(Math.min(concurrency, Math.max(1, candidates.length)))
    .fill(null)
    .map(() => worker());
  
  await Promise.all(workers);
  return results;
}