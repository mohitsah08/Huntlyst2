/**
 * Test Suite: Internal Workflow & Growth List Acceptance Test
 * Verifies Requirements 2, 3, 4, 5, 23, 24:
 * 1. Internal performs ZERO online web research (Network Independence)
 * 2. Full file reading without 25 or 40 row ceiling (all rows represented)
 * 3. Raw fields 100% preserved in seed_data.raw_fields
 * 4. Placeholders detected ("UPGRADE TO UNLOCK", etc.)
 * 5. Exactly 4 final statuses (VERIFIED, REVIEW, UNVERIFIED, REJECTED)
 */

import fs from 'fs';
import path from 'path';
import { auditAndBuildLeadPackages } from '../lib/agents/fileIntakeAuditor';
import { evaluateInternalLeadPackage } from '../lib/internalQualification';
import { DEFAULT_TVB_TARGET_PROFILE, TargetProfile } from '../lib/targetProfileData';
import { FinalLeadStatus } from '../lib/leadPackage';

async function runInternalWorkflowTests() {
  console.log('================================================================');
  console.log('INTERNAL WORKFLOW & NETWORK INDEPENDENCE ACCEPTANCE TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  // --- 1. SETUP NETWORK CALL INTERCEPTOR (REQUIREMENT 23) ---
  let networkCallCount = 0;
  const originalFetch = global.fetch;
  (global as any).fetch = async (url: string | URL | Request, init?: any) => {
    networkCallCount++;
    throw new Error(`CRITICAL VIOLATION: Network fetch attempted in Internal Workflow: ${url.toString()}`);
  };

  try {
    // --- 2. LOAD GROWTH LIST MAY 2024 REFERENCE DATA (REQUIREMENT 24) ---
    const preferredPath = path.resolve(process.cwd(), 'reference_data/Growth List Free Forever - May 2024csv.csv');
    const fallbackPath = path.resolve(process.cwd(), 'reference_data/growth_list_may_2024.csv');
    const csvPath = fs.existsSync(preferredPath) ? preferredPath : fallbackPath;
    assert(fs.existsSync(csvPath), `Growth List reference file exists at ${csvPath}`);

    const fileBuffer = fs.readFileSync(csvPath);
    const fileName = path.basename(csvPath);

    // Count data rows from CSV file directly
    const rawLines = fileBuffer.toString('utf-8').trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    const expectedDataRows = rawLines.length - 1; // excluding header

    // --- 3. RUN AGENT 1: FILE INTAKE AUDITOR ---
    const startTime = Date.now();
    const auditResult = await auditAndBuildLeadPackages(fileBuffer, fileName, 'text/csv');
    const leadPackages = auditResult.packages;
    const elapsed = Date.now() - startTime;

    assert(leadPackages.length === expectedDataRows, `Processed all ${expectedDataRows} rows without 25 or 40-row truncation (got ${leadPackages.length})`);

    assert(networkCallCount === 0, `ZERO network calls occurred during Agent 1 file intake audit`);

    // --- 4. CHECK SEED DATA PRESERVATION & RAW FIELDS ---
    const firstPackage = leadPackages[0];
    assert(firstPackage !== undefined, 'First lead package built successfully');
    assert(Object.keys(firstPackage.seed_data.raw_fields).length > 0, 'Original raw fields preserved in seed_data.raw_fields');
    assert(firstPackage.source.file_name === fileName, 'Source metadata contains original file name');
    assert(typeof firstPackage.source.row_number === 'number', 'Source metadata contains row_number');

    // --- 5. CHECK PLACEHOLDER AUDITING ---
    // Growth List contains "UPGRADE TO UNLOCK" placeholders in contact/LinkedIn columns
    const packagesWithPlaceholders = leadPackages.filter(p => p.audit.placeholders.length > 0);
    assert(packagesWithPlaceholders.length > 0, `Correctly identified paywall placeholders like "UPGRADE TO UNLOCK" in ${packagesWithPlaceholders.length} packages`);

    const samplePlaceholderPackage = packagesWithPlaceholders[0];
    const hasUpgradeUnlock = samplePlaceholderPackage.audit.placeholders.some(pl =>
      (pl.rawValue && pl.rawValue.toUpperCase().includes('UPGRADE TO UNLOCK')) ||
      (pl.detectedAs && pl.detectedAs.toUpperCase().includes('PAYWALL'))
    );
    assert(hasUpgradeUnlock, 'Audit details capture paywall placeholder type and rawValue');


    // Normalized fields should NOT have "UPGRADE TO UNLOCK" as a real name
    if (samplePlaceholderPackage.seed_data.raw_fields['CEO'] === 'UPGRADE TO UNLOCK') {
      assert(samplePlaceholderPackage.seed_data.normalized.founder_or_ceo === undefined, 'Paywall placeholder is stripped from normalized founder_or_ceo field');
    }

    // --- 6. RUN INTERNAL QUALIFICATION ACROSS ALL PACKAGES ---
    const validFourStatuses: FinalLeadStatus[] = ['VERIFIED', 'REVIEW', 'UNVERIFIED', 'REJECTED'];
    const statusCounts: Record<FinalLeadStatus, number> = {
      VERIFIED: 0,
      REVIEW: 0,
      UNVERIFIED: 0,
      REJECTED: 0,
    };

    const targetProfile: TargetProfile = {
      ...DEFAULT_TVB_TARGET_PROFILE,
      fundingMin: 100_000,
      fundingMax: 50_000_000,
      regions: ['Global'],
      countries: [],
      industries: ['Any'],
    };

    for (const pkg of leadPackages) {
      const result = evaluateInternalLeadPackage(pkg, targetProfile);
      assert(validFourStatuses.includes(result.finalStatus), `Lead ${pkg.seed_data.normalized.company_name} received valid 4-status: ${result.finalStatus}`);
      statusCounts[result.finalStatus]++;
    }

    assert(networkCallCount === 0, `ZERO network calls occurred during Internal Qualification across all ${leadPackages.length} leads`);
    console.log('\nInternal Qualification Distribution across Growth List 2024:');
    console.log(`- VERIFIED:   ${statusCounts.VERIFIED}`);
    console.log(`- REVIEW:     ${statusCounts.REVIEW}`);
    console.log(`- UNVERIFIED: ${statusCounts.UNVERIFIED}`);
    console.log(`- REJECTED:   ${statusCounts.REJECTED}`);
    console.log(`- Total:      ${leadPackages.length} in ${elapsed}ms\n`);

    assert(statusCounts.VERIFIED + statusCounts.REVIEW + statusCounts.UNVERIFIED + statusCounts.REJECTED === leadPackages.length, 'Every lead has exactly one final status');

    // --- 7. TEST STRICT MISMATCH LEADS TO REJECTED ---
    const restrictiveTarget: TargetProfile = {
      ...DEFAULT_TVB_TARGET_PROFILE,
      fundingMin: 1_000_000_000, // $1 Billion minimum funding
      fundingMax: 5_000_000_000,
      regions: ['Global'],
    };

    const rejectedResult = evaluateInternalLeadPackage(leadPackages[0], restrictiveTarget);
    assert(rejectedResult.finalStatus === 'REJECTED', 'Definite target funding mismatch produces REJECTED status');
    assert(rejectedResult.qualification.failedCriteria.length > 0, 'Explicit failed criteria recorded in qualification result');


  } finally {
    // Restore fetch
    global.fetch = originalFetch;
  }

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} INTERNAL WORKFLOW ACCEPTANCE TESTS PASSED!`);
  } else {
    console.error(`💥 ${failed} TESTS FAILED out of ${passed + failed}`);
    process.exit(1);
  }
  console.log('================================================================');
}

runInternalWorkflowTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
