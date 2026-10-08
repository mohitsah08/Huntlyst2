/**
 * API Route: /api/run-agent
 * 
 * Master lead discovery endpoint powered by Houston agent infrastructure:
 * Query Planner (8 Strategies) -> Houston Discovery -> Deduplication & Memory ->
 * Stagnation Guard -> Houston Research -> Houston Qualification ->
 * Houston Enrichment (Founders) -> Houston Verification (DNS/MX) -> Ranked Leads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RunAgentResult, CompanyRecord, HuntConfig, TVB_EVALUATION_CONFIG } from '@/lib/types';
import { targetProfileToHuntConfig, TargetProfile } from '@/lib/targetProfileData';
import { DiscoveryEngine } from '@/lib/orchestration/discoveryEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  const isStream = request.nextUrl.searchParams.get('stream') === 'true' ||
    request.headers.get('accept')?.includes('text/event-stream');

  let config: HuntConfig = TVB_EVALUATION_CONFIG;
  let clientHuntId = request.nextUrl.searchParams.get('huntId');

  try {
    const body = await request.json().catch(() => null);
    if (body) {
      if (body.huntId) {
        clientHuntId = body.huntId;
      }
      if (body.targetProfile) {
        config = body as HuntConfig;
      } else if (body.targetCount !== undefined || body.industries) {
        config = targetProfileToHuntConfig(body as TargetProfile);
      } else if (body.geography) {
        config = body as HuntConfig;
      }
    }
  } catch {}

  const huntId = clientHuntId || config.id || `hunt_${Date.now().toString(36)}`;
  console.log(`[API START]\nendpoint: /api/run-agent\nhuntId: ${huntId}`);

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
        const engineResult = await DiscoveryEngine.execute(config, {
          sessionId: huntId,
          targetCount: config.targetLeads || 15,
          onEvent: (event) => {
            sendEvent(event);
          },
        });

        const runResult: RunAgentResult = {
          companies: engineResult.qualifiedCompanies,
          rejectedCompanies: engineResult.rejectedCompanies,
          totalDiscovered: engineResult.totalDiscovered,
          totalQualified: engineResult.totalQualified,
          stats: {
            discovered: engineResult.totalDiscovered,
            extracted: engineResult.totalDiscovered,
            nonUsPassed: engineResult.totalQualified,
            fundingQualified: engineResult.totalQualified,
            founderFound: engineResult.qualifiedCompanies.filter(c => Boolean(c.founderOrCeoName)).length,
            contactsChecked: engineResult.qualifiedCompanies.length,
            emailVerified: engineResult.qualifiedCompanies.filter(c => c.emailVerified).length,
            emailsPartiallyVerified: engineResult.qualifiedCompanies.filter(c => c.contactVerificationStatus === 'PARTIALLY VERIFIED').length,
            emailsUnverified: engineResult.qualifiedCompanies.filter(c => c.contactVerificationStatus === 'UNVERIFIED').length,
            finalRanked: engineResult.qualifiedCompanies.length,
            durationMs: engineResult.durationMs,
          },
        };

        await sendEvent({
          type: 'complete',
          stage: 7,
          stageName: 'Results',
          huntId,
          message: `Discovery complete: ${engineResult.totalQualified} qualified leads discovered.`,
          result: runResult,
        });

        console.log(`[API COMPLETE]\nendpoint: /api/run-agent\nhuntId: ${huntId}`);
      } catch (err: any) {
        console.error(`[API ERROR]\nendpoint: /api/run-agent\nhuntId: ${huntId}\nerror:`, err);
        await sendEvent({ type: 'error', huntId, message: err.message || 'Pipeline execution failed' });
      } finally {
        await writer.close();
      }
    })();

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  // Standard JSON response
  try {
    const engineResult = await DiscoveryEngine.execute(config, {
      sessionId: huntId,
      targetCount: config.targetLeads || 15,
    });

    const runResult: RunAgentResult = {
      companies: engineResult.qualifiedCompanies,
      rejectedCompanies: engineResult.rejectedCompanies,
      totalDiscovered: engineResult.totalDiscovered,
      totalQualified: engineResult.totalQualified,
      stats: {
        discovered: engineResult.totalDiscovered,
        extracted: engineResult.totalDiscovered,
        nonUsPassed: engineResult.totalQualified,
        fundingQualified: engineResult.totalQualified,
        founderFound: engineResult.qualifiedCompanies.filter(c => Boolean(c.founderOrCeoName)).length,
        contactsChecked: engineResult.qualifiedCompanies.length,
        emailVerified: engineResult.qualifiedCompanies.filter(c => c.emailVerified).length,
        emailsPartiallyVerified: engineResult.qualifiedCompanies.filter(c => c.contactVerificationStatus === 'PARTIALLY VERIFIED').length,
        emailsUnverified: engineResult.qualifiedCompanies.filter(c => c.contactVerificationStatus === 'UNVERIFIED').length,
        finalRanked: engineResult.qualifiedCompanies.length,
        durationMs: engineResult.durationMs,
      },
    };

    console.log(`[API COMPLETE]\nendpoint: /api/run-agent\nhuntId: ${huntId}`);
    return NextResponse.json(runResult);
  } catch (error: any) {
    console.error(`[API ERROR]\nendpoint: /api/run-agent\nhuntId: ${huntId}\nerror:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}