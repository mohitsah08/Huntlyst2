/**
 * API Route: /api/discovery/external
 * 
 * Rebuilt External Discovery Pipeline Stage:
 * 1. Accepts company names, websites, or company URLs from user input
 * 2. Processes ALL supplied companies without arbitrary caps
 * 3. Runs deterministic 6-stage pipeline:
 *    DISCOVER → RESEARCH → VALIDATE → FIND FOUNDERS → VERIFY CONTACT → QUALIFY
 * 4. Extracts independent executives, professional emails, MX records, and field evidence
 * 5. Returns detailed intelligence dossier for user approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCandidateThroughPipeline } from '@/lib/discoveryPipeline';
import { CompanyVerificationResult, ResearchCandidateInput } from '@/providers/types';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetProfile: TargetProfile = body.targetProfile || DEFAULT_TVB_TARGET_PROFILE;
    const candidatesInput: ResearchCandidateInput[] = [];

    if (Array.isArray(body.companies)) {
      for (const item of body.companies) {
        if (typeof item === 'string') {
          const isUrl = item.startsWith('http') || item.includes('.');
          candidatesInput.push({
            name: isUrl ? undefined : item,
            website: isUrl ? item : undefined,
            url: isUrl ? item : undefined,
            source: 'External Target Entry',
          });
        } else if (typeof item === 'object' && item !== null) {
          candidatesInput.push({
            name: item.name,
            website: item.website || item.url,
            url: item.url || item.website,
            source: item.source || 'External Target Entry',
          });
        }
      }
    } else if (body.name || body.website || body.url) {
      candidatesInput.push({
        name: body.name,
        website: body.website || body.url,
        url: body.url || body.website,
        source: 'External Target Entry',
      });
    }

    if (candidatesInput.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Please provide at least one company name or website URL.',
        results: [],
        stats: { total: 0, qualified: 0, rejected: 0, partiallyVerified: 0, unverified: 0 },
      }, { status: 400 });
    }

    const verificationResults: CompanyVerificationResult[] = [];
    const concurrency = 3;

    for (let i = 0; i < candidatesInput.length; i += concurrency) {
      const chunk = candidatesInput.slice(i, i + concurrency);
      const chunkPromises = chunk.map(cand => processCandidateThroughPipeline(cand, targetProfile));
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
      totalRequested: candidatesInput.length,
      results: verificationResults,
      stats,
    });
  } catch (err: any) {
    console.error('[API External Discovery] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to research external candidate companies',
    }, { status: 500 });
  }
}
