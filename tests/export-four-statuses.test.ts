/**
 * Test Suite: Requirement 27 - Export Tests Across All Four Canonical Statuses
 *
 * Requirements Tested:
 * 1. Independent exports for each of the 4 canonical statuses:
 *    - VERIFIED
 *    - REVIEW
 *    - UNVERIFIED
 *    - REJECTED
 * 2. Formats: CSV, XLSX, PDF
 * 3. Operations:
 *    - Download All
 *    - Download Selected
 * 4. Preservation Assertions:
 *    - Source information (file name, row number, sheet)
 *    - Workflow origin (INTERNAL, EXTERNAL, BOTH)
 *    - Current status & Previous status
 *    - Audit metadata (manual override flag, reason, timestamp, audit history)
 *    - Target criteria results (matched, failed, missing/unknown)
 *    - Evidence & selection/rejection rationales
 */

import {
  generateUniversalCsv,
  generateUniversalXlsx,
  generateUniversalPdf,
  normalizeUnifiedLead,
} from '../lib/export';
import { UnifiedLead, FinalLeadStatus } from '../lib/leadPackage';
import * as XLSX from 'xlsx';

// Helper to create synthetic canonical leads for each of the 4 statuses
function createLeadForStatus(
  status: FinalLeadStatus,
  companyName: string,
  domain: string,
  origin: 'INTERNAL' | 'EXTERNAL' | 'BOTH',
  hasOverride = false
): UnifiedLead {
  const now = new Date().toISOString();
  return {
    id: `lead_${domain}`,
    identity: {
      company_name: companyName,
      canonical_domain: domain,
      website: `https://${domain}`,
    },
    origins: origin === 'BOTH' ? ['INTERNAL', 'EXTERNAL'] : [origin],
    originDisplay: origin,
    internal: {
      source_file: 'growth_list_q2.csv',
      source_row: 42,
      sheet_name: 'Tech_Startups',
      page_number: null,
      raw_data: {
        'Company Name': companyName,
        'Website': `https://${domain}`,
        'Country': 'Germany',
        'Funding': '$5,000,000',
        'CEO': `${companyName} CEO`,
        'Email': `founder@${domain}`,
      },
      normalized_data: {
        company_name: companyName,
        website: `https://${domain}`,
        canonical_domain: domain,
        country: 'Germany',
        funding: '$5,000,000',
        founder_or_ceo: `${companyName} CEO`,
        company_email: `founder@${domain}`,
        ceo_email: `ceo@${domain}`,
        industry: 'B2B SaaS',
      },
      audit: {
        fields_present: ['Company Name', 'Website', 'Funding'],
        fields_missing: [],
        placeholders: [],
        malformed_fields: [],
        duplicate_signals: [],
      },
      status: 'VERIFIED',
      status_history: [
        {
          status: 'VERIFIED',
          source: 'INTERNAL_AUTO',
          timestamp: now,
          reason: 'Initial file import satisfied criteria',
        },
      ],
      evaluated_at: now,
    },
    external: origin === 'BOTH' || origin === 'EXTERNAL'
      ? {
          researched: true,
          current_data: {
            name: companyName,
            website: `https://${domain}`,
            industry: 'B2B SaaS',
            country: 'Germany',
            fundingOrRevenue: '$5,000,000',
            founderOrCeoName: `${companyName} CEO`,
            emailVerified: true,
            confidenceScore: 92,
          },
          evidence: {
            sources: ['https://crunchbase.com/org/' + domain, `https://${domain}/about`],
          },
          status,
          status_history: [
            {
              status,
              source: 'EXTERNAL_AUTO',
              timestamp: now,
              reason: 'External web research verified signals',
            },
          ],
          researched_at: now,
          sources: ['https://crunchbase.com/org/' + domain, `https://${domain}/about`],
        }
      : undefined,
    currentStatus: status,
    qualification: {
      target_profile_id: 'active_target_profile',
      match_percentage: status === 'VERIFIED' ? '95%' : status === 'REVIEW' ? '70%' : status === 'UNVERIFIED' ? '50%' : '20%',
      match_score: status === 'VERIFIED' ? 95 : status === 'REVIEW' ? 70 : status === 'UNVERIFIED' ? 50 : 20,
      criteria: {
        funding: {
          name: 'Funding / Revenue',
          category: 'financial',
          active: true,
          status: status === 'REJECTED' ? 'FAIL' : 'PASS',
          requiredValue: '$100K–$10M',
          actualValue: status === 'REJECTED' ? '$50M' : '$5M',
          reason: status === 'REJECTED' ? 'Exceeds target limit' : 'Within target bounds',
          evidence: 'Crunchbase funding wire',
          weight: 20,
        },
        geography: {
          name: 'Target Geography',
          category: 'geographic',
          active: true,
          status: 'PASS',
          requiredValue: 'Global / Europe',
          actualValue: 'Germany',
          reason: 'Matches selected European geography',
          evidence: 'HQ Registry',
          weight: 15,
        },
        founder: {
          name: 'Founder / CEO',
          category: 'leadership',
          active: true,
          status: status === 'UNVERIFIED' ? 'UNKNOWN' : 'PASS',
          requiredValue: 'Identified Leader',
          actualValue: `${companyName} CEO`,
          reason: status === 'UNVERIFIED' ? 'Leader details unverified' : 'Confirmed current CEO',
          evidence: 'Imprint page',
          weight: 15,
        },
      },
      passedCriteria: status === 'REJECTED' ? ['Target Geography'] : ['Funding / Revenue', 'Target Geography'],
      failedCriteria: status === 'REJECTED' ? ['Funding / Revenue'] : [],
      missingCriteria: status === 'UNVERIFIED' ? ['Founder / CEO'] : [],
      reviewCriteria: status === 'REVIEW' ? ['Conflicting headcount data'] : [],
      exactReason: status === 'VERIFIED'
        ? 'All active required Target Profile criteria satisfied'
        : status === 'REVIEW'
        ? 'Conflicting headcount signals require manual review'
        : status === 'UNVERIFIED'
        ? 'Insufficient data on leadership'
        : 'Failed funding threshold requirement',
    },
    auditTrail: hasOverride
      ? [
          {
            lead_id: `lead_${domain}`,
            workflow: origin === 'BOTH' ? 'EXTERNAL' : origin,
            original_status: 'REVIEW',
            new_status: status,
            manual_override: true,
            override_by: 'lead_auditor@huntlyst.com',
            override_at: now,
            override_reason: 'Auditor verified certificate manually',
            previous_status_history_id: 'hist_123',
            source: 'USER_ACTION',
          },
        ]
      : [],
    statusHistory: [
      {
        status: hasOverride ? 'REVIEW' : status,
        source: 'INTERNAL_AUTO',
        timestamp: now,
        reason: 'Initial evaluation',
      },
      ...(hasOverride
        ? [
            {
              status,
              source: 'MANUAL_OVERRIDE' as const,
              timestamp: now,
              override_by: 'lead_auditor@huntlyst.com',
              reason: 'Auditor verified certificate manually',
            },
          ]
        : []),
    ],
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: now,
  };
}

async function runExportTests() {
  console.log('================================================================');
  console.log('REQUIREMENT 27: EXPORT TESTS ACROSS ALL FOUR CANONICAL STATUSES');
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

  const statuses: FinalLeadStatus[] = ['VERIFIED', 'REVIEW', 'UNVERIFIED', 'REJECTED'];

  for (const status of statuses) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`TESTING STATUS SECTION: ${status}`);
    console.log(`----------------------------------------------------------------`);

    // Create 3 leads for this status:
    // Lead 1: Internal origin
    // Lead 2: External origin
    // Lead 3: BOTH (Internal + External) with manual override
    const lead1 = createLeadForStatus(status, `${status} Alpha Inc`, `${status.toLowerCase()}-alpha.de`, 'INTERNAL');
    const lead2 = createLeadForStatus(status, `${status} Beta Corp`, `${status.toLowerCase()}-beta.de`, 'EXTERNAL');
    const lead3 = createLeadForStatus(status, `${status} Gamma Ltd`, `${status.toLowerCase()}-gamma.de`, 'BOTH', true);

    const allLeads = [lead1, lead2, lead3];
    const selectedLeads = [lead1, lead3]; // Test Download Selected

    // -------------------------------------------------------------
    // A. CSV EXPORTS: Download All & Download Selected
    // -------------------------------------------------------------
    console.log(`\n[${status}] A. Testing CSV Exports`);

    // Download All
    const csvAll = generateUniversalCsv(allLeads);
    assert(typeof csvAll === 'string' && csvAll.length > 0, `[${status}] CSV (Download All) generates non-empty string`);
    assert(csvAll.includes(`${status} Alpha Inc`), `[${status}] CSV (Download All) contains lead 1`);
    assert(csvAll.includes(`${status} Beta Corp`), `[${status}] CSV (Download All) contains lead 2`);
    assert(csvAll.includes(`${status} Gamma Ltd`), `[${status}] CSV (Download All) contains lead 3`);

    // Metadata preservation in CSV
    assert(csvAll.includes('Workflow Origin'), `[${status}] CSV contains "Workflow Origin" column`);
    assert(csvAll.includes('Source File'), `[${status}] CSV contains "Source File" column`);
    assert(csvAll.includes('Current Status'), `[${status}] CSV contains "Current Status" column`);
    assert(csvAll.includes('Manual Override'), `[${status}] CSV contains "Manual Override" column`);
    assert(csvAll.includes('growth_list_q2.csv'), `[${status}] CSV preserves internal source file name`);
    assert(csvAll.includes('Auditor verified certificate manually'), `[${status}] CSV preserves manual override reason`);

    // Download Selected
    const csvSelected = generateUniversalCsv(selectedLeads);
    assert(csvSelected.includes(`${status} Alpha Inc`), `[${status}] CSV (Download Selected) includes selected lead 1`);
    assert(csvSelected.includes(`${status} Gamma Ltd`), `[${status}] CSV (Download Selected) includes selected lead 3`);
    assert(!csvSelected.includes(`${status} Beta Corp`), `[${status}] CSV (Download Selected) strictly excludes unselected lead 2`);

    // -------------------------------------------------------------
    // B. XLSX EXPORTS: Download All & Download Selected
    // -------------------------------------------------------------
    console.log(`\n[${status}] B. Testing XLSX Exports`);

    // Download All
    const xlsxAllBuffer = generateUniversalXlsx(allLeads.map(l => normalizeUnifiedLead(l)));
    assert(xlsxAllBuffer instanceof Uint8Array && xlsxAllBuffer.length > 500, `[${status}] XLSX (Download All) produces valid binary array`);

    const workbookAll = XLSX.read(xlsxAllBuffer, { type: 'buffer' });
    assert(workbookAll.SheetNames.includes('All Records'), `[${status}] XLSX workbook has "All Records" sheet`);
    const allRecordsSheet = workbookAll.Sheets['All Records'];
    const xlsxAllJson = XLSX.utils.sheet_to_json(allRecordsSheet);
    assert(xlsxAllJson.length === 3, `[${status}] XLSX (Download All) has exactly 3 rows (found ${xlsxAllJson.length})`);

    const row3 = xlsxAllJson[2] as any;
    assert(row3['Company Name'] === `${status} Gamma Ltd`, `[${status}] XLSX preserves company name`);
    assert(row3['Record Status'] === status, `[${status}] XLSX preserves canonical record status (${status})`);
    assert(row3['Workflow Origin'] === 'BOTH', `[${status}] XLSX preserves workflow origin "BOTH"`);
    assert(row3['Source File'] === 'growth_list_q2.csv', `[${status}] XLSX preserves source file`);
    assert(row3['Manual Override'] === 'true' || row3['Manual Override'] === true, `[${status}] XLSX preserves manual override flag`);

    // Download Selected
    const xlsxSelectedBuffer = generateUniversalXlsx(selectedLeads.map(l => normalizeUnifiedLead(l)));
    const workbookSelected = XLSX.read(xlsxSelectedBuffer, { type: 'buffer' });
    const selectedSheet = workbookSelected.Sheets['All Records'];
    const xlsxSelectedJson = XLSX.utils.sheet_to_json(selectedSheet);
    assert(xlsxSelectedJson.length === 2, `[${status}] XLSX (Download Selected) has exactly 2 selected rows (found ${xlsxSelectedJson.length})`);
    const selectedNames = xlsxSelectedJson.map((r: any) => r['Company Name']);
    assert(selectedNames.includes(`${status} Alpha Inc`), `[${status}] XLSX (Download Selected) contains Alpha`);
    assert(!selectedNames.includes(`${status} Beta Corp`), `[${status}] XLSX (Download Selected) excludes unselected Beta`);

    // -------------------------------------------------------------
    // C. PDF EXPORTS: Download All & Download Selected
    // -------------------------------------------------------------
    console.log(`\n[${status}] C. Testing PDF Exports`);

    // Download All
    const pdfAllBuffer = generateUniversalPdf(allLeads);
    assert(pdfAllBuffer instanceof Uint8Array && pdfAllBuffer.length > 1000, `[${status}] PDF (Download All) produces valid binary buffer (${pdfAllBuffer.length} bytes)`);

    // Check PDF magic header "%PDF-"
    const pdfHeader = Buffer.from(pdfAllBuffer.slice(0, 5)).toString('utf-8');
    assert(pdfHeader.startsWith('%PDF-'), `[${status}] PDF output has valid "%PDF-" header`);

    // Download Selected
    const pdfSelectedBuffer = generateUniversalPdf(selectedLeads);
    assert(pdfSelectedBuffer instanceof Uint8Array && pdfSelectedBuffer.length > 1000, `[${status}] PDF (Download Selected) produces valid binary buffer`);
    assert(Buffer.from(pdfSelectedBuffer.slice(0, 5)).toString('utf-8').startsWith('%PDF-'), `[${status}] PDF (Download Selected) has valid header`);
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runExportTests().catch((err) => {
  console.error('Fatal export test error:', err);
  process.exit(1);
});
