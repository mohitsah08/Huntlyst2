/**
 * API Route: /api/discovery/internal
 * 
 * Rebuilt Internal Discovery Pipeline Stage:
 * 1. Accepts candidate list from file upload (CSV, XLSX, PDF, DOCX, TXT, JSON) or direct text
 * 2. Parses and preserves all pre-existing evidence from previous Huntlyst exports
 * 3. Processes ALL supplied candidates without artificial limits (40, 100+, etc.)
 * 4. Executes deterministic 6-stage candidate state machine:
 *    DISCOVER → RESEARCH → VALIDATE → FIND FOUNDERS → VERIFY CONTACT → QUALIFY
 * 5. Resilient error handling: if one candidate fails, marks ERROR and continues processing
 * 6. Supports real-time progress streaming via SSE and standard JSON response
 * 7. Returns exact candidate accounting: totalReceived = totalProcessed
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseCandidateFile, parseTxt, parseRawTextContent } from '@/lib/fileParser';
import { processCandidateThroughPipeline } from '@/lib/discoveryPipeline';
import { CompanyVerificationResult, ResearchCandidateInput, PipelineStageName } from '@/providers/types';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

function createErrorCandidateResult(cand: ResearchCandidateInput, errorMsg: string): CompanyVerificationResult {
  const fallbackName = cand.name || (cand.website ? cand.website.replace(/^https?:\/\//, '').split('/')[0] : 'Unknown Entity');
  const now = new Date().toISOString();

  const emptyCrit = { status: 'UNKNOWN' as const, value: 'Unverified', reason: errorMsg, timestamp: now };
  return {
    company: {
      name: fallbackName,
      website: cand.website || cand.url || '',
      description: cand.rawText || null,
      industry: 'Unknown',
      fundingOrRevenue: null,
      usPresence: null,
      founderOrCeoName: null,
      founderOrCeoEmail: null,
      emailVerified: false,
      confidenceScore: 0,
      sourceType: cand.source || 'Internal File',
      statusTag: 'NEW',
      firstDiscoveredAt: now,
      lastVerifiedAt: now,
    },
    verificationStatus: 'ERROR',
    criteria: {
      funding: { ...emptyCrit, target: 'Funding Target' },
      industry: { ...emptyCrit, target: 'Industry Target' },
      companyAge: { ...emptyCrit, target: 'Age Target' },
      geography: { ...emptyCrit, target: 'Geography Target' },
      usPresence: { ...emptyCrit, target: 'US Presence Policy' },
      companyStage: { ...emptyCrit, target: 'Stage Target' },
      founderOrCeo: { ...emptyCrit, target: 'CEO / Co-founder' },
      professionalEmail: { ...emptyCrit, target: 'Verified Email' },
      linkedinProfile: { ...emptyCrit, target: 'Public Profile' },
    },
    rejectionReason: `Processing error: ${errorMsg}`,
    decisionExplanation: `ERROR: ${errorMsg}`,
    failedCriteria: ['Processing Error'],
    passedCriteria: [],
    unknownCriteria: ['Funding', 'Industry', 'Geography', 'US Presence', 'CEO/Founder', 'Professional Email'],
    sources: [cand.website || cand.url || 'Internal Document'],
    auditTimestamp: now,
    errorMessage: errorMsg,
    stages: {
      DISCOVER: { stage: 'DISCOVER', status: 'completed', attempts: 1 },
      RESEARCH: { stage: 'RESEARCH', status: 'failed', error: errorMsg, attempts: 1 },
      VALIDATE: { stage: 'VALIDATE', status: 'skipped', attempts: 0 },
      FIND_FOUNDERS: { stage: 'FIND_FOUNDERS', status: 'skipped', attempts: 0 },
      VERIFY_CONTACT: { stage: 'VERIFY_CONTACT', status: 'skipped', attempts: 0 },
      QUALIFY: { stage: 'QUALIFY', status: 'failed', error: errorMsg, attempts: 1 },
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const isStream = request.nextUrl.searchParams.get('stream') === 'true' ||
      request.headers.get('accept')?.includes('text/event-stream');

    const contentType = request.headers.get('content-type') || '';
    let candidatesToResearch: ResearchCandidateInput[] = [];
    let targetProfile: TargetProfile = DEFAULT_TVB_TARGET_PROFILE;
    let fileName = 'manual-input';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const targetJson = formData.get('targetProfile') as string | null;

      if (targetJson) {
        try {
          targetProfile = JSON.parse(targetJson);
        } catch {}
      }

      if (file) {
        fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parsed = await parseCandidateFile(buffer, file.name);
        candidatesToResearch = parsed.candidates;
      }
    } else {
      const body = await request.json();
      if (body.targetProfile) {
        targetProfile = body.targetProfile;
      }
      if (body.candidates && Array.isArray(body.candidates)) {
        candidatesToResearch = body.candidates;
      } else if (body.rawText) {
        const parsed = parseRawTextContent(body.rawText, 'pasted-text');
        candidatesToResearch = parsed.candidates;
      }
    }

    const totalReceived = candidatesToResearch.length;

    if (totalReceived === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid candidate companies or URLs were found in the uploaded data.',
        results: [],
        stats: { totalReceived: 0, totalProcessed: 0, qualified: 0, rejected: 0, partiallyVerified: 0, unverified: 0, errors: 0 },
      }, { status: 400 });
    }

    // Process ALL candidates in manageable batches without artificial ceiling
    const BATCH_SIZE = 8;
    const CONCURRENCY = 3;

    if (isStream) {
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const sendEvent = async (data: any) => {
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          await writer.write(encoder.encode(payload));
        } catch {}
      };

      (async () => {
        const allResults: CompanyVerificationResult[] = [];
        let processedCount = 0;

        try {
          await sendEvent({
            type: 'start',
            fileName,
            totalReceived,
            message: `Received ${totalReceived} candidates. Starting deterministic 6-stage verification...`,
          });

          for (let b = 0; b < totalReceived; b += BATCH_SIZE) {
            const batch = candidatesToResearch.slice(b, b + BATCH_SIZE);

            for (let i = 0; i < batch.length; i += CONCURRENCY) {
              const chunk = batch.slice(i, i + CONCURRENCY);
              const chunkPromises = chunk.map(async (cand) => {
                try {
                  return await processCandidateThroughPipeline(cand, targetProfile);
                } catch (candErr: any) {
                  return createErrorCandidateResult(cand, candErr.message || 'Pipeline execution failed');
                }
              });

              const chunkResults = await Promise.all(chunkPromises);

              for (const res of chunkResults) {
                allResults.push(res);
                processedCount++;

                const currentStats = {
                  totalReceived,
                  totalProcessed: processedCount,
                  qualified: allResults.filter(r => r.verificationStatus === 'QUALIFIED').length,
                  rejected: allResults.filter(r => r.verificationStatus === 'REJECTED').length,
                  review: allResults.filter(r => r.verificationStatus === 'REVIEW').length,
                  partiallyVerified: allResults.filter(r => r.verificationStatus === 'PARTIALLY_VERIFIED').length,
                  unverified: allResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
                  errors: allResults.filter(r => r.verificationStatus === 'ERROR').length,
                };

                await sendEvent({
                  type: 'progress',
                  current: processedCount,
                  total: totalReceived,
                  candidate: res,
                  result: res,
                  stats: currentStats,
                  message: `Verified ${res.company.name} (${processedCount} / ${totalReceived})`,
                });
              }
            }
          }

          const finalStats = {
            totalReceived,
            totalProcessed: allResults.length,
            qualified: allResults.filter(r => r.verificationStatus === 'QUALIFIED').length,
            rejected: allResults.filter(r => r.verificationStatus === 'REJECTED').length,
            review: allResults.filter(r => r.verificationStatus === 'REVIEW').length,
            partiallyVerified: allResults.filter(r => r.verificationStatus === 'PARTIALLY_VERIFIED').length,
            unverified: allResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
            errors: allResults.filter(r => r.verificationStatus === 'ERROR').length,
          };

          await sendEvent({
            type: 'complete',
            fileName,
            totalReceived,
            totalProcessed: allResults.length,
            results: allResults,
            stats: finalStats,
            message: `${allResults.length} / ${totalReceived} candidates fully processed`,
          });
        } catch (streamErr: any) {
          await sendEvent({
            type: 'error',
            message: streamErr.message || 'Internal discovery stream failed',
          });
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

    // Standard JSON response: Process ALL candidates
    const verificationResults: CompanyVerificationResult[] = [];

    for (let b = 0; b < totalReceived; b += BATCH_SIZE) {
      const batch = candidatesToResearch.slice(b, b + BATCH_SIZE);

      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const chunk = batch.slice(i, i + CONCURRENCY);
        const chunkPromises = chunk.map(async (cand) => {
          try {
            return await processCandidateThroughPipeline(cand, targetProfile);
          } catch (candErr: any) {
            return createErrorCandidateResult(cand, candErr.message || 'Verification failed');
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        verificationResults.push(...chunkResults);
      }
    }

    const stats = {
      totalReceived,
      totalProcessed: verificationResults.length,
      qualified: verificationResults.filter(r => r.verificationStatus === 'QUALIFIED').length,
      rejected: verificationResults.filter(r => r.verificationStatus === 'REJECTED').length,
      review: verificationResults.filter(r => r.verificationStatus === 'REVIEW').length,
      partiallyVerified: verificationResults.filter(r => r.verificationStatus === 'PARTIALLY_VERIFIED').length,
      unverified: verificationResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
      errors: verificationResults.filter(r => r.verificationStatus === 'ERROR').length,
    };

    return NextResponse.json({
      success: true,
      fileName,
      totalReceived,
      totalProcessed: verificationResults.length,
      results: verificationResults,
      stats,
    });
  } catch (err: any) {
    console.error('[API Internal Discovery] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to process internal discovery candidates',
    }, { status: 500 });
  }
}
