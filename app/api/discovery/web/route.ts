/**
 * API Route: /api/discovery/web
 * 
 * Rebuilt Web Search Discovery Stage:
 * 1. Uses Claude Web Search provider to discover candidate companies based on target profile
 * 2. Zero fabrication: returns only real, verifiable leads
 * 3. Runs deterministic 6-stage pipeline:
 *    DISCOVER → RESEARCH → VALIDATE → FIND FOUNDERS → VERIFY CONTACT → QUALIFY
 * 4. Returns verified candidate results for approval gate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResearchProvider } from '@/providers';
import { processCandidateThroughPipeline } from '@/lib/discoveryPipeline';
import { CompanyVerificationResult } from '@/providers/types';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetProfile: TargetProfile = body.targetProfile || DEFAULT_TVB_TARGET_PROFILE;
    const requestedCount = typeof targetProfile.targetCount === 'number'
      ? targetProfile.targetCount
      : (targetProfile.customTargetCount || 15);

    const excludeDomains: string[] = Array.isArray(body.excludeDomains) ? body.excludeDomains : [];

    const provider = getResearchProvider('claude');

    // 1. Search candidates via search provider
    const searchResults = await provider.searchCandidates(targetProfile, requestedCount, excludeDomains);

    if (searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new candidates matching this specific target configuration could be discovered on the public web.',
        results: [],
        stats: { total: 0, qualified: 0, rejected: 0, partiallyVerified: 0, unverified: 0 },
      });
    }

    // 2. Perform deep deterministic 6-stage candidate research and verification
    const verificationResults: CompanyVerificationResult[] = [];
    const concurrency = 3;

    for (let i = 0; i < searchResults.length; i += concurrency) {
      const chunk = searchResults.slice(i, i + concurrency);
      const chunkPromises = chunk.map(item =>
        processCandidateThroughPipeline(
          {
            name: item.name,
            website: item.url,
            url: item.url,
            rawText: item.snippet,
            source: item.source || 'Huntlyst Web Discovery',
          },
          targetProfile
        )
      );

      const chunkRes = await Promise.allSettled(chunkPromises);
      for (const res of chunkRes) {
        if (res.status === 'fulfilled') {
          verificationResults.push(res.value);
        }
      }
    }

    const stats = {
      total: verificationResults.length,
      qualified: verificationResults.filter(r => r.verificationStatus === 'QUALIFIED').length,
      rejected: verificationResults.filter(r => r.verificationStatus === 'REJECTED').length,
      partiallyVerified: verificationResults.filter(r => r.verificationStatus === 'PARTIALLY_VERIFIED').length,
      unverified: verificationResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
    };

    return NextResponse.json({
      success: true,
      totalDiscovered: searchResults.length,
      results: verificationResults,
      stats,
    });
  } catch (err: any) {
    console.error('[API Web Discovery] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Web search discovery failed',
    }, { status: 500 });
  }
}
