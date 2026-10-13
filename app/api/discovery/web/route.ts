/**
 * API Route: /api/discovery/web
 * 
 * Stage 3: Huntlyst Web Discovery
 * Powered by the unified shared DiscoveryEngine:
 * Query Planner (8 Strategies) -> Houston Discovery -> Deduplication & Global Memory ->
 * Stagnation Guard -> Houston Research & Qualification -> Houston Enrichment -> Houston Verification.
 * 
 * Reuses the exact same discovery engine as Autonomous One-Click Hunt.
 * Supports both:
 * 1. SSE Stream: text/event-stream (?stream=true) for real-time telemetry, logs, and incremental candidate arrival
 * 2. Standard JSON Response: for deterministic batch callers and quality checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';
import {
  DiscoveryEngine,
  companyRecordToVerificationResult,
  rejectedCompanyToVerificationResult,
} from '@/lib/orchestration/discoveryEngine';
import { unifiedLeadStore } from '@/lib/unifiedLeadStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const isStream =
    request.nextUrl.searchParams.get('stream') === 'true' ||
    request.headers.get('accept')?.includes('text/event-stream');

  let targetProfile: TargetProfile = DEFAULT_TVB_TARGET_PROFILE;
  let requestedCount = 15;
  let excludeDomains: string[] = [];
  let clientHuntId: string | null = null;

  try {
    const body = await request.json().catch(() => null);
    if (body) {
      if (body.huntId) clientHuntId = body.huntId;
      if (body.targetProfile) {
        targetProfile = body.targetProfile as TargetProfile;
      }
      if (typeof body.targetCount === 'number') {
        requestedCount = body.targetCount;
      } else if (typeof targetProfile.targetCount === 'number') {
        requestedCount = targetProfile.targetCount;
      } else if (targetProfile.customTargetCount) {
        requestedCount = targetProfile.customTargetCount;
      }
      if (Array.isArray(body.excludeDomains)) {
        excludeDomains = body.excludeDomains;
      }
    }
  } catch {}

  const huntId =
    clientHuntId || `hunt_web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  console.log(`[API START]\nendpoint: /api/discovery/web\nhuntId: ${huntId}\nstream: ${isStream}`);

  if (isStream) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (data: any) => {
      try {
        const payload = `data: ${JSON.stringify({ ...data, huntId })}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch {}
    };

    (async () => {
      try {
        const engineResult = await DiscoveryEngine.execute(targetProfile, {
          sessionId: huntId,
          targetCount: requestedCount,
          excludeDomains,
          onEvent: async (event) => {
            if (event.type === 'company_qualified' && event.company) {
              const vr = companyRecordToVerificationResult(event.company, targetProfile);
              try {
                unifiedLeadStore.upsertLeadFromExternal(vr);
              } catch {}
              await sendEvent({
                ...event,
                verificationResult: vr,
              });
            } else {
              await sendEvent(event);
            }
          },
        });

        const verificationResults = engineResult.qualifiedCompanies.map((c) =>
          companyRecordToVerificationResult(c, targetProfile)
        );
        const rejectedResults = engineResult.rejectedCompanies.map((r) =>
          rejectedCompanyToVerificationResult(r, targetProfile)
        );

        for (const vr of verificationResults) {
          try {
            unifiedLeadStore.upsertLeadFromExternal(vr);
          } catch {}
        }

        const stats = {
          total: engineResult.totalDiscovered,
          qualified: engineResult.totalQualified,
          rejected: engineResult.totalRejected,
          partiallyVerified: verificationResults.filter((r) => r.verificationStatus === 'PARTIALLY_VERIFIED')
            .length,
          unverified: verificationResults.filter((r) => r.verificationStatus === 'UNVERIFIED').length,
        };

        await sendEvent({
          type: 'complete',
          stage: 7,
          stageName: 'Results',
          huntId,
          message: `Web discovery complete: ${engineResult.totalQualified} candidate companies verified.`,
          results: verificationResults,
          rejectedResults,
          stats,
          totalDiscovered: engineResult.totalDiscovered,
        });

        console.log(`[API COMPLETE]\nendpoint: /api/discovery/web\nhuntId: ${huntId}`);
      } catch (err: any) {
        console.error(`[API ERROR]\nendpoint: /api/discovery/web\nhuntId: ${huntId}\nerror:`, err);
        await sendEvent({
          type: 'error',
          huntId,
          message: err.message || 'Web discovery execution failed',
        });
      } finally {
        await writer.close();
      }
    })();

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // Standard JSON response
  try {
    const engineResult = await DiscoveryEngine.execute(targetProfile, {
      sessionId: huntId,
      targetCount: requestedCount,
      excludeDomains,
    });

    const verificationResults = engineResult.qualifiedCompanies.map((c) =>
      companyRecordToVerificationResult(c, targetProfile)
    );
    const rejectedResults = engineResult.rejectedCompanies.map((r) =>
      rejectedCompanyToVerificationResult(r, targetProfile)
    );

    for (const vr of verificationResults) {
      try {
        unifiedLeadStore.upsertLeadFromExternal(vr);
      } catch {}
    }

    const stats = {
      total: engineResult.totalDiscovered,
      qualified: engineResult.totalQualified,
      rejected: engineResult.totalRejected,
      partiallyVerified: verificationResults.filter((r) => r.verificationStatus === 'PARTIALLY_VERIFIED').length,
      unverified: verificationResults.filter((r) => r.verificationStatus === 'UNVERIFIED').length,
    };

    console.log(`[API COMPLETE]\nendpoint: /api/discovery/web\nhuntId: ${huntId}`);
    return NextResponse.json({
      success: true,
      totalDiscovered: engineResult.totalDiscovered,
      results: verificationResults,
      rejectedResults,
      stats,
      durationMs: engineResult.durationMs,
    });
  } catch (err: any) {
    console.error(`[API ERROR]\nendpoint: /api/discovery/web\nhuntId: ${huntId}\nerror:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Web discovery execution failed',
      },
      { status: 500 }
    );
  }
}
