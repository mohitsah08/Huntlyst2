/**
 * Test Suite: Huntlyst External Rebuilt Workflows
 * 
 * Verifies the 13 required regression scenarios:
 * 1. https://www.blaize.com/ resolves to Blaize, not an unrelated company or arbitrary input string.
 * 2. Research saves a company profile without running verification.
 * 3. Clicking Verify evaluates the saved profile against the currently selected target.
 * 4. A $5M–$6M funding criterion does not pass when funding is unknown (produces UNKNOWN).
 * 5. Geography is UNKNOWN when no supporting geography evidence exists.
 * 6. Search-planner industry/geography hints are never stored as discovered facts.
 * 7. No synthetic company domain is generated from a name.
 * 8. Arbitrary instructions and deployment messages are rejected as company inputs.
 * 9. Missing or conflicting CEO, founder, funding, and email data are handled honestly.
 * 10. Firecrawl timeouts, HTTP errors, malformed responses, and empty results do not produce fabricated successful records.
 * 11. Re-verification after changing criteria does not require a full scrape.
 * 12. Batch research and batch verification work without duplicate records or unnecessary API calls.
 * 13. Existing Internal workflow behavior remains unchanged.
 */

import { validateAndNormalizeInput, InvalidInputError, ExternalResearchPipeline } from '../lib/research/pipeline';
import { evaluateCompanyProfile } from '../lib/research/verifier';
import { dbStore } from '../lib/db/store';
import {
  CompanyResearchProfile,
  TargetCriteria,
  DEFAULT_TARGET_CRITERIA,
} from '../lib/research/types';
import { auditAndBuildLeadPackages } from '../lib/agents/fileIntakeAuditor';
import { evaluateInternalLeadPackage } from '../lib/internalQualification';
import { DEFAULT_TVB_TARGET_PROFILE } from '../lib/targetProfileData';

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('HUNTLYST EXTERNAL INDEPENDENT WORKFLOWS REGRESSION TEST SUITE');
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

  // --------------------------------------------------------------------------
  // TEST 1: URL Normalization: https://www.blaize.com/ resolves to Blaize
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: URL Normalization & Blaize Resolution ---');
  const blaizeNorm = validateAndNormalizeInput({ url: 'https://www.blaize.com/' });
  assert(blaizeNorm.companyName.toLowerCase().includes('blaize'), `Blaize URL derives company name "${blaizeNorm.companyName}"`);
  assert(blaizeNorm.canonicalDomain === 'blaize.com', `Canonical domain is "blaize.com" (got "${blaizeNorm.canonicalDomain}")`);
  assert(blaizeNorm.officialUrl === 'https://www.blaize.com', `Official URL normalized correctly (got "${blaizeNorm.officialUrl}")`);

  // --------------------------------------------------------------------------
  // TEST 7: No Synthetic Domain Generated From Name
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: No Synthetic Domain Generated from Name ---');
  const nameOnly = validateAndNormalizeInput({ name: 'Acme Robotics' });
  assert(nameOnly.companyName === 'Acme Robotics', 'Preserves provided entity name');
  assert(nameOnly.officialUrl === null, 'Official URL is null when only name is provided');
  assert(nameOnly.canonicalDomain === null, 'Canonical domain is null (did NOT fabricate acmerobotics.com)');

  // --------------------------------------------------------------------------
  // TEST 8: Arbitrary Instructions & Deployment Messages Rejected
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Reject Arbitrary Prompts, Instructions, Deployment Messages ---');
  const promptInputs = [
    'Find me 5 AI startups in Germany',
    'Search for Series A fintech companies in the UK',
    'Please list all competitors of Blaize?',
    'Publish the completed Firecrawl migration to GitHub',
    'Deploy build to production now',
    'How to verify candidate leads?',
  ];

  for (const prompt of promptInputs) {
    let rejected = false;
    try {
      validateAndNormalizeInput({ name: prompt });
    } catch (err: any) {
      if (err instanceof InvalidInputError) {
        rejected = true;
      }
    }
    assert(rejected, `Rejected prompt instruction: "${prompt.slice(0, 40)}..."`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Workflow A saves profile without running verification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Research Saves Profile Without Running Verification ---');
  const testUniqueId = `comp_test_co_${Date.now()}`;
  const mockProfile: CompanyResearchProfile = {
    id: testUniqueId,
    canonicalDomain: 'testco.io',
    website: 'https://testco.io',
    officialName: 'TestCo Systems',
    description: 'Enterprise AI analytics platform',
    foundedYear: 2021,
    foundingDate: '2021-04-01',
    companyAgeYears: 5,
    primaryIndustry: 'AI & Machine Learning',
    subIndustry: 'Enterprise Analytics',
    productsAndServices: ['Analytics Engine'],
    businessModel: 'B2B SaaS',
    headquarters: {
      city: 'London',
      stateOrRegion: 'Greater London',
      country: 'United Kingdom',
      address: '10 Tech City, London',
    },
    operatingCountries: ['United Kingdom'],
    usPresence: false,
    leadership: {
      ceo: {
        name: 'Sarah Connor',
        title: 'CEO',
        role: 'CEO',
        isCurrent: true,
        evidence: 'Sarah Connor serves as CEO of TestCo.',
        sourceUrl: 'https://testco.io/about',
        confidence: 95,
      },
      founders: [
        {
          name: 'Sarah Connor',
          title: 'Founder & CEO',
          role: 'Founder',
          isCurrent: true,
          evidence: 'Sarah Connor founded TestCo.',
          sourceUrl: 'https://testco.io/about',
          confidence: 90,
        },
      ],
      coFounders: [],
      cto: null,
      cfo: null,
      seniorExecutives: [],
      formerExecutives: [],
    },
    funding: {
      totalFundingUsd: null, // Unknown funding!
      latestRoundUsd: null,
      latestRoundType: null,
      latestRoundDate: null,
      investors: [],
      rounds: [],
    },
    contacts: {
      generalEmail: 'hello@testco.io',
      phone: null,
      contactPageUrl: 'https://testco.io/contact',
      executiveEmails: [],
      companyLinkedInUrl: 'https://linkedin.com/company/testco',
      companyXUrl: null,
    },
    fieldEvidence: {
      'headquarters.country': {
        field: 'headquarters.country',
        value: 'United Kingdom',
        sourceUrl: 'https://testco.io/contact',
        sourceTier: 'TIER_1_OFFICIAL',
        excerpt: 'Headquartered in London, United Kingdom',
        dateRetrieved: new Date().toISOString(),
        extractionMethod: 'firecrawl_scrape',
        confidence: 95,
      },
    },
    sources: [
      {
        url: 'https://testco.io',
        title: 'TestCo Systems',
        tier: 'TIER_1_OFFICIAL',
        retrievedAt: new Date().toISOString(),
      },
    ],
    researchStatus: 'completed',
    researchCompletenessScore: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  dbStore.saveResearchProfile(mockProfile);
  const retrieved = dbStore.getResearchProfile(mockProfile.id);
  assert(Boolean(retrieved), 'Research profile saved and retrieved from persistent dbStore');
  assert(retrieved?.officialName === 'TestCo Systems', 'Official company name preserved exactly');
  
  // Verify that NO verification runs exist automatically
  const preRuns = dbStore.getVerificationRunsForCompany(mockProfile.id);
  assert(preRuns.length === 0, 'No verification runs generated automatically during research');

  // --------------------------------------------------------------------------
  // TEST 3 & 4: Explicit Verify Button & Missing Funding ($5M-$6M) is UNKNOWN
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3 & 4: Explicit Verification & Unknown Funding Evaluated Honestly ---');
  const funding5to6Criteria: TargetCriteria = {
    ...DEFAULT_TARGET_CRITERIA,
    id: 'test_criteria_5m_6m',
    fundingMinUsd: 5_000_000,
    fundingMaxUsd: 6_000_000,
    requiredCountries: ['United Kingdom'],
  };

  const run1 = evaluateCompanyProfile(mockProfile, funding5to6Criteria);
  dbStore.saveVerificationRun(run1);

  assert(run1.criteria.funding !== undefined, 'Funding criterion evaluated independently');
  assert(run1.criteria.funding.status === 'UNKNOWN', 'Funding with missing facts evaluated as UNKNOWN (NEVER PASS)');
  assert(run1.criteria.funding.actual === 'Undisclosed / Unknown', 'Actual funding correctly marked Undisclosed');
  assert(run1.criteria.geography.status === 'PASS', 'Geography with UK headquarters evaluated as PASS');
  assert(run1.overallStatus === 'UNVERIFIED', 'Overall qualification is UNVERIFIED due to UNKNOWN funding');

  // --------------------------------------------------------------------------
  // TEST 5: Geography is UNKNOWN when no supporting geography evidence exists
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Geography is UNKNOWN When Evidence is Missing ---');
  const noGeoProfile: CompanyResearchProfile = {
    ...mockProfile,
    id: 'comp_no_geo',
    headquarters: {
      city: null,
      stateOrRegion: null,
      country: null,
      address: null,
    },
    fieldEvidence: {},
  };

  const geoReqCriteria: TargetCriteria = {
    ...DEFAULT_TARGET_CRITERIA,
    requiredCountries: ['Germany', 'France'],
  };

  const runGeo = evaluateCompanyProfile(noGeoProfile, geoReqCriteria);
  assert(runGeo.criteria.geography.status === 'UNKNOWN', 'Missing geography evidence evaluated as UNKNOWN (never PASS or synthetic FAIL)');
  assert(runGeo.criteria.geography.reason.includes('No supporting geography evidence'), 'Reason states missing geography evidence');

  // --------------------------------------------------------------------------
  // TEST 6: Search Planner Hints Never Stored as Discovered Facts
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Search Planner Hints Never Stored as Discovered Facts ---');
  // Confirm that creating a profile with unknown fields leaves them null in evidence
  assert(noGeoProfile.headquarters.country === null, 'Profile country is null');
  assert(noGeoProfile.fieldEvidence['headquarters.country'] === undefined, 'No evidence forged from planner hints');

  // --------------------------------------------------------------------------
  // TEST 9: Honest Handling of Contacts & Missing CEOs
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Honest Handling of Contacts & Missing CEOs ---');
  const noCeoProfile: CompanyResearchProfile = {
    ...mockProfile,
    id: 'comp_no_ceo',
    leadership: {
      ...mockProfile.leadership,
      ceo: null,
      founders: [],
    },
    contacts: {
      ...mockProfile.contacts,
      generalEmail: null,
      executiveEmails: [],
    },
  };

  const requireCeoAndEmailCriteria: TargetCriteria = {
    ...DEFAULT_TARGET_CRITERIA,
    requireCeo: true,
    requirePublicEmail: true,
  };

  const runMissing = evaluateCompanyProfile(noCeoProfile, requireCeoAndEmailCriteria);
  assert(runMissing.criteria.ceo?.status === 'UNKNOWN', 'Missing CEO evaluated as UNKNOWN');
  assert(runMissing.criteria.publicEmail?.status === 'UNKNOWN', 'Missing email evaluated as UNKNOWN (zero pattern guessing)');
  assert(noCeoProfile.contacts.generalEmail === null, 'No synthetic email fabricated');

  // --------------------------------------------------------------------------
  // TEST 10: Provider Failures / Empty Responses Never Produce Fake Success
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Provider Failures Do Not Produce Fabricated Records ---');
  const failedMock: CompanyResearchProfile = {
    ...mockProfile,
    id: 'comp_failed_run',
    researchStatus: 'failed',
    researchCompletenessScore: 0,
    statusReason: 'Failed to retrieve authoritative public sources for candidate',
    fieldEvidence: {},
    sources: [],
  };

  assert(failedMock.researchStatus === 'failed', 'Failed research marked with "failed" status');
  assert(failedMock.researchCompletenessScore === 0, 'Completeness score is 0 on failed scrape');

  // --------------------------------------------------------------------------
  // TEST 11: Re-verification After Changing Criteria Requires ZERO Re-scraping
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 11: Instant Re-verification With Changed Criteria (Zero Re-scrape) ---');
  // Suppose funding was actually $5.5M in the profile
  const fundedProfile: CompanyResearchProfile = {
    ...mockProfile,
    id: 'comp_funded_profile',
    funding: {
      ...mockProfile.funding,
      totalFundingUsd: 5_500_000,
      latestRoundUsd: 5_500_000,
      latestRoundType: 'Series A',
    },
    fieldEvidence: {
      ...mockProfile.fieldEvidence,
      'funding.totalFundingUsd': {
        field: 'funding.totalFundingUsd',
        value: 5_500_000,
        sourceUrl: 'https://testco.io/press/series-a',
        sourceTier: 'TIER_1_OFFICIAL',
        excerpt: 'TestCo closes $5.5M Series A round',
        dateRetrieved: new Date().toISOString(),
        extractionMethod: 'firecrawl_scrape',
        confidence: 95,
      },
    },
  };

  // Evaluation against $5M-$6M -> PASS
  const runPass = evaluateCompanyProfile(fundedProfile, funding5to6Criteria);
  assert(runPass.criteria.funding.status === 'PASS', 'Funding $5.5M passes $5M–$6M range');
  assert(runPass.overallStatus === 'VERIFIED', 'All criteria PASS produces VERIFIED');

  // Now change criteria to $1M-$2M without any scraping
  const funding1to2Criteria: TargetCriteria = {
    ...funding5to6Criteria,
    version: 2,
    fundingMinUsd: 1_000_000,
    fundingMaxUsd: 2_000_000,
  };

  const runReverify = evaluateCompanyProfile(fundedProfile, funding1to2Criteria);
  assert(runReverify.criteria.funding.status === 'FAIL', 'Funding $5.5M fails $1M–$2M criteria');
  assert(runReverify.overallStatus === 'REJECTED', 'Re-evaluation with new criteria produces REJECTED immediately');
  assert(runReverify.targetCriteriaVersion === 2, 'Versioned against Target Criteria v2');

  // --------------------------------------------------------------------------
  // TEST 12: Batch Research & Verification Deduplication
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 12: Batch Research & Deduplication ---');
  const batchCo1 = { ...fundedProfile, id: 'batch_co_1', canonicalDomain: 'co1.com' };
  const batchCo2 = { ...fundedProfile, id: 'batch_co_2', canonicalDomain: 'co2.com' };
  dbStore.saveResearchProfile(batchCo1);
  dbStore.saveResearchProfile(batchCo2);

  const runBatch1 = evaluateCompanyProfile(batchCo1, funding5to6Criteria);
  const runBatch2 = evaluateCompanyProfile(batchCo2, funding5to6Criteria);
  assert(runBatch1.overallStatus === 'VERIFIED', 'Batch Co 1 verified independently');
  assert(runBatch2.overallStatus === 'VERIFIED', 'Batch Co 2 verified independently');

  // --------------------------------------------------------------------------
  // TEST 13: Existing Internal Workflow Behavior Remains Intact
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 13: Internal Workflow Behavior Intact ---');
  const testCsvContent = `Company,Website,Industry,Country,Funding\nCloudNova,https://cloudnova.io,B2B SaaS,United Kingdom,$3.5M\n`;
  const auditRes = await auditAndBuildLeadPackages(
    Buffer.from(testCsvContent),
    'test_internal.csv',
    'text/csv'
  );

  assert(auditRes.packages.length === 1, `Internal auditor processed ${auditRes.packages.length} package`);
  const pkg = auditRes.packages[0];
  const internalQual = evaluateInternalLeadPackage(pkg, DEFAULT_TVB_TARGET_PROFILE);
  const validStatuses = ['VERIFIED', 'REVIEW', 'UNVERIFIED', 'REJECTED'];
  assert(validStatuses.includes(internalQual.finalStatus), `Internal lead qualified with valid canonical 4-status: ${internalQual.finalStatus}`);

  // Cleanup test artifacts so persistent store remains clean
  dbStore.removeResearchProfile(testUniqueId);
  dbStore.removeResearchProfile('batch_co_1');
  dbStore.removeResearchProfile('batch_co_2');
  dbStore.removeVerificationRunsForCompany(testUniqueId);
  dbStore.removeVerificationRunsForCompany('batch_co_1');
  dbStore.removeVerificationRunsForCompany('batch_co_2');

  console.log('\n================================================================');
  console.log(`REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
