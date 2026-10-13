/**
 * Test Suite: Internal Workflow — Phase 1 File Import, Parsing, Normalization & Company Preview
 * 
 * Verifies:
 * 1. Local-Only Processing (ZERO network calls / Zero external API calls)
 * 2. Supported Formats: CSV (.csv), Excel (.xlsx, .xls), Markdown (.md)
 * 3. Unsupported Format & Malformed File Handling (PDF rejection, empty files, missing headers)
 * 4. Flexible Header Matching (Case, spacing, synonyms)
 * 5. 100% Preservation of raw fields and unmapped columns
 * 6. Non-Hallucination: Never invents missing data or appends fake domains
 * 7. 4-State Availability Classification: AVAILABLE, MISSING, INVALID, AMBIGUOUS
 * 8. Handling of paywall/placeholders ("UPGRADE TO UNLOCK", "N/A", "TBD", etc.)
 * 9. Handling of empty rows without creating fake companies
 * 10. Accurate Global and Per-Field Summary Metrics
 */

import * as XLSX from 'xlsx';
import { processPhase1File } from '../lib/internal/phase1Parser';
import { extractCleanDomain, mapColumnHeaders } from '../lib/internal/phase1Normalizer';

async function runPhase1Tests() {
  console.log('================================================================');
  console.log('PHASE 1: INTERNAL WORKFLOW FILE IMPORT & PREVIEW TESTS');
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

  // --- 1. SETUP NETWORK CALL INTERCEPTOR (STRICT ZERO NETWORK REQUIREMENT) ---
  let networkCallCount = 0;
  const originalFetch = global.fetch;
  (global as any).fetch = async (url: string | URL | Request, init?: any) => {
    networkCallCount++;
    throw new Error(`CRITICAL VIOLATION: Network fetch attempted during Phase 1 local processing: ${url.toString()}`);
  };

  try {
    // =========================================================================
    // TEST 1: CSV IMPORT WITH SYNONYMOUS HEADERS, CLEAN DATA & UNMAPPED COLUMNS
    // =========================================================================
    console.log('\n--- Test 1: CSV Import & Canonical Field Mapping ---');
    const sampleCsv = `Legal Name,Company URL,Vertical,Headquarters,Year Established,Growth Stage,Total Raised,Recent Funding Amount,Round,Custom Notes,Internal Score
Acme AI,https://acme.ai,AI & Machine Learning,France,2021,Growth,$12.5M,$4M,Series A,High potential,95
Beta Corp,beta.de,SaaS,Germany,2018,Early Stage,€5,000,000,€1.5M,Seed,Reviewed by team,80
`;

    const csvResult = await processPhase1File(sampleCsv, 'companies.csv');

    assert(csvResult.fileType === 'CSV', 'Correctly identified CSV format');
    assert(csvResult.totalCompanies === 2, `Extracted 2 companies (got ${csvResult.totalCompanies})`);
    assert(csvResult.emptyRowsSkipped === 0, 'No empty rows skipped for clean CSV');
    assert(csvResult.detectedColumns.length === 11, `Detected all 11 columns (got ${csvResult.detectedColumns.length})`);

    // Verify unmapped columns are preserved
    assert(csvResult.unmappedColumns.includes('Custom Notes'), 'Unmapped column "Custom Notes" preserved in unmappedColumns');
    assert(csvResult.unmappedColumns.includes('Internal Score'), 'Unmapped column "Internal Score" preserved in unmappedColumns');

    const firstComp = csvResult.companies[0];
    assert(firstComp.canonicalFields.companyName.value === 'Acme AI', 'Company name normalized correctly');
    assert(firstComp.canonicalFields.companyName.status === 'AVAILABLE', 'Company name status is AVAILABLE');
    assert(firstComp.canonicalFields.website.value === 'https://acme.ai', 'Website normalized with https:// protocol');
    assert(firstComp.canonicalFields.canonicalDomain.value === 'acme.ai', 'Canonical domain extracted as acme.ai');
    assert(firstComp.canonicalFields.industry.value === 'AI & Machine Learning', 'Industry mapped from "Vertical"');
    assert(firstComp.canonicalFields.geography.value === 'France', 'Geography mapped from "Headquarters"');
    assert(firstComp.canonicalFields.foundingYear.value === 2021, 'Founding year mapped from "Year Established" as 2021');
    assert(firstComp.canonicalFields.companyAge.value !== null && firstComp.canonicalFields.companyAge.status === 'AVAILABLE', 'Company age derived from founding year');
    assert(firstComp.canonicalFields.totalFundingAmount.value === '$12,500,000', 'Total funding normalized to $12,500,000');
    assert(firstComp.canonicalFields.latestFundingRoundAmount.value === '$4,000,000', 'Latest round amount normalized to $4,000,000');
    assert(firstComp.canonicalFields.fundingStage.value === 'Series A', 'Funding stage mapped from "Round"');

    // Check untouched raw fields
    assert(firstComp.rawFields['Custom Notes'] === 'High potential', 'Raw field "Custom Notes" preserved untouched');
    assert(firstComp.unmappedFields['Custom Notes'] === 'High potential', 'Unmapped field "Custom Notes" separated');

    // =========================================================================
    // TEST 2: 4-STATE FIELD AVAILABILITY (AVAILABLE, MISSING, INVALID, AMBIGUOUS)
    // =========================================================================
    console.log('\n--- Test 2: Field Availability Auditing (Placeholders & Invalid Data) ---');
    const dirtyCsv = `Company Name,Website,Industry,Geography,Founding Year,Company Age,Total Funding,Funding Stage
ValidCo,https://valid.co,FinTech,United Kingdom,2020,6,$10M,Series A
PaywalledCo,UPGRADE TO UNLOCK,N/A,Global,1995,UPGRADE TO UNLOCK,Undisclosed,TBD
InvalidCo,invalid-url-without-dot,HealthTech,Spain,2099,-5,-$2M,Seed
MissingCo,,,,,,,
,,,,,,,
`;

    const dirtyResult = await processPhase1File(dirtyCsv, 'dirty_leads.csv');

    assert(dirtyResult.totalCompanies === 4, `Extracted 4 companies (got ${dirtyResult.totalCompanies})`);
    assert(dirtyResult.emptyRowsSkipped >= 1, `Empty row correctly identified and skipped (got ${dirtyResult.emptyRowsSkipped})`);

    const validCo = dirtyResult.companies.find(c => c.canonicalFields.companyName.value === 'ValidCo')!;
    assert(validCo !== undefined, 'ValidCo present');
    assert(validCo.summary.readiness === 'READY', 'ValidCo classified as READY');

    const missingCo = dirtyResult.companies.find(c => c.canonicalFields.companyName.value === 'MissingCo')!;
    assert(missingCo !== undefined, 'MissingCo present');
    assert(missingCo.canonicalFields.companyName.status === 'AVAILABLE', 'MissingCo name is AVAILABLE');
    assert(missingCo.canonicalFields.website.status === 'MISSING', 'MissingCo website is MISSING');
    assert(missingCo.canonicalFields.industry.status === 'MISSING', 'MissingCo industry is MISSING');
    assert(missingCo.canonicalFields.geography.status === 'MISSING', 'MissingCo geography is MISSING');
    assert(missingCo.canonicalFields.totalFundingAmount.status === 'MISSING', 'MissingCo funding is MISSING');

    const paywalledCo = dirtyResult.companies.find(c => c.canonicalFields.companyName.value === 'PaywalledCo')!;
    assert(paywalledCo !== undefined, 'PaywalledCo present');
    assert(paywalledCo.canonicalFields.website.status === 'AMBIGUOUS', 'Paywall placeholder in Website classified as AMBIGUOUS');
    assert(paywalledCo.canonicalFields.website.issues.length > 0, 'Paywall issue recorded for website');
    assert(paywalledCo.canonicalFields.industry.status === 'AMBIGUOUS', '"N/A" in Industry classified as AMBIGUOUS');
    assert(paywalledCo.canonicalFields.geography.status === 'AMBIGUOUS', '"Global" geography classified as AMBIGUOUS');
    assert(paywalledCo.canonicalFields.totalFundingAmount.status === 'AMBIGUOUS', '"Undisclosed" funding classified as AMBIGUOUS');
    assert(paywalledCo.canonicalFields.fundingStage.status === 'AMBIGUOUS', '"TBD" stage classified as AMBIGUOUS');

    const invalidCo = dirtyResult.companies.find(c => c.canonicalFields.companyName.value === 'InvalidCo')!;
    assert(invalidCo !== undefined, 'InvalidCo present');
    assert(invalidCo.canonicalFields.website.status === 'INVALID', 'URL missing dot classified as INVALID');
    assert(invalidCo.canonicalFields.foundingYear.status === 'INVALID', 'Future founding year (2099) classified as INVALID');
    assert(invalidCo.canonicalFields.companyAge.status === 'INVALID', 'Negative company age (-5) classified as INVALID');
    assert(invalidCo.canonicalFields.totalFundingAmount.status === 'INVALID', 'Negative funding amount classified as INVALID');
    assert(invalidCo.summary.readiness === 'ATTENTION_NEEDED', 'InvalidCo classified as ATTENTION_NEEDED');

    // =========================================================================
    // TEST 3: EXCEL (.XLSX & .XLS) PARSING WITH REAL SHEETJS BINARY DATA
    // =========================================================================
    console.log('\n--- Test 3: Excel (.xlsx and .xls) In-Memory Parsing ---');
    const workbook = XLSX.utils.book_new();
    const worksheetData = [
      ['Organization', 'Domain', 'Category', 'Country', 'Founded', 'Total Raised', 'Investment Stage'],
      ['Stripe', 'stripe.com', 'FinTech', 'Ireland', 2010, '$8.7B', 'Late Stage'],
      ['Revolut', 'revolut.com', 'Banking', 'United Kingdom', 2015, '$1.7B', 'Series E'],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Portfolio');

    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const xlsxResult = await processPhase1File(xlsxBuffer, 'fintech_companies.xlsx');

    assert(xlsxResult.fileType === 'XLSX', 'Correctly identified XLSX format');
    assert(xlsxResult.totalCompanies === 2, `Extracted 2 companies from XLSX (got ${xlsxResult.totalCompanies})`);
    assert(xlsxResult.companies[0].canonicalFields.companyName.value === 'Stripe', 'Stripe parsed correctly from XLSX');
    assert(xlsxResult.companies[0].canonicalFields.canonicalDomain.value === 'stripe.com', 'Domain parsed from XLSX');
    assert(xlsxResult.companies[1].canonicalFields.companyName.value === 'Revolut', 'Revolut parsed correctly from XLSX');

    // Test legacy .xls extension
    const xlsBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
    const xlsResult = await processPhase1File(xlsBuffer, 'legacy_portfolio.xls');
    assert(xlsResult.fileType === 'XLS', 'Correctly identified legacy XLS format');
    assert(xlsResult.totalCompanies === 2, 'Extracted companies from legacy XLS');

    // =========================================================================
    // TEST 4: MARKDOWN (.MD) TABLE PARSING
    // =========================================================================
    console.log('\n--- Test 4: Markdown (.md) Table and Section Parsing ---');
    const sampleMarkdownTable = `
# European AI Startups

| Company Name | Website | Industry | Country | Founding Year | Total Funding | Stage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Mistral AI | https://mistral.ai | Generative AI | France | 2023 | $500M | Series A | Open source models |
| DeepL | https://deepl.com | Machine Translation | Germany | 2017 | $100M | Growth | Language AI |
| Synthesized | https://synthesized.io | Data Generation | United Kingdom | 2018 | $4.2M | Series A | Privacy tech |
`;

    const mdResult = await processPhase1File(sampleMarkdownTable, 'startups.md');
    assert(mdResult.fileType === 'MARKDOWN', 'Correctly identified Markdown format');
    assert(mdResult.totalCompanies === 3, `Extracted 3 companies from Markdown table (got ${mdResult.totalCompanies})`);
    assert(mdResult.companies[0].canonicalFields.companyName.value === 'Mistral AI', 'Mistral AI parsed from markdown');
    assert(mdResult.companies[0].canonicalFields.canonicalDomain.value === 'mistral.ai', 'Domain extracted from markdown URL');
    assert(mdResult.companies[0].canonicalFields.foundingYear.value === 2023, 'Founding year 2023 parsed from markdown');
    assert(mdResult.companies[1].canonicalFields.companyName.value === 'DeepL', 'DeepL parsed from markdown');
    assert(mdResult.companies[2].canonicalFields.companyName.value === 'Synthesized', 'Synthesized parsed from markdown');
    assert(mdResult.unmappedColumns.includes('Notes'), 'Unmapped column "Notes" preserved from markdown');

    // =========================================================================
    // TEST 5: UNSUPPORTED FORMAT & MALFORMED FILE HANDLING
    // =========================================================================
    console.log('\n--- Test 5: Rejection of Unsupported Formats (PDF, OCR) & Empty Files ---');
    const pdfRejection = await processPhase1File('dummy-pdf-content', 'portfolio.pdf');
    assert(pdfRejection.fileType === 'UNSUPPORTED', 'PDF rejected with UNSUPPORTED type');
    assert(pdfRejection.errors.length > 0, 'Error returned for PDF');
    assert(pdfRejection.errors[0].message.includes('PDF parsing'), 'Clear message explaining PDF is out of scope for Phase 1');

    const emptyResult = await processPhase1File('', 'empty.csv');
    assert(emptyResult.totalCompanies === 0, 'Empty file produces 0 companies');
    assert(emptyResult.errors.some(e => e.message.includes('empty')), 'Clear error message for empty file');

    // =========================================================================
    // TEST 6: NON-HALLUCINATION / NO FABRICATED DATA
    // =========================================================================
    console.log('\n--- Test 6: Non-Hallucination Invariants ---');
    const namelessCsv = `Company Name,Website
NoWebsiteInc,
,https://noname.org
`;
    const noHalResult = await processPhase1File(namelessCsv, 'test.csv');
    const noWebComp = noHalResult.companies.find(c => c.canonicalFields.companyName.value === 'NoWebsiteInc')!;
    assert(noWebComp.canonicalFields.website.value === null, 'Never hallucinates website URL by appending .com to business name');
    assert(noWebComp.canonicalFields.website.status === 'MISSING', 'Website remains MISSING when not provided');
    assert(noWebComp.canonicalFields.geography.value === null, 'Never hallucinates missing geography');
    assert(noWebComp.canonicalFields.geography.status === 'MISSING', 'Geography remains MISSING when not provided');

    // =========================================================================
    // TEST 7: NETWORK INDEPENDENCE VERIFICATION
    // =========================================================================
    console.log('\n--- Test 7: Network Call Independence Verification ---');
    assert(networkCallCount === 0, `ZERO network calls occurred across all file intake and preview tests (got ${networkCallCount})`);

    // Global summary check
    assert(csvResult.globalSummary.totalCompanies === 2, 'Global summary totalCompanies matches');
    assert(csvResult.globalSummary.totalAvailableFields > 0, 'Global summary contains available field counts');

  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} PHASE 1 PREVIEW ACCEPTANCE TESTS PASSED!`);
  } else {
    console.error(`❌ ${failed} TESTS FAILED out of ${passed + failed}`);
    process.exit(1);
  }
}

runPhase1Tests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
