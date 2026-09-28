/**
 * API Route: /api/discovery/retry
 * 
 * Re-runs ONLY the specified stage for an individual candidate,
 * preserving all other completed stage states and evidence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { retryCandidateStage } from '@/lib/discoveryPipeline';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';
import { CompanyVerificationResult, PipelineStageName } from '@/providers/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const candidateResult: CompanyVerificationResult = body.candidateResult;
    const stageToRetry: PipelineStageName = body.stage || 'FIND_FOUNDERS';
    const targetProfile: TargetProfile = body.targetProfile || DEFAULT_TVB_TARGET_PROFILE;

    if (!candidateResult || !candidateResult.company) {
      return NextResponse.json({
        success: false,
        error: 'Missing candidate result payload',
      }, { status: 400 });
    }

    const updated = await retryCandidateStage(candidateResult, stageToRetry, targetProfile);

    return NextResponse.json({
      success: true,
      result: updated,
      stage: stageToRetry,
    });
  } catch (err: any) {
    console.error('[API Discovery Retry] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Stage retry failed',
    }, { status: 500 });
  }
}
