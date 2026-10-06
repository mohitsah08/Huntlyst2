/**
 * Test Suite: Unified Lead Store & Internal + External Deduplication Merge
 * Verifies Requirements 13, 14, 15, 16, 26:
 * - One canonical unified lead record per company
 * - Merges company ABC when first processed in Internal, then researched in External
 * - Does NOT create two separate rows for ABC
 * - Sets origin to 'INTERNAL + EXTERNAL' (BOTH)
 * - Updates current status (e.g. Internal VERIFIED -> External REVIEW)
 * - Preserves complete chronological history: Internal VERIFIED, External REVIEW
 * - Preserves both Internal source package and External live evidence
 */

import { unifiedLeadStore } from '../lib/unifiedLeadStore';
import { LeadPackage } from '../lib/leadPackage';
import { CompanyVerificationResult } from '../providers/types';
import { DEFAULT_TVB_TARGET_PROFILE } from '../lib/targetProfileData';

function buildInternalPackageABC(): LeadPackage {
  return {
    candidate_id: 'pkg-abc-tech',
    source: {
      file_name: 'internal_batch_may.csv',
      file_type: 'text/csv',
      row_number: 14,
    },
    seed_data: {
      raw_fields: {
        'Company Name': 'ABC Technologies',
        Website: 'https://abctechnologies.com',
        Location: 'Berlin, Germany',
        Funding: '$3,500,000',
        CEO: 'Alice Miller',
      },
      normalized: {
        company_name: 'ABC Technologies',
        website: 'https://abctechnologies.com',
        canonical_domain: 'abctechnologies.com',
        country: 'Germany',
        city: 'Berlin',
        funding: '$3,500,000',
        funding_amount_usd: 3500000,
        founder_or_ceo: 'Alice Miller',
        company_email: 'hello@abctechnologies.com',
        company_linkedin: null,
        ceo_linkedin: null,
        industry: 'Enterprise Software',
      },
    },
    audit: {
      fields_present: ['Company Name', 'Website', 'Location', 'Funding', 'CEO'],
      fields_missing: [],
      placeholders: [],
      malformed_fields: [],
      duplicate_signals: [],
    },
  };
}

function buildExternalResultABC(): CompanyVerificationResult {
  return {
    company: {
      name: 'ABC Technologies Inc',
      website: 'https://www.abctechnologies.com',
      industry: 'Enterprise Software',
      country: 'Germany',
      fundingOrRevenue: '$3.5M',
      fundingAmountUSD: 3500000,
      founderOrCeoName: 'Alice Miller',
      primaryEmail: 'alice@abctechnologies.com',
      emailStatus: 'VERIFIED',
      decisionMakerRole: 'CEO & Founder',
    },
    verificationStatus: 'REVIEW',
    sources: ['https://abctechnologies.com', 'https://techcrunch.com/funding-round'],
    passedCriteria: ['Platform Required', 'Geography Target', 'Funding Range'],
    failedCriteria: [],
    unknownCriteria: ['Executive LinkedIn URL missing public evidence'],
    criteria: {
      funding: {
        name: 'Funding Range',
        status: 'PASS',
        confidence: 0.95,
        source: 'https://techcrunch.com',
        value: '$3.5M',
      },
      identity: {
        name: 'Executive Role',
        status: 'UNKNOWN',
        confidence: 0.5,
        source: 'https://abctechnologies.com',
        value: 'Ambiguous LinkedIn profile match',
      },
    },
  };
}

async function runUnifiedMergeTests() {
  console.log('================================================================');
  console.log('UNIFIED INTERNAL + EXTERNAL DEDUPLICATION MERGE TESTS');
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

  // Clear store for clean run
  unifiedLeadStore.clear();

  // --- STEP 1: RUN INTERNAL WITH COMPANY ABC ---
  console.log('--- Step 1: Ingest ABC Technologies via Internal Workflow ---');
  const internalPackage = buildInternalPackageABC();
  const leadInternal = unifiedLeadStore.upsertLeadFromInternal(internalPackage, DEFAULT_TVB_TARGET_PROFILE);

  assert(leadInternal.id.length > 0, 'Internal lead package created with canonical ID');
  assert(leadInternal.identity.company_name === 'ABC Technologies', 'Company name matches internal source');
  assert(leadInternal.origins.length === 1 && leadInternal.origins[0] === 'INTERNAL', 'Origin is exclusively INTERNAL initially');
  assert(leadInternal.originDisplay === 'INTERNAL', 'originDisplay is "INTERNAL"');
  assert(leadInternal.currentStatus === 'VERIFIED', `Internal qualification status is VERIFIED (got ${leadInternal.currentStatus})`);
  assert(leadInternal.internal?.source_file === 'internal_batch_may.csv', 'Internal snapshot preserves original source file name');
  assert(leadInternal.internal?.source_row === 14, 'Internal snapshot preserves source row number');
  assert(leadInternal.statusHistory.length === 1, 'Status history has initial Internal entry');
  assert(leadInternal.statusHistory[0].source === 'INTERNAL_AUTO', 'Initial status history source is INTERNAL_AUTO');

  const leadsAfterInternal = unifiedLeadStore.getAllLeads();
  assert(leadsAfterInternal.length === 1, `Store contains exactly 1 row after Internal ingestion (found ${leadsAfterInternal.length})`);

  // --- STEP 2: SEND ABC TO EXTERNAL & RESEARCH ---
  console.log('\n--- Step 2: Research ABC Technologies via External Workflow ---');
  const externalResult = buildExternalResultABC();
  const mergedLead = unifiedLeadStore.upsertLeadFromExternal(externalResult, DEFAULT_TVB_TARGET_PROFILE);

  // --- STEP 3: ASSERT UNIFIED CANONICAL MERGE (REQUIREMENT 26) ---
  console.log('\n--- Step 3: Assert Canonical Deduplication & Provenance Merge ---');

  // Critical Assertion: Exactly ONE row in store
  const allLeadsFinal = unifiedLeadStore.getAllLeads();
  assert(allLeadsFinal.length === 1, `CRITICAL: Store contains exactly ONE unified ABC row, NOT two separate rows (found ${allLeadsFinal.length})`);

  // Same canonical ID preserved
  assert(mergedLead.id === leadInternal.id, `Canonical lead ID preserved across Internal and External (${mergedLead.id})`);

  // Provenance updated to BOTH
  assert(mergedLead.origins.includes('INTERNAL') && mergedLead.origins.includes('EXTERNAL'), 'Origins array contains both INTERNAL and EXTERNAL');
  assert(mergedLead.originDisplay === 'BOTH', `originDisplay shows "BOTH" (INTERNAL + EXTERNAL) (got ${mergedLead.originDisplay})`);

  // Current status updated to External REVIEW
  assert(mergedLead.currentStatus === 'REVIEW', `Current status updated to External REVIEW (got ${mergedLead.currentStatus})`);

  // History preserves both decisions chronologically
  assert(mergedLead.statusHistory.length === 2, `Status history preserved both events chronologically (length ${mergedLead.statusHistory.length})`);
  assert(mergedLead.statusHistory[0].status === 'VERIFIED' && mergedLead.statusHistory[0].source === 'INTERNAL_AUTO', 'History step 1: Internal VERIFIED');
  assert(mergedLead.statusHistory[1].status === 'REVIEW' && mergedLead.statusHistory[1].source === 'EXTERNAL_AUTO', 'History step 2: External REVIEW');

  // Data preservation
  assert(mergedLead.internal?.source_file === 'internal_batch_may.csv', 'Internal raw source file retained untouched');
  assert(mergedLead.external?.researched === true, 'External research flag is true');
  assert(mergedLead.external?.evidence.sources.length === 2, 'External research evidence sources retained');

  // --- STEP 4: FILTERING TESTS (BY ORIGIN AND STATUS) ---
  console.log('\n--- Step 4: Test Unified Origin & Status Filtering ---');
  const bothFilter = unifiedLeadStore.getLeads({ origin: 'BOTH' });
  assert(bothFilter.length === 1, 'Filter by origin BOTH finds the unified lead');

  const internalFilter = unifiedLeadStore.getLeads({ origin: 'INTERNAL' });
  assert(internalFilter.length === 1, 'Filter by origin INTERNAL finds the unified lead (since it participated in Internal)');

  const externalFilter = unifiedLeadStore.getLeads({ origin: 'EXTERNAL' });
  assert(externalFilter.length === 1, 'Filter by origin EXTERNAL finds the unified lead (since it participated in External)');

  const reviewFilter = unifiedLeadStore.getLeads({ status: 'REVIEW' });
  assert(reviewFilter.length === 1, 'Filter by status REVIEW finds the unified lead');

  const verifiedFilter = unifiedLeadStore.getLeads({ status: 'VERIFIED' });
  assert(verifiedFilter.length === 0, 'Filter by status VERIFIED finds 0 leads because current status was updated to REVIEW');

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} UNIFIED LEAD MERGE & DEDUPLICATION TESTS PASSED!`);
  } else {
    console.error(`💥 ${failed} TESTS FAILED out of ${passed + failed}`);
    process.exit(1);
  }
  console.log('================================================================');
}

runUnifiedMergeTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
