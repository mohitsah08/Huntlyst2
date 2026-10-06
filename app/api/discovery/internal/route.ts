/**
 * API Route: /api/discovery/internal
 * 
 * Internal Discovery Pipeline Stage:
 * 
 * STRICT ARCHITECTURAL RULES:
 * 1. INTERNAL MUST NOT PERFORM ONLINE RESEARCH.
 *    The uploaded file is the ONLY source of truth.
 *    No Google, DuckDuckGo, SerpAPI, website scraping, crawlers, web intelligence,
 *    live funding lookups, live founder lookups, or live DNS/MX enrichment.
 * 2. AGENT 1 (FileIntakeAuditor):
 *    - Reads the entire file, all rows, columns, sheets (XLSX), pages (PDF).
 *    - Preserves all original values in seed_data.raw_fields untouched.
 *    - Normalizes into separate normalized fields.
 *    - Audits placeholders, blanks, malformed fields, duplicates.
 *    - Generates Lead Packages.
 * 3. INTERNAL QUALIFICATION:
 *    - Evaluates each Lead Package against active Target Profile using ONLY internal data.
 *    - EXACTLY FOUR FINAL STATUSES: VERIFIED | REVIEW | UNVERIFIED | REJECTED.
 *    - Errors normalize to UNVERIFIED with error audit.
 * 4. UNIFIED LEAD STORE:
 *    - Saves/merges into canonical unified lead store with origin INTERNAL.
 *    - Full status history and audit trail tracking.
 * 5. Supports real-time progress streaming via SSE and standard JSON response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditAndBuildLeadPackages } from '@/lib/agents/fileIntakeAuditor';
import { evaluateInternalLeadPackage } from '@/lib/internalQualification';
import { unifiedLeadStore } from '@/lib/unifiedLeadStore';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';
import { CompanyVerificationResult } from '@/providers/types';
import { LeadPackage, FinalLeadStatus } from '@/lib/leadPackage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

function formatPackageToVerificationResult(
  pkg: LeadPackage,
  evalResult: ReturnType<typeof evaluateInternalLeadPackage>,
  unifiedLeadId: string
): CompanyVerificationResult {
  const norm = pkg.seed_data.normalized;
  const now = new Date().toISOString();

  // Map criteria to CriterionEvaluation format
  const critEval: any = {};
  for (const [k, v] of Object.entries(evalResult.qualification.criteria)) {
    critEval[k] = {
      status: v.status === 'PASS' ? 'PASS' : v.status === 'FAIL' ? 'FAIL' : v.status === 'CONTRADICTED' ? 'CONTRADICTED' : 'UNKNOWN',
      value: v.actualValue || 'Unverified',
      target: v.requiredValue || k,
      reason: v.reason,
      evidence: v.evidence || `Internal file row #${pkg.source.row_number}`,
      timestamp: now,
    };
  }

  // Ensure standard criteria keys exist
  const standardKeys = ['funding', 'industry', 'companyAge', 'geography', 'companyStage', 'founderOrCeo', 'professionalEmail', 'linkedinProfile'];
  for (const sk of standardKeys) {
    if (!critEval[sk]) {
      critEval[sk] = {
        status: 'UNKNOWN',
        value: 'Not evaluated',
        target: sk,
        reason: 'Not required or not evaluated in internal mode',
        timestamp: now,
      };
    }
  }

  return {
    company: {
      name: norm.company_name,
      website: norm.website || '',
      description: norm.description || null,
      industry: norm.industry || 'Unknown',
      fundingOrRevenue: norm.funding || null,
      fundingAmount: norm.funding_amount_usd || norm.funding || null,
      fundingDate: norm.funding_date || null,
      fundingType: norm.funding_type || null,
      founderOrCeoName: norm.founder_or_ceo || null,
      founderOrCeoEmail: norm.company_email || norm.ceo_email || null,
      emailVerified: false, // Internal file verification only, no live SMTP
      confidenceScore: evalResult.qualification.match_score,
      huntScore: evalResult.qualification.match_score,
      sourceType: `Internal File: ${pkg.source.file_name}`,
      statusTag: 'NEW',
      country: norm.country || undefined,
      location: norm.location || undefined,
      linkedinUrl: norm.ceo_linkedin || undefined,
      companyLinkedinUrl: norm.company_linkedin || undefined,
      firstDiscoveredAt: now,
      lastVerifiedAt: now,
    },
    verificationStatus: evalResult.finalStatus as any,
    criteria: critEval,
    rejectionReason: evalResult.rejectionReason,
    qualificationReason: evalResult.finalStatus === 'VERIFIED' ? evalResult.verdictReason : undefined,
    decisionExplanation: evalResult.verdictReason,
    failedCriteria: evalResult.qualification.failedCriteria,
    passedCriteria: evalResult.qualification.passedCriteria,
    unknownCriteria: evalResult.qualification.missingCriteria,
    sources: [`Internal File: ${pkg.source.file_name} (Row ${pkg.source.row_number}${pkg.source.sheet_name ? `, Sheet: ${pkg.source.sheet_name}` : ''})`],
    auditTimestamp: now,
    source_data: {
      name: norm.company_name,
      website: norm.website,
      raw_industry: norm.industry,
      address: norm.location || null,
      city: norm.city || null,
      state: norm.state || null,
      country: norm.country || null,
      phone: null,
      email: norm.company_email || norm.ceo_email || null,
      founder: norm.founder_or_ceo || null,
      funding: norm.funding || null,
      raw_fields: { ...pkg.seed_data.raw_fields },
    },
    lead_package: pkg,
    unified_lead_id: unifiedLeadId,
    origins: ['INTERNAL'],
    originDisplay: 'INTERNAL',
    statusHistory: [
      {
        status: evalResult.finalStatus,
        source: 'INTERNAL_AUTO',
        timestamp: now,
        reason: evalResult.verdictReason,
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const isStream = request.nextUrl.searchParams.get('stream') === 'true' ||
      request.headers.get('accept')?.includes('text/event-stream');

    const contentType = request.headers.get('content-type') || '';
    let fileBuffer: Buffer | null = null;
    let fileName = 'manual-input.txt';
    let targetProfile: TargetProfile = DEFAULT_TVB_TARGET_PROFILE;

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
        fileBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      const body = await request.json();
      if (body.targetProfile) {
        targetProfile = body.targetProfile;
      }
      if (body.rawText) {
        fileBuffer = Buffer.from(body.rawText, 'utf-8');
        fileName = 'pasted-text.txt';
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid file or text content was provided for internal intake.',
        results: [],
        stats: { totalReceived: 0, totalProcessed: 0, verified: 0, review: 0, unverified: 0, rejected: 0 },
      }, { status: 400 });
    }

    // STAGE 1: Full file intake & audit by Agent 1 (NO WEB)
    const auditResult = await auditAndBuildLeadPackages(fileBuffer, fileName);
    const packages = auditResult.packages;
    const totalReceived = packages.length;

    if (totalReceived === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid company leads could be extracted from the uploaded document.',
        results: [],
        stats: { totalReceived: 0, totalProcessed: 0, verified: 0, review: 0, unverified: 0, rejected: 0 },
      }, { status: 400 });
    }

    // Process all lead packages with internal qualification (ZERO WEB)
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
            auditSummary: auditResult.globalAuditSummary,
            message: `Agent 1 completed full intake of ${totalReceived} records (${auditResult.totalRowsRead} rows read). Starting internal profile evaluation...`,
          });

          for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            const evalResult = evaluateInternalLeadPackage(pkg, targetProfile);
            const unifiedLead = unifiedLeadStore.upsertLeadFromInternal(pkg, evalResult);
            const res = formatPackageToVerificationResult(pkg, evalResult, unifiedLead.id);

            allResults.push(res);
            processedCount++;

            const currentStats = {
              totalReceived,
              totalProcessed: processedCount,
              verified: allResults.filter(r => r.verificationStatus === 'VERIFIED').length,
              review: allResults.filter(r => r.verificationStatus === 'REVIEW').length,
              unverified: allResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
              rejected: allResults.filter(r => r.verificationStatus === 'REJECTED').length,
              // Compatibility aliases
              qualified: allResults.filter(r => r.verificationStatus === 'VERIFIED').length,
              errors: 0,
            };

            await sendEvent({
              type: 'progress',
              current: processedCount,
              total: totalReceived,
              candidate: res,
              result: res,
              stats: currentStats,
              message: `Evaluated ${res.company.name} [${evalResult.finalStatus}] (${processedCount} / ${totalReceived})`,
            });
          }

          const finalStats = {
            totalReceived,
            totalProcessed: allResults.length,
            verified: allResults.filter(r => r.verificationStatus === 'VERIFIED').length,
            review: allResults.filter(r => r.verificationStatus === 'REVIEW').length,
            unverified: allResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
            rejected: allResults.filter(r => r.verificationStatus === 'REJECTED').length,
            qualified: allResults.filter(r => r.verificationStatus === 'VERIFIED').length,
            errors: 0,
          };

          await sendEvent({
            type: 'complete',
            fileName,
            totalReceived,
            totalProcessed: allResults.length,
            results: allResults,
            stats: finalStats,
            auditSummary: auditResult.globalAuditSummary,
            message: `Internal processing complete: ${allResults.length} records evaluated into 4 final statuses.`,
          });
        } catch (streamErr: any) {
          await sendEvent({
            type: 'error',
            message: streamErr.message || 'Internal evaluation stream error',
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

    // Standard JSON Response (ZERO WEB)
    const verificationResults: CompanyVerificationResult[] = [];
    for (const pkg of packages) {
      const evalResult = evaluateInternalLeadPackage(pkg, targetProfile);
      const unifiedLead = unifiedLeadStore.upsertLeadFromInternal(pkg, evalResult);
      const res = formatPackageToVerificationResult(pkg, evalResult, unifiedLead.id);
      verificationResults.push(res);
    }

    const stats = {
      totalReceived,
      totalProcessed: verificationResults.length,
      verified: verificationResults.filter(r => r.verificationStatus === 'VERIFIED').length,
      review: verificationResults.filter(r => r.verificationStatus === 'REVIEW').length,
      unverified: verificationResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
      rejected: verificationResults.filter(r => r.verificationStatus === 'REJECTED').length,
      qualified: verificationResults.filter(r => r.verificationStatus === 'VERIFIED').length,
      errors: 0,
    };

    return NextResponse.json({
      success: true,
      fileName,
      totalReceived,
      totalProcessed: verificationResults.length,
      results: verificationResults,
      stats,
      auditSummary: auditResult.globalAuditSummary,
    });
  } catch (err: any) {
    console.error('[API Internal Discovery] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to process internal discovery file',
    }, { status: 500 });
  }
}
