/**
 * Comprehensive Automated Test Suite: Full Data Export System (Sections 43–71)
 *
 * Validates:
 * 1. Universal normalization from CompanyRecord, RejectedCompanyRecord, and CompanyVerificationResult
 * 2. Full-fidelity CSV generation with RFC-4180 escaping, UTF-8 BOM, and all Section 48 columns
 * 3. Multi-sheet Excel (XLSX) workbook generation with proper sheet names and data integrity
 * 4. Complete nested JSON pipeline schema export with metadata and audit trails
 * 5. Deterministic rejection reasons and selection reasons export
 * 6. Verification checks audit trail preservation
 * 7. Multi-stage and multi-status filtering accuracy
 * 8. Live export snapshot timestamp formatting (YYYY-MM-DD HH:mm:ss)
 * 9. Exact count integrity (no records lost or inflated)
 */

import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  UniversalExportRecord,
  normalizeCompanyRecord,
  normalizeRejectedCompanyRecord,
  normalizeVerificationResult,
  normalizeAnyRecord,
  filterExportRecords,
  generateUniversalCsv,
  generateUniversalXlsx,
  generateUniversalJson,
  formatSnapshotTime,
  extractCanonicalDomain,
} from '../lib/export';
import { CompanyRecord, RejectedCompanyRecord } from '../lib/types';
import { CompanyVerificationResult } from '../providers/types';

// ==========================================
// TEST FIXTURES
// ==========================================

const mockApprovedLead: CompanyRecord = {
  name: 'Acme Robotics Oy',
  website: 'https://www.acme-robotics.fi/solutions',
  description: 'AI-powered autonomous manufacturing inspection systems for industrial automation.',
  industry: 'Industrial Automation',
  sector: 'Artificial Intelligence',
  fundingOrRevenue: '$3.5M Seed',
  usPresence: true, // Non-US confirmed
  founderOrCeoName: 'Eero Virtanen',
  founderOrCeoEmail: 'eero@acme-robotics.fi',
  emailVerified: true,
  confidenceScore: 0.96,
  huntScore: 94,
  sourceType: 'Houston Multi-Strategy Discovery',
  country: 'Finland',
  headquarters: 'Helsinki, Finland',
  linkedinUrl: 'https://linkedin.com/in/eerovirtanen',
  sourceUrls: ['https://www.acme-robotics.fi', 'https://techcrunch.com/acme-seed'],
  auditDetails: {
    fundingStatus: 'Verified: $3.5M Seed Round',
    locationStatus: 'Non-US Confirmed: Helsinki, Finland',
    techStatus: 'Proprietary computer vision platform verified',
    emailStatus: 'PASS: DNS MX Records verified for acme-robotics.fi',
    rawEvidence: 'Finnish business registry #2948192-3; verified headquarters in Helsinki.',
  },
  firstDiscoveredAt: '2026-09-28T10:00:00.000Z',
  lastVerifiedAt: '2026-09-28T10:05:00.000Z',
};

const mockRejectedLead: RejectedCompanyRecord = {
  name: 'Silicon Valley Labs Inc',
  website: 'https://sv-labs.io',
  industry: 'Cloud Infrastructure',
  fundingOrRevenue: '$150M Series D',
  location: 'San Francisco, CA, United States',
  founderOrCeoName: 'Brad Smith',
  rejectionReasons: [
    'Geography mismatch: Headquarters detected in United States (Target: Non-US only)',
    'Funding out of range: $150M exceeds $5M maximum threshold',
  ],
  matchedRules: ['Proprietary technology platform'],
  failedRules: ['Non-US Headquarters', 'Funding within $1M–$5M target bounds'],
  sourceEvidence: 'SEC filing shows primary headquarters in San Francisco, CA. Crunchbase confirms $150M Series D.',
  firstDiscoveredAt: '2026-09-28T10:10:00.000Z',
  lastVerifiedAt: '2026-09-28T10:12:00.000Z',
};

const mockVerificationResult: CompanyVerificationResult = {
  company: {
    name: 'Nordic CleanWater AB',
    website: 'https://nordic-cleanwater.se',
    description: 'Electrochemical water filtration IoT sensor platform.',
    industry: 'CleanTech',
    sector: 'CleanTech & Environmental',
    fundingOrRevenue: '$2.1M Seed',
    usPresence: true,
    founderOrCeoName: 'Astrid Lind',
    founderOrCeoEmail: 'astrid@nordic-cleanwater.se',
    emailVerified: false,
    confidenceScore: 0.88,
    huntScore: 78,
    sourceType: 'Internal Candidate Document',
    country: 'Sweden',
  },
  verificationStatus: 'PARTIALLY_VERIFIED',
  decisionExplanation: 'Strong tech platform and Swedish headquarters, but executive email is unverified catch-all.',
  failedCriteria: [],
  passedCriteria: ['geography_non_us', 'funding_in_range', 'tech_platform'],
  unknownCriteria: ['professional_email_deliverability'],
  criteria: {
    funding: { status: 'PASS', value: '$2.1M Seed', evidence: 'Swedish Venture registry' },
    geography: { status: 'PASS', value: 'Stockholm, Sweden', evidence: 'Domain registered in Sweden' },
    usPresence: { status: 'PASS', value: 'Non-US Confirmed' },
    industry: { status: 'PASS', value: 'CleanTech' },
    companyAge: { status: 'UNKNOWN' },
    companyStage: { status: 'PASS', value: 'Seed' },
    founderOrCeo: { status: 'PASS', value: 'Astrid Lind' },
    professionalEmail: { status: 'UNKNOWN', reason: 'Server accepted all addresses (catch-all domain)' },
  },
  sources: ['https://nordic-cleanwater.se', 'https://allabolag.se/nordic-cleanwater'],
  auditTimestamp: '2026-09-28T10:20:00.000Z',
  executives: [
    {
      name: 'Astrid Lind',
      role: 'CEO',
      email: 'astrid@nordic-cleanwater.se',
      emailStatus: 'UNKNOWN',
      status: 'PASS',
      linkedin: 'https://linkedin.com/in/astrid-lind-water',
    },
  ],
};

// ==========================================
// TEST RUNNER
// ==========================================

async function runTests() {
  console.log('\n==================================================');
  console.log('🧪 HUNTLYST2 FULL DATA EXPORT SYSTEM AUDIT & TESTS');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}\n`);
    }
  }

  // 1. Domain Helper & Snapshot Time
  test('extractCanonicalDomain strips protocol, www, and query params', () => {
    assert.strictEqual(extractCanonicalDomain('https://www.acme-robotics.fi/solutions?ref=tvb'), 'acme-robotics.fi');
    assert.strictEqual(extractCanonicalDomain('http://sub.domain.co.uk/path'), 'sub.domain.co.uk');
    assert.strictEqual(extractCanonicalDomain(''), '');
    assert.strictEqual(extractCanonicalDomain(null), '');
  });

  test('formatSnapshotTime produces YYYY-MM-DD HH:mm:ss format', () => {
    const fixed = new Date(2026, 8, 28, 14, 30, 45); // Month is 0-indexed (8 = Sept)
    const formatted = formatSnapshotTime(fixed);
    assert.strictEqual(formatted, '2026-09-28 14:30:45');
    assert.match(formatSnapshotTime(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  // 2. Normalization Tests
  test('normalizeCompanyRecord maps all Section 48 fields for approved leads', () => {
    const norm = normalizeCompanyRecord(mockApprovedLead, 'Stage 6: Final Results', 'Approved', {
      huntId: 'hunt-test-1',
      searchQuery: 'European Robotics Seed',
    });

    assert.strictEqual(norm.companyName, 'Acme Robotics Oy');
    assert.strictEqual(norm.canonicalDomain, 'acme-robotics.fi');
    assert.strictEqual(norm.recordStatus, 'Approved');
    assert.strictEqual(norm.discoveryStage, 'Stage 6: Final Results');
    assert.strictEqual(norm.huntScore, 94);
    assert.strictEqual(norm.decisionMakerName, 'Eero Virtanen');
    assert.strictEqual(norm.email, 'eero@acme-robotics.fi');
    assert.strictEqual(norm.emailVerificationStatus, 'valid');
    assert.strictEqual(norm.country, 'Finland');
    assert.ok(norm.reasonsForSelection.includes('Industry Matched'));
    assert.ok(norm.reasonsForSelection.includes('Email MX Verified'));
    assert.strictEqual(norm.reasonsForRejection, '');
    assert.ok(norm.verificationChecksPerformed.length > 0);
    assert.strictEqual(norm.searchQuery, 'European Robotics Seed');
    assert.strictEqual(norm.huntId, 'hunt-test-1');
  });

  test('normalizeRejectedCompanyRecord preserves deterministic rejection reasons and failed criteria', () => {
    const norm = normalizeRejectedCompanyRecord(mockRejectedLead, 'Stage 4: Qualification', {
      huntId: 'hunt-test-2',
    });

    assert.strictEqual(norm.companyName, 'Silicon Valley Labs Inc');
    assert.strictEqual(norm.recordStatus, 'Rejected');
    assert.strictEqual(norm.discoveryStage, 'Stage 4: Qualification');
    assert.strictEqual(norm.matchStatus, 'No Match');
    assert.ok(norm.reasonsForRejection.includes('Geography mismatch'));
    assert.ok(norm.reasonsForRejection.includes('Funding out of range'));
    assert.deepStrictEqual(norm.criteriaFailed, [
      'Non-US Headquarters',
      'Funding within $1M–$5M target bounds',
    ]);
    assert.ok(norm.evidenceSummary.includes('San Francisco'));
    assert.strictEqual(norm.reasonsForSelection, '');
  });

  test('normalizeVerificationResult preserves criteria checks audit trail and executive data', () => {
    const norm = normalizeVerificationResult(mockVerificationResult, 'Stage 5: Verification', false);

    assert.strictEqual(norm.companyName, 'Nordic CleanWater AB');
    assert.strictEqual(norm.recordStatus, 'Partially Verified');
    assert.strictEqual(norm.decisionMakerName, 'Astrid Lind');
    assert.strictEqual(norm.decisionMakerRole, 'CEO');
    assert.strictEqual(norm.email, 'astrid@nordic-cleanwater.se');
    assert.strictEqual(norm.emailVerificationStatus, 'unverified');
    assert.ok(norm.verificationChecksPerformed.some(c => c.name === 'funding' && c.status === 'PASS'));
    assert.ok(norm.verificationChecksPerformed.some(c => c.name === 'professionalEmail' && c.status === 'UNKNOWN'));
    assert.ok(norm.sourceUrls.includes('https://nordic-cleanwater.se'));
  });

  test('normalizeAnyRecord transparently dispatches across all 3 candidate types', () => {
    const normApp = normalizeAnyRecord(mockApprovedLead);
    const normRej = normalizeAnyRecord(mockRejectedLead);
    const normVer = normalizeAnyRecord(mockVerificationResult);

    assert.strictEqual(normApp.recordStatus, 'Approved');
    assert.strictEqual(normRej.recordStatus, 'Rejected');
    assert.strictEqual(normVer.recordStatus, 'Partially Verified');
  });

  // 3. Multi-Stage and Multi-Status Filtering Tests
  const allRecords: UniversalExportRecord[] = [
    normalizeCompanyRecord(mockApprovedLead, 'Stage 6: Final Results', 'Approved'),
    normalizeRejectedCompanyRecord(mockRejectedLead, 'Stage 4: Qualification'),
    normalizeVerificationResult(mockVerificationResult, 'Stage 5: Verification', false),
  ];

  test('filterExportRecords filters by Status (Approved Only)', () => {
    const filtered = filterExportRecords(allRecords, { statuses: ['Approved'] });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].companyName, 'Acme Robotics Oy');
  });

  test('filterExportRecords filters by Status (Rejected Only)', () => {
    const filtered = filterExportRecords(allRecords, { statuses: ['Rejected'] });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].companyName, 'Silicon Valley Labs Inc');
  });

  test('filterExportRecords filters by combined Stage + Status (Section 46)', () => {
    const filtered = filterExportRecords(allRecords, {
      stages: ['Stage 4: Qualification'],
      statuses: ['Rejected'],
    });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].companyName, 'Silicon Valley Labs Inc');

    const emptyFilter = filterExportRecords(allRecords, {
      stages: ['Stage 1: Internal Discovery'],
      statuses: ['Approved'],
    });
    assert.strictEqual(emptyFilter.length, 0);
  });

  test('filterExportRecords filters by Selective Row IDs (Section 65)', () => {
    const selectedId = allRecords[0].id;
    const filtered = filterExportRecords(allRecords, { selectedIds: [selectedId] });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, selectedId);
  });

  test('Export All preserves 100% of discovered candidates without silent exclusion (Section 47)', () => {
    const all = filterExportRecords(allRecords, {});
    assert.strictEqual(all.length, 3);
    assert.ok(all.some(r => r.recordStatus === 'Approved'));
    assert.ok(all.some(r => r.recordStatus === 'Rejected'));
    assert.ok(all.some(r => r.recordStatus === 'Partially Verified'));
  });

  // 4. CSV Export Tests
  test('generateUniversalCsv produces valid RFC-4180 format with UTF-8 BOM readiness', () => {
    const csv = generateUniversalCsv(allRecords, { snapshotTime: '2026-09-28 14:00:00' });
    const lines = csv.split('\r\n');

    // Header check
    assert.ok(lines[0].includes('Company Name'));
    assert.ok(lines[0].includes('Canonical Domain'));
    assert.ok(lines[0].includes('Reasons For Selection'));
    assert.ok(lines[0].includes('Reasons For Rejection'));
    assert.ok(lines[0].includes('Snapshot Time'));

    // Rows count (Header + 3 records)
    assert.strictEqual(lines.length, 4);

    // Row 1 (Approved Lead)
    const approvedRow = lines[1];
    assert.ok(approvedRow.includes('"Acme Robotics Oy"'));
    assert.ok(approvedRow.includes('"Approved"'));
    assert.ok(approvedRow.includes('94')); // Hunt score

    // Row 2 (Rejected Lead)
    const rejectedRow = lines[2];
    assert.ok(rejectedRow.includes('"Silicon Valley Labs Inc"'));
    assert.ok(rejectedRow.includes('"Rejected"'));
    assert.ok(rejectedRow.includes('Geography mismatch')); // Rejection reason
  });

  // 5. Excel (XLSX) Multi-Sheet Export Tests
  test('generateUniversalXlsx produces multi-sheet workbook with All, Approved, Rejected, Audit, Evidence, Summary', () => {
    const buffer = generateUniversalXlsx(allRecords, {
      snapshotTime: '2026-09-28 14:00:00',
      huntId: 'hunt-excel-test',
    });

    assert.ok(buffer instanceof Uint8Array);
    assert.ok(buffer.length > 500, 'XLSX buffer should contain zip file structure');

    // Parse back using XLSX library to verify sheet integrity
    const parsedWb = XLSX.read(buffer, { type: 'array' });
    assert.ok(parsedWb.SheetNames.includes('All Records'));
    assert.ok(parsedWb.SheetNames.includes('Approved'));
    assert.ok(parsedWb.SheetNames.includes('Rejected'));
    assert.ok(parsedWb.SheetNames.includes('Review & Unverified'));
    assert.ok(parsedWb.SheetNames.includes('Verification Audit'));
    assert.ok(parsedWb.SheetNames.includes('Evidence & Sources'));
    assert.ok(parsedWb.SheetNames.includes('Search Summary'));

    // Check All Records sheet
    const wsAll = parsedWb.Sheets['All Records'];
    const rowsAll = XLSX.utils.sheet_to_json(wsAll);
    assert.strictEqual(rowsAll.length, 3);

    // Check Rejected sheet
    const wsRejected = parsedWb.Sheets['Rejected'];
    const rowsRejected: any[] = XLSX.utils.sheet_to_json(wsRejected);
    assert.strictEqual(rowsRejected.length, 1);
    assert.strictEqual(rowsRejected[0]['Company Name'], 'Silicon Valley Labs Inc');
    assert.ok(rowsRejected[0]['Rejection Reason'].includes('Geography mismatch'));

    // Check Verification Audit sheet
    const wsAudit = parsedWb.Sheets['Verification Audit'];
    const rowsAudit: any[] = XLSX.utils.sheet_to_json(wsAudit);
    assert.ok(rowsAudit.length >= 3, 'Audit rows should enumerate individual checks');

    // Check Search Summary sheet
    const wsSummary = parsedWb.Sheets['Search Summary'];
    const rowsSummary: any[] = XLSX.utils.sheet_to_json(wsSummary);
    const totalRow = rowsSummary.find((r) => r.Parameter === 'Total Records Exported');
    assert.strictEqual(totalRow?.Value, 3);
  });

  // 6. JSON Full Pipeline Export Tests
  test('generateUniversalJson preserves complete nested schema and metadata', () => {
    const jsonStr = generateUniversalJson(allRecords, {
      snapshotTime: '2026-09-28 14:00:00',
      huntId: 'hunt-json-test',
    });

    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.exportMetadata.totalRecords, 3);
    assert.strictEqual(parsed.exportMetadata.exportSnapshotTime, '2026-09-28 14:00:00');
    assert.strictEqual(parsed.exportMetadata.countsByStatus.Approved, 1);
    assert.strictEqual(parsed.exportMetadata.countsByStatus.Rejected, 1);

    assert.strictEqual(parsed.records.length, 3);
    const rec1 = parsed.records[0];
    assert.strictEqual(rec1.identity.companyName, 'Acme Robotics Oy');
    assert.strictEqual(rec1.identity.canonicalDomain, 'acme-robotics.fi');
    assert.strictEqual(rec1.decisionMakerData.name, 'Eero Virtanen');
    assert.strictEqual(rec1.contactData.email, 'eero@acme-robotics.fi');
    assert.strictEqual(rec1.pipelineTracking.recordStatus, 'Approved');

    const rec2 = parsed.records[1];
    assert.strictEqual(rec2.identity.companyName, 'Silicon Valley Labs Inc');
    assert.strictEqual(rec2.pipelineTracking.recordStatus, 'Rejected');
    assert.ok(rec2.qualificationData.reasonsForRejection.includes('Geography mismatch'));
  });

  // 7. Data Integrity & Count Consistency (Section 69)
  test('Exact record counts match between filtered sets and generated formats', () => {
    const records = allRecords;
    const csv = generateUniversalCsv(records);
    const xlsxBuf = generateUniversalXlsx(records);
    const jsonStr = generateUniversalJson(records);

    // CSV line count check (excluding header)
    const csvRows = csv.split('\r\n').slice(1).filter(l => l.trim().length > 0);
    assert.strictEqual(csvRows.length, records.length);

    // XLSX All Records row count check
    const wb = XLSX.read(xlsxBuf, { type: 'array' });
    const xlsxRows = XLSX.utils.sheet_to_json(wb.Sheets['All Records']);
    assert.strictEqual(xlsxRows.length, records.length);

    // JSON array length check
    const jsonParsed = JSON.parse(jsonStr);
    assert.strictEqual(jsonParsed.records.length, records.length);
  });

  console.log('\n--------------------------------------------------');
  console.log(`Summary: ${passed}/${total} test suites passed.`);
  console.log('==================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
