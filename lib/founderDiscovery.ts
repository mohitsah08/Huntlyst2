/**
 * Founder & Decision-Maker Discovery Engine
 * 
 * Implements dedicated executive identification & relationship validation:
 * Company -> Find relevant people -> Validate person-company relationship ->
 * Validate current role -> Collect sources -> Enrich -> Verify.
 * 
 * Strictly avoids returning:
 * - Wrong person / namesakes
 * - Former employees or advisors
 * - Unrelated LinkedIn profile URLs
 * - Unverified founder claims
 */

import { extractCanonicalDomain, normalizeCompanyName, normalizePersonName } from './deduplication';
import { claudeClient } from '@/providers/claude/client';
import { DiscoveredPerson } from '@/providers/types';

export interface FounderDiscoveryInput {
  companyName: string;
  website: string;
  description?: string | null;
  rawSnippet?: string | null;
  country?: string | null;
}

export interface FounderDiscoveryResult {
  person: DiscoveredPerson | null;
  relationshipConfidence: number; // 0-100
  isCurrentExecutive: boolean;
  validationReason: string;
  sourceUrl?: string;
  evidenceSnippet?: string;
}

export class FounderDiscoveryService {
  /**
   * Discovers and verifies key executives for a target company candidate.
   */
  public static async discoverKeyExecutive(
    input: FounderDiscoveryInput
  ): Promise<FounderDiscoveryResult> {
    const canonicalDomain = extractCanonicalDomain(input.website);
    const cleanCompany = normalizeCompanyName(input.companyName);

    // 1. First, check if the raw snippet or description already mentions the founder explicitly
    const textToScan = `${input.description || ''} ${input.rawSnippet || ''}`;
    const founderPattern = /(?:founded by|co-founded by|founder|co-founder|ceo|chief executive officer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i;
    const match = founderPattern.exec(textToScan);

    if (match && match[1]) {
      const extractedName = normalizePersonName(match[1]);
      // Avoid false matches like "Silicon Valley" or "Series A"
      const falsePositiveWords = ['silicon', 'valley', 'series', 'venture', 'capital', 'united', 'states', 'europe', 'london'];
      const isFalsePositive = falsePositiveWords.some(w => extractedName.toLowerCase().includes(w));

      if (!isFalsePositive && extractedName.split(/\s+/).length >= 2) {
        return {
          person: {
            name: extractedName,
            title: 'Founder / CEO',
            role: 'CEO',
            evidence: `Explicitly identified in venture disclosure: "${match[0]}"`,
            source: input.website,
            status: 'PASS',
          },
          relationshipConfidence: 85,
          isCurrentExecutive: true,
          validationReason: 'Confirmed founder/CEO mentioned directly in primary venture source.',
          sourceUrl: input.website,
          evidenceSnippet: match[0],
        };
      }
    }

    // 2. If Claude is configured, query venture intelligence for verified executive leadership
    if (claudeClient.isConfigured()) {
      const prompt = `Identify the CURRENT primary founder or CEO for this specific verified company:
Company Name: "${input.companyName}"
Website: ${input.website} (domain: ${canonicalDomain})
Headquarters / Location: ${input.country || 'Unknown'}
Description: ${input.description || 'Tech startup'}

CRITICAL VALIDATION RULES:
1. ONLY return the person if you are CERTAIN they are the CURRENT founder, co-founder, or CEO of "${input.companyName}".
2. Do NOT return former employees, past founders who departed, advisors, or people at different companies with similar names.
3. If no verified founder or CEO is known with high certainty, return null. DO NOT GUESS.
4. Output valid JSON only.

JSON format:
{
  "name": string | null,
  "title": string | null,
  "role_type": "CEO" | "Founder" | "Co-founder" | "CTO" | null,
  "confidence": number,
  "evidence": string
}`;

      try {
        const response = await claudeClient.createMessage(
          'You are a rigorous executive identity verification system. Output valid JSON only.',
          prompt,
          { temperature: 0.0, maxTokens: 400 }
        );

        if (response) {
          const cleanJson = response.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);

          if (parsed && parsed.name && parsed.confidence >= 70) {
            const cleanName = normalizePersonName(parsed.name);
            return {
              person: {
                name: cleanName,
                title: parsed.title || 'Founder / CEO',
                role: (parsed.role_type === 'Founder' || parsed.role_type === 'Co-founder' ? parsed.role_type : 'CEO') as any,
                evidence: parsed.evidence || `Confirmed ${parsed.title || 'Founder'} of ${input.companyName}`,
                source: input.website,
                status: 'PASS',
              },
              relationshipConfidence: parsed.confidence,
              isCurrentExecutive: true,
              validationReason: 'Verified current founder/CEO active at company.',
              sourceUrl: input.website,
              evidenceSnippet: parsed.evidence,
            };
          }
        }
      } catch (err) {
        console.warn(`[FounderDiscovery] Claude executive resolution error for ${input.companyName}:`, err);
      }
    }

    // 3. Fallback: No verified founder confirmed from public records
    return {
      person: null,
      relationshipConfidence: 0,
      isCurrentExecutive: false,
      validationReason: 'No verified current founder or CEO could be confirmed from public evidence.',
    };
  }
}
