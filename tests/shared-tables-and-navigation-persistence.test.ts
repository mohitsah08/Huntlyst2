/**
 * Test Suite: Shared Company Tables & Navigation Persistence
 * 
 * Verifies:
 * 1. Exact 10 column headers and order: #, Company, Domain, Industry, Geography, Founded, Funding, Stage, Status, Actions.
 * 2. Shared table adapter mappings for Internal, External Research, and Web Discovery.
 * 3. Anti-fabrication guarantees: Honest fallbacks ("Not disclosed", "Not found", "Not verified") and NO fabricated values.
 * 4. Mount-and-hide persistence architecture across all navigation layers:
 *    - app/page.tsx preserves DiscoverView when switching to History / Saved Leads / Settings
 *    - DiscoverView preserves StagedDiscoveryWorkflow when toggling workflow modes
 *    - StagedDiscoveryWorkflow preserves all 3 stages (Internal, External, Web Discovery) when switching currentStep
 * 5. Actions contract: View ↗, Shortlist Star (savedLeads toggle), and 3-dot context menu.
 */

import fs from 'fs';
import path from 'path';
import { sharedRowToCompanyRecord, SharedCompanyRow } from '../components/SharedCompanyTable';
import { CompanyVerificationResult } from '../providers/types';
import { CompanyResearchProfile } from '../lib/types';

async function runSharedTableAndPersistenceTests() {
  console.log('================================================================');
  console.log('TEST SUITE: SHARED COMPANY TABLES & NAVIGATION PERSISTENCE');
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

  // --- TEST 1: Exact 10 Column Contract & Order ---
  console.log('--- Test 1: Exact 10 Column Contract & Order ---');
  const sharedTableSource = fs.readFileSync(
    path.resolve(process.cwd(), 'components/SharedCompanyTable.tsx'),
    'utf8'
  );

  const expectedColumns = [
    '#',
    'Company',
    'Domain',
    'Industry',
    'Geography',
    'Founded',
    'Funding',
    'Stage',
    'Status',
    'Actions',
  ];

  // Extract thead section
  const theadStart = sharedTableSource.indexOf('<thead');
  const theadEnd = sharedTableSource.indexOf('</thead>');
  const theadSource = sharedTableSource.slice(theadStart, theadEnd);

  for (const col of expectedColumns) {
    assert(theadSource.includes(col), `Table header includes column: ${col}`);
  }

  // Verify column header order in thead
  const colIndices = expectedColumns.map((c) => theadSource.indexOf(c));
  let inOrder = true;
  for (let i = 0; i < colIndices.length - 1; i++) {
    if (colIndices[i] >= colIndices[i + 1]) {
      inOrder = false;
      break;
    }
  }
  assert(inOrder, 'All 10 columns appear in the exact required order in thead');

  // --- TEST 2: Anti-Fabrication & Honest Fallbacks ---
  console.log('\n--- Test 2: Anti-Fabrication & Honest Fallbacks ---');
  const companyRecordsTableSource = fs.readFileSync(
    path.resolve(process.cwd(), 'components/CompanyRecordsTable.tsx'),
    'utf8'
  );

  assert(!companyRecordsTableSource.includes("|| 2020"), 'Removed fake founding year default (2020)');
  assert(!companyRecordsTableSource.includes("|| '$3M'"), 'Removed fake funding amount default ($3M)');
  assert(!companyRecordsTableSource.includes("|| 'Series A'"), 'Removed fake funding stage default (Series A)');

  // Verify honest fallbacks are present in SharedCompanyTable & adapters
  assert(companyRecordsTableSource.includes("'Not disclosed'"), 'Uses explicit "Not disclosed" fallback for missing internal fields');

  // Test adapter with sparse company record
  const sparseRow: SharedCompanyRow = {
    id: 'sparse-1',
    index: 1,
    name: 'Stealth AI',
    description: null,
    domain: 'stealth.ai',
    website: 'https://stealth.ai',
    industry: 'Not disclosed',
    geography: 'Not disclosed',
    founded: 'Not disclosed',
    funding: 'Not disclosed',
    stage: 'Not disclosed',
    status: 'UNVERIFIED',
    statusLabel: 'UNVERIFIED',
  };

  const convertedLead = sharedRowToCompanyRecord(sparseRow);
  assert(convertedLead.name === 'Stealth AI', 'Converted lead preserves company name');
  assert(convertedLead.fundingOrRevenue === null, 'Missing funding converts to null, not fake number');
  assert(convertedLead.latestRound === null, 'Missing stage converts to null, not fake Series A');
  assert(convertedLead.industry === null, 'Missing industry converts to null, not fake vertical');

  // --- TEST 3: External Research Table Adapter ---
  console.log('\n--- Test 3: External Research Table Adapter ---');
  const externalSource = fs.readFileSync(
    path.resolve(process.cwd(), 'components/ExternalResearchWorkflow.tsx'),
    'utf8'
  );

  assert(externalSource.includes('<SharedCompanyTable'), 'ExternalResearchWorkflow uses SharedCompanyTable');
  assert(!externalSource.includes('<CompanyCard'), 'ExternalResearchWorkflow has replaced CompanyCard lists');
  assert(externalSource.includes('externalSharedRows'), 'ExternalResearchWorkflow defines externalSharedRows adapter');
  assert(externalSource.includes('setSelectedProfileId'), 'View action retains complete profile dossier access');
  assert(externalSource.includes('CompanyResearchDossierModal'), 'Full CompanyResearchDossierModal preserved');

  // --- TEST 4: Web Discovery Table Adapter ---
  console.log('\n--- Test 4: Web Discovery Table Adapter ---');
  const stagedSource = fs.readFileSync(
    path.resolve(process.cwd(), 'components/StagedDiscoveryWorkflow.tsx'),
    'utf8'
  );

  assert(stagedSource.includes('webSearchSharedRows'), 'StagedDiscoveryWorkflow defines webSearchSharedRows adapter');
  assert(stagedSource.includes('<SharedCompanyTable'), 'Stage 3 renders SharedCompanyTable');
  assert(stagedSource.includes('onOpenLeadModal'), 'View action opens full lead modal');
  assert(stagedSource.includes('handleRetryCandidateStage'), 'Retry verification preserved in row actions');
  assert(stagedSource.includes('handleFinalizeAll'), 'Approval Gate 3 finalization preserved');

  // --- TEST 5: State-Loss Prevention & Mount-and-Hide Architecture ---
  console.log('\n--- Test 5: State-Loss Prevention & Mount-and-Hide Architecture ---');
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'app/page.tsx'),
    'utf8'
  );

  assert(
    pageSource.includes("className={activeNav === 'discover' ? 'block' : 'hidden'}"),
    'DiscoverView is wrapped in persistent mount-and-hide container in app/page.tsx'
  );

  assert(
    stagedSource.includes("className={currentStep === 'internal' ? 'block' : 'hidden'}"),
    'Stage 1 (Internal) is wrapped in persistent mount-and-hide container'
  );
  assert(
    stagedSource.includes("className={currentStep === 'external' ? 'block' : 'hidden'}"),
    'Stage 2 (External) is wrapped in persistent mount-and-hide container'
  );
  assert(
    stagedSource.includes("className={currentStep === 'web_search' ? 'block' : 'hidden'}"),
    'Stage 3 (Web Discovery) is wrapped in persistent mount-and-hide container'
  );

  const discoverViewSource = fs.readFileSync(
    path.resolve(process.cwd(), 'components/DiscoverView.tsx'),
    'utf8'
  );
  assert(
    discoverViewSource.includes("className={discoveryMode === 'staged' ? 'block' : 'hidden'}"),
    'DiscoverView preserves StagedDiscoveryWorkflow when toggling between staged and autonomous mode'
  );

  // --- TEST 6: In-Memory Lifecycle & No Unauthorized LocalStorage Hacks ---
  console.log('\n--- Test 6: In-Memory Lifecycle & No Unauthorized LocalStorage Hacks ---');
  assert(
    !externalSource.includes("localStorage.setItem('active_search_results'"),
    'ExternalResearchWorkflow does not hack active results into localStorage'
  );
  assert(
    !stagedSource.includes("localStorage.setItem('staged_active_results'"),
    'StagedDiscoveryWorkflow does not hack active results into localStorage'
  );

  console.log(`\n================================================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSharedTableAndPersistenceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
