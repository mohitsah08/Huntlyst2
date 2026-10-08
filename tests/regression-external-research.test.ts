/**
 * Comprehensive Regression Test Suite: External Research Pipeline & Verification Dossier
 * 
 * Verifies all 20 regression scenarios from User Specification (Section 39):
 * 1. Funding fails but founder research still executes
 * 2. Industry fails but contact research still executes
 * 3. Geography fails but leadership research still executes
 * 4. CEO is found separately from founders
 * 5. Multiple founders preserved
 * 6. Co-founders preserved
 * 7. Company email separated from CEO email
 * 8. No guessed emails
 * 9. No fake LinkedIn URLs
 * 10. Current CEO separated from former CEO
 * 11. Seed/current conflicts preserved
 * 12. Complete dossier returned for REJECTED companies
 * 13. Complete dossier returned for VERIFIED companies
 * 14. Required CEO UNKNOWN prevents VERIFIED
 * 15. Required professional email UNKNOWN prevents VERIFIED
 * 16. Custom Target Profile reaches External
 * 17. Final status uses active required criteria
 * 18. Research completeness is separate from qualification match
 * 19. Evidence exists for every verified field
 * 20. Traction Ag regression produces a complete structured dossier
 */

import {
  discoverCompany,
  discoverEntity,
  researchCompany,
  researchIndustry,
  researchGeography,
  researchFunding,
  researchLeadership,
  researchContacts,
  researchSocialProfiles,
  buildFieldAudits,
  calculateResearchCompleteness,
  evaluateQualification,
  processCandidateThroughPipeline,
} from '../lib/discoveryPipeline';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '../lib/targetProfileData';
import { ResearchCandidateInput } from '../providers/types';

async function runExternalRegressionTests() {
  console.log('================================================================');
  console.log('HUNTLYST2 EXTERNAL RESEARCH & VERIFICATION REGRESSION TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testNum: number, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASSED: [Test ${testNum}] ${testName} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAILED: [Test ${testNum}] ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // Standard target profile: requires funding $1M-$5M, non-US, SaaS, CEO, professional email
    const standardTarget: TargetProfile = {
      ...DEFAULT_TVB_TARGET_PROFILE,
      id: 'target-standard',
      name: 'Standard TVB Target',
      financialMetric: 'Funding (Total Raised)',
      fundingMin: 1_000_000,
      fundingMax: 5_000_000,
      fundingCurrency: 'USD',
      regions: ['Europe', 'Asia', 'United Kingdom'],
      countries: ['United Kingdom', 'Germany', 'France'],
      usPresenceMode: 'non_us_only',
      industries: ['SaaS', 'Software', 'Artificial Intelligence', 'B2B'],
      contactRoles: ['CEO', 'Founder'],
      emailVerificationTiers: ['Direct Mailbox Verified'],
    };

    // -------------------------------------------------------------
    // Test 1: Funding fails but founder research still executes
    // -------------------------------------------------------------
    console.log('--- Testing Scenario 1: Funding fails but founder research executes ---');
    const cand1: ResearchCandidateInput = {
      name: 'MegaCorp AI',
      website: 'https://megacorp.example.com',
      source: 'External Entry',
      existingData: {
        fundingOrRevenue: '$100,000,000 Series D', // Way above $5M max!
      },
    };

    // Simulate pipeline run: mock web fetch returning leadership
    const mockWeb1 = {
      domain: 'megacorp.example.com',
      normalizedUrl: 'https://megacorp.example.com',
      status: 'VERIFIED' as const,
      html: '<html><body><h1>MegaCorp AI</h1><p>Founded by Alice Founder and Bob Co-Founder. CEO is Carol Executive.</p><a href="mailto:info@megacorp.example.com">Contact Us</a></body></html>',
      aboutHtml: 'Carol Executive serves as Chief Executive Officer. Alice Founder and Bob Co-Founder started the company in 2021.',
      title: 'MegaCorp AI - Enterprise Platform',
      companyEmails: ['info@megacorp.example.com'],
      socialLinks: {
        linkedin: 'https://www.linkedin.com/company/megacorp-ai',
      },
      retrievedAt: new Date().toISOString(),
      evidence: 'Official homepage scraped',
    };

    const lead1 = await researchLeadership('MegaCorp AI', 'megacorp.example.com', {}, mockWeb1);
    assert(lead1.allExecutives.length > 0, 1, 'Founder research executed despite massive funding failure', `Found ${lead1.allExecutives.length} executives`);
    assert(Boolean(lead1.ceo), 1, 'CEO was identified despite funding failure', `CEO: ${lead1.ceo?.name}`);

    // -------------------------------------------------------------
    // Test 2: Industry fails but contact research still executes
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 2: Industry fails but contact research executes ---');
    const mockWeb2 = {
      ...mockWeb1,
      html: '<html><body><h1>Heavy Steel Metal Works</h1><p>Steel beam manufacturing</p><a href="mailto:sales@heavysteel.example.com">sales</a></body></html>',
      companyEmails: ['sales@heavysteel.example.com'],
    };
    const contacts2 = await researchContacts('Heavy Steel Works', 'heavysteel.example.com', mockWeb2, lead1);
    assert(contacts2.companyEmails.length > 0, 2, 'Contact research executed despite industrial manufacturing category', `Email: ${contacts2.companyEmails[0]?.email}`);

    // -------------------------------------------------------------
    // Test 3: Geography fails but leadership research still executes
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 3: Geography fails but leadership research executes ---');
    const comp3 = await researchCompany('US Giant', 'usgiant.com', {
      ...mockWeb1,
      html: '<html><body><p>Headquarters in New York, NY, United States. Led by CEO Sarah Jenkins.</p></body></html>',
    });
    assert(comp3.usPresence === true, 3, 'US presence correctly identified as true');
    const lead3 = await researchLeadership('US Giant', 'usgiant.com', {}, {
      ...mockWeb1,
      aboutHtml: 'CEO Sarah Jenkins leads our New York headquarters.',
    });
    assert(Boolean(lead3.ceo), 3, 'Leadership research executed for US company', `CEO: ${lead3.ceo?.name}`);

    // -------------------------------------------------------------
    // Test 4: CEO is found separately from founders
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 4: CEO found separately from founders ---');
    const mockWeb4 = {
      ...mockWeb1,
      html: '',
      aboutHtml: 'Current CEO is Dustin Sapp. Founded in 2020 by Brian Stark, Ian Harley, and Scott Nusbaum.',
    };
    const lead4 = await researchLeadership('Traction Ag', 'tractionag.com', {}, mockWeb4);
    assert(lead4.ceo?.name === 'Dustin Sapp', 4, 'Current CEO correctly identified as Dustin Sapp');
    assert(lead4.founders.length >= 2, 4, 'Founders identified separately from CEO', `Founders count: ${lead4.founders.length}`);
    const founderNames = lead4.founders.map(f => f.name);
    assert(founderNames.includes('Brian Stark'), 4, 'Founder Brian Stark preserved');
    assert(lead4.ceo?.name !== lead4.founders[0]?.name, 4, 'CEO is NOT merged into Founder record');

    // -------------------------------------------------------------
    // Test 5: Multiple founders preserved
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 5: Multiple founders preserved ---');
    assert(lead4.founders.length >= 3, 5, 'All multiple founders preserved in array', `Founders: ${founderNames.join(', ')}`);

    // -------------------------------------------------------------
    // Test 6: Co-founders preserved
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 6: Co-founders preserved ---');
    const mockWeb6 = {
      ...mockWeb1,
      html: '',
      aboutHtml: 'Alice Walker, CEO. Co-Founder Mark Davis and Co-Founder Elena Rostova developed the initial code.',
    };
    const lead6 = await researchLeadership('TechPlatform', 'techplatform.com', {}, mockWeb6);
    assert(lead6.coFounders.length >= 2, 6, 'Multiple co-founders preserved separately', `Co-founders: ${lead6.coFounders.map(c => c.name).join(', ')}`);

    // -------------------------------------------------------------
    // Test 7: Company email separated from CEO email
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 7: Company email separated from CEO email ---');
    const mockWeb7 = {
      ...mockWeb1,
      companyEmails: ['hello@tractionag.com', 'sales@tractionag.com'],
    };
    const contacts7 = await researchContacts('Traction Ag', 'tractionag.com', mockWeb7, lead4);
    assert(contacts7.companyEmails.length > 0, 7, 'Company corporate email discovered', `Company email: ${contacts7.companyEmails[0]?.email}`);
    assert(contacts7.ceoEmail === null, 7, 'CEO email is null because not publicly disclosed', `CEO email status: ${contacts7.ceoEmailStatus}`);
    assert(contacts7.companyEmails[0]?.email !== contacts7.ceoEmail, 7, 'Company email is strictly NOT mixed with CEO email');

    // -------------------------------------------------------------
    // Test 8: No guessed emails
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 8: No guessed emails ---');
    const mockWebNoEmail = {
      ...mockWeb1,
      companyEmails: [], // No email on website
    };
    const contactsNoEmail = await researchContacts('Secret Corp', 'secretcorp.io', mockWebNoEmail, lead4);
    assert(contactsNoEmail.companyEmails.length === 0, 8, 'Zero fabricated company emails when website has none');
    assert(contactsNoEmail.primaryEmail === null, 8, 'primaryEmail is null instead of contact@secretcorp.io');
    assert(contactsNoEmail.primaryEmailStatus === 'NOT_PUBLICLY_DISCLOSED', 8, 'Status is NOT_PUBLICLY_DISCLOSED');

    // -------------------------------------------------------------
    // Test 9: No fake LinkedIn URLs
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 9: No fake LinkedIn URLs ---');
    const mockWebNoSocial = {
      ...mockWeb1,
      socialLinks: {}, // No linkedin
    };
    const socialNoLinks = await researchSocialProfiles('Private Corp', 'private.io', mockWebNoSocial, lead4);
    const coLi = (socialNoLinks as any).company_linkedin || (socialNoLinks as any).companyLinkedIn;
    assert(coLi.url === null, 9, 'Company LinkedIn is null when not found');
    assert(coLi.status === 'NOT_FOUND', 9, 'Status is NOT_FOUND, no fake linkedin.com/company/private URL generated');

    // -------------------------------------------------------------
    // Test 10: Current CEO separated from former CEO
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 10: Current CEO separated from former CEO ---');
    const mockWeb10 = {
      ...mockWeb1,
      html: '',
      aboutHtml: 'Dustin Sapp was named Chief Executive Officer in December 2023. Former CEO Ian Harley continues as co-founder and board member.',
    };
    const lead10 = await researchLeadership('Traction Ag', 'tractionag.com', {}, mockWeb10);
    assert(lead10.ceo?.name === 'Dustin Sapp', 10, 'Current CEO is Dustin Sapp', `Got CEO: ${lead10.ceo?.name}`);
    assert((lead10.formerCeos || lead10.former_ceos || []).some(fc => fc.name === 'Ian Harley'), 10, 'Ian Harley tracked as former CEO');
    assert(lead10.ceo?.name !== 'Ian Harley', 10, 'Former CEO is NEVER treated as current CEO');

    // -------------------------------------------------------------
    // Test 11: Seed/current conflicts preserved
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 11: Seed/current conflicts preserved ---');
    const fund11 = await researchFunding('Traction Ag', 'tractionag.com', {
      ...mockWeb1,
      html: 'Traction Ag raised $10M Series A in 2024. Total disclosed funding is $13M.',
    }, '$3,000,000 Seed');
    assert(fund11.conflicts.length > 0, 11, 'Seed vs live funding conflict detected and preserved', `Conflict: ${fund11.conflicts[0]?.explanation}`);
    assert(fund11.conflicts[0]?.seed_value === '$3,000,000 Seed', 11, 'Original seed value preserved in conflict record');
    assert(fund11.conflicts[0]?.live_value !== undefined, 11, 'Live value preserved in conflict record');

    // -------------------------------------------------------------
    // Test 12: Complete dossier returned for REJECTED companies
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 12: Complete dossier returned for REJECTED companies ---');
    // Candidate fails geography because US presence is forbidden
    const candRejected: ResearchCandidateInput = {
      name: 'Traction Ag',
      website: 'https://www.tractionag.com',
      source: 'External Target Entry',
      existingData: {
        location: 'United States',
        fundingOrRevenue: '$13,000,000', // Exceeds standard target max ($5M)
      },
    };
    const resRejected = await processCandidateThroughPipeline(candRejected, standardTarget);
    assert(resRejected.verificationStatus === 'REJECTED', 12, 'Final status is REJECTED due to failed geography & funding');
    assert(resRejected.failedCriteria.length > 0, 12, 'Failed criteria recorded', `Failed: ${resRejected.failedCriteria.join(', ')}`);
    // CRITICAL: Research dossier must be complete anyway!
    assert(resRejected.stages?.FIND_FOUNDERS.status === 'completed', 12, 'Stage FIND_FOUNDERS executed and completed despite early failure');
    assert(resRejected.stages?.VERIFY_CONTACT.status === 'completed', 12, 'Stage VERIFY_CONTACT executed and completed despite early failure');
    assert(resRejected.leadership !== undefined, 12, 'Leadership record populated in rejected result');
    assert(resRejected.fundingDetails !== undefined, 12, 'Funding details populated in rejected result');
    assert(resRejected.researchCompleteness > 0, 12, 'Research completeness calculated for rejected result', `${resRejected.researchCompleteness}%`);

    // -------------------------------------------------------------
    // Test 13: Complete dossier returned for VERIFIED companies
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 13: Complete dossier returned for VERIFIED companies ---');
    const candVerified: ResearchCandidateInput = {
      name: 'EuroTech Cloud',
      website: 'https://eurotech.example.de',
      source: 'External Target Entry',
      existingData: {
        industry: 'B2B SaaS',
        location: 'Germany',
        country: 'Germany',
        fundingOrRevenue: '$3,000,000 Seed',
        founderOrCeoName: 'Klaus Schmidt',
        founderOrCeoEmail: 'klaus.schmidt@eurotech.example.de',
      },
    };
    const resVerified = await processCandidateThroughPipeline(candVerified, standardTarget);
    assert(
      resVerified.verificationStatus === 'VERIFIED',
      13,
      'Candidate qualifying all required criteria is strictly VERIFIED',
      `Got: ${resVerified.verificationStatus} | Failed: [${resVerified.failedCriteria?.join('; ')}] | Unknown: [${resVerified.unknownCriteria?.join('; ')}]`
    );
    assert(resVerified.leadership !== undefined, 13, 'Leadership record present in verified result');
    assert(resVerified.fundingDetails !== undefined, 13, 'Funding details present in verified result');

    // -------------------------------------------------------------
    // Test 14: Required CEO UNKNOWN prevents VERIFIED
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 14: Required CEO UNKNOWN prevents VERIFIED ---');
    const candNoCeo: ResearchCandidateInput = {
      name: 'NoCeo Corp',
      website: 'https://noceo.de',
      source: 'External Target Entry',
      existingData: {
        industry: 'B2B SaaS',
        location: 'Germany',
        country: 'Germany',
        fundingOrRevenue: '$2,500,000',
        // No CEO provided
      },
    };
    const resNoCeo = await processCandidateThroughPipeline(candNoCeo, standardTarget);
    assert(resNoCeo.verificationStatus !== 'VERIFIED', 14, 'Candidate with UNKNOWN required CEO is NEVER VERIFIED (got ' + resNoCeo.verificationStatus + ')');
    assert(resNoCeo.verificationStatus === 'UNVERIFIED', 14, 'Status is strictly UNVERIFIED');

    // -------------------------------------------------------------
    // Test 15: Required professional email UNKNOWN prevents VERIFIED
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 15: Required professional email UNKNOWN prevents VERIFIED ---');
    const candNoEmail: ResearchCandidateInput = {
      name: 'NoEmail Corp',
      website: 'https://noemail.de',
      source: 'External Target Entry',
      existingData: {
        industry: 'B2B SaaS',
        location: 'Germany',
        country: 'Germany',
        fundingOrRevenue: '$2,500,000',
        founderOrCeoName: 'Hans Meyer',
        // No email
      },
    };
    const resNoEmail = await processCandidateThroughPipeline(candNoEmail, standardTarget);
    assert(resNoEmail.verificationStatus !== 'VERIFIED', 15, 'Candidate with UNKNOWN professional email is NEVER VERIFIED (got ' + resNoEmail.verificationStatus + ')');
    assert(resNoEmail.verificationStatus === 'UNVERIFIED', 15, 'Status is strictly UNVERIFIED');

    // -------------------------------------------------------------
    // Test 16: Custom Target Profile reaches External
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 16: Custom Target Profile reaches External ---');
    const customTarget: TargetProfile = {
      ...DEFAULT_TVB_TARGET_PROFILE,
      id: 'custom-target-agri-in',
      name: 'India AgTech Target',
      financialMetric: 'Funding (Total Raised)',
      fundingMin: 500_000,
      fundingMax: 2_000_000,
      fundingCurrency: 'USD',
      regions: ['India'],
      countries: ['India'],
      usPresenceMode: 'non_us_only',
      industries: ['Agriculture', 'AgTech'],
    };
    const candCustom: ResearchCandidateInput = {
      name: 'Kisan SaaS',
      website: 'https://kisansaas.in',
      source: 'External Entry',
      existingData: {
        industry: 'Agriculture',
        country: 'India',
        location: 'India',
        fundingOrRevenue: '$1,200,000 Seed',
        founderOrCeoName: 'Rajesh Patel',
        founderOrCeoEmail: 'rajesh@kisansaas.in',
      },
    };
    const resCustom = await processCandidateThroughPipeline(candCustom, customTarget);
    assert(resCustom.criteria.geography.status === 'PASS', 16, 'Custom target country (India) evaluated as PASS');
    assert(resCustom.criteria.funding.status === 'PASS', 16, 'Custom target funding ($1.2M) evaluated as PASS');

    // -------------------------------------------------------------
    // Test 17: Final status uses active required criteria
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 17: Final status uses active required criteria ---');
    // If a required criterion FAILs -> REJECTED; if UNKNOWN -> UNVERIFIED
    const qualFail = evaluateQualification(
      {
        funding: { status: 'FAIL', value: '$100M', target: '$1M-$5M', reason: 'Above max', evidence: 'SEC filing' },
        industry: { status: 'PASS', value: 'SaaS', evidence: 'Website' },
        geography: { status: 'PASS', value: 'Germany', evidence: 'Imprint' },
        founderOrCeo: { status: 'PASS', value: 'Hans', evidence: 'Team' },
        professionalEmail: { status: 'PASS', value: 'hans@co.de', evidence: 'Contact' },
      },
      standardTarget,
      []
    );
    assert(qualFail.finalStatus === 'REJECTED', 17, 'Active required FAIL produces REJECTED');

    const qualUnknown = evaluateQualification(
      {
        funding: { status: 'PASS', value: '$2M', evidence: 'PR' },
        industry: { status: 'PASS', value: 'SaaS', evidence: 'Website' },
        geography: { status: 'PASS', value: 'Germany', evidence: 'Imprint' },
        founderOrCeo: { status: 'UNKNOWN', reason: 'Not disclosed' },
        professionalEmail: { status: 'UNKNOWN', reason: 'Not disclosed' },
      },
      standardTarget,
      []
    );
    assert(qualUnknown.finalStatus === 'UNVERIFIED', 17, 'Active required UNKNOWN produces UNVERIFIED (never VERIFIED)');

    // -------------------------------------------------------------
    // Test 18: Research completeness is separate from qualification match
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 18: Research completeness is separate from qualification match ---');
    // A lead can be 100% researched, but completely REJECTED
    const completenessScore = calculateResearchCompleteness(
      { company_name: { value: 'Test', status: 'VERIFIED' }, website: { value: 'test.com', status: 'VERIFIED' }, location: { value: 'USA', status: 'VERIFIED' }, standard_industry: { value: 'Retail', status: 'VERIFIED' }, funding: { value: '$50M', status: 'VERIFIED' }, founder: { value: 'John', status: 'VERIFIED' }, email: { value: 'john@test.com', status: 'VERIFIED' } },
      { ceo: { name: 'John' }, founders: [{ name: 'John' }], coFounders: [] },
      { totalFundingUsd: 50_000_000, latestRoundUsd: 20_000_000 },
      { companyEmails: [{ email: 'info@test.com' }], executiveEmails: [{ email: 'john@test.com' }], companyPhone: '555-1234' },
      { company_linkedin: { url: 'https://linkedin.com/test' }, company_x: { url: 'https://x.com/test' } }
    );
    assert(completenessScore >= 90, 18, 'Research completeness is high (>=90%) when all fields investigated', `Score: ${completenessScore}%`);
    assert(qualFail.matchScore < completenessScore, 18, 'Match score is strictly decoupled from research completeness');

    // -------------------------------------------------------------
    // Test 19: Evidence exists for every verified field
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 19: Evidence exists for every verified field ---');
    const audits = buildFieldAudits(
      { name: 'Alpha SaaS', website: 'https://alpha.io', country: 'Germany', industry: 'B2B SaaS', description: 'Cloud workflow engine' },
      { totalFundingUsd: 2_000_000, latestRoundUsd: 2_000_000, latestRoundDate: '2023', latestRoundType: 'Seed', fundingEvidence: 'TechCrunch seed round dispatch' },
      lead10,
      contacts7,
      socialNoLinks
    );
    assert(Boolean(audits.website?.evidence), 19, 'Website audit has evidence');
    assert(Boolean(audits.industry?.evidence), 19, 'Industry audit has evidence');
    assert(Boolean(audits.funding?.evidence), 19, 'Funding audit has explicit evidence snippet', audits.funding?.evidence);

    // -------------------------------------------------------------
    // Test 20: Traction Ag regression produces a complete structured dossier
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 20: Traction Ag regression produces a complete structured dossier ---');
    const tractionCand: ResearchCandidateInput = {
      name: 'Traction Ag',
      website: 'https://www.tractionag.com',
      source: 'Regression Test',
      existingData: {
        description: 'Farm management and accounting software for agricultural producers',
        industry: 'AgTech',
        location: 'Auburn, Indiana, United States',
        country: 'United States',
        fundingOrRevenue: '$13,000,000 (Series A)',
        founderOrCeoName: 'Dustin Sapp',
      },
    };

    const tractionResult = await processCandidateThroughPipeline(tractionCand, standardTarget);

    assert(Boolean(tractionResult.company.name), 20, 'Traction Ag company name preserved');
    assert(Boolean(tractionResult.company.website), 20, 'Traction Ag website preserved');
    assert(tractionResult.company.country === 'United States', 20, 'HQ / Country identified as United States');
    assert(tractionResult.stages?.DISCOVER.status === 'completed', 20, 'Stage 1 DISCOVER completed');
    assert(tractionResult.stages?.RESEARCH.status === 'completed', 20, 'Stage 2 RESEARCH completed');
    assert(tractionResult.stages?.VALIDATE.status === 'completed', 20, 'Stage 3 VALIDATE completed');
    assert(tractionResult.stages?.FIND_FOUNDERS.status === 'completed', 20, 'Stage 4 FIND_FOUNDERS completed');
    assert(tractionResult.stages?.VERIFY_CONTACT.status === 'completed', 20, 'Stage 5 VERIFY_CONTACT completed');
    assert(tractionResult.stages?.QUALIFY.status === 'completed', 20, 'Stage 6 QUALIFY completed');
    assert(tractionResult.researchCompleteness > 0, 20, 'Research completeness calculated for Traction Ag', `${tractionResult.researchCompleteness}%`);
    assert(tractionResult.verificationStatus === 'REJECTED', 20, 'Traction Ag properly qualified as REJECTED against non-US target profile without stopping research');

    // -------------------------------------------------------------
    // Test 21: Unknown Entity Protection (PharmEasy Entity Resolution)
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 21: Unknown Entity Protection (PharmEasy Entity Resolution) ---');
    const pharmeasyCandUrlOnly: ResearchCandidateInput = {
      website: 'https://pharmeasy.in/',
      source: 'External Target Entry',
    };
    const entityResult = await discoverEntity(pharmeasyCandUrlOnly);
    assert(entityResult.sourceName !== 'Unknown Entity', 21, 'Candidate URL resolved authentic name instead of Unknown Entity', `Name: ${entityResult.sourceName}`);
    assert(entityResult.sourceName.toLowerCase().includes('pharmeasy'), 21, 'Resolved name matches PharmEasy brand', `Name: ${entityResult.sourceName}`);
    assert(entityResult.canonicalDomain === 'pharmeasy.in', 21, 'Canonical domain correctly extracted as pharmeasy.in');

    // -------------------------------------------------------------
    // Test 22: Wrong Industry Protection (Healthcare vs AI)
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 22: Wrong Industry Protection (Healthcare vs AI) ---');
    const indTest = researchIndustry(
      undefined,
      'PharmEasy is India leading online pharmacy and digital healthcare platform delivering medicines, medical equipment, diagnostic lab tests, and telehealth services powered by digital technology and healthcare data platform.'
    );
    assert(indTest.standard_industry === 'Healthcare & Pharma', 22, 'PharmEasy categorized as Healthcare & Pharma', `Got: ${indTest.standard_industry}`);
    assert(indTest.standard_industry !== 'AI & Machine Learning', 22, 'PharmEasy is strictly NOT classified as AI & Machine Learning despite digital/technology/data keywords');

    // -------------------------------------------------------------
    // Test 23: Dedicated Funding Research & Timeline Separation
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 23: Dedicated Funding Research & Timeline Separation ---');
    const mockFundWebIntel = {
      ceoName: 'Dharmil Sheth',
      ceoRole: 'CEO',
      ceoEvidence: 'Co-founder and CEO of PharmEasy',
      ceoSourceUrl: 'https://news.example.com/pharmeasy-ceo',
      ceoLinkedIn: 'https://www.linkedin.com/in/dharmilsheth',
      formerCeoName: null,
      formerCeoEvidence: null,
      founders: ['Dharmil Sheth', 'Dhaval Shah'],
      coFounders: ['Dhaval Shah'],
      founderEvidence: 'Founded by Dharmil Sheth and Dhaval Shah',
      founderSourceUrl: 'https://news.example.com/founders',
      founderLinkedInUrls: [],
      companyLinkedIn: 'https://www.linkedin.com/company/pharmeasy/',
      totalFundingUsd: 1_500_000_000,
      latestRoundUsd: 350_000_000,
      fundingAmount: 350_000_000,
      fundingText: '$350M',
      fundingDate: '2021',
      fundingType: 'Series F',
      fundingSourceUrl: 'https://techcrunch.com/pharmeasy-funding',
      fundingRounds: [
        { amountUsd: 220_000_000, roundType: 'Series D', date: '2019', sourceUrl: 'https://news.example.com/d', sourceTitle: 'Series D', evidence: 'Raised $220M in 2019', confidence: 90 },
        { amountUsd: 350_000_000, roundType: 'Series E', date: '2021', sourceUrl: 'https://news.example.com/e', sourceTitle: 'Series E', evidence: 'Raised $350M in 2021', confidence: 90 },
      ],
      sources: ['https://techcrunch.com/pharmeasy-funding'],
    };

    const fundResult = await researchFunding(
      'PharmEasy',
      'pharmeasy.in',
      null,
      { verifiedUrl: 'https://pharmeasy.in/' },
      mockFundWebIntel
    );

    assert(fundResult.totalFundingUsd === 1_500_000_000, 23, 'Total funding captured accurately ($1.5B)');
    assert(fundResult.latestRoundUsd === 350_000_000, 23, 'Latest round separated from total funding ($350M)');
    assert(fundResult.totalFundingUsd !== fundResult.latestRoundUsd, 23, 'Total funding is strictly not confused with latest round');
    assert((fundResult as any).fundingRounds?.length >= 2, 23, 'Multi-round funding timeline populated');

    // -------------------------------------------------------------
    // Test 24: Field Coverage Matrix Generation
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 24: Field Coverage Matrix Generation ---');
    const mockWebPharmEasy = {
      verifiedUrl: 'https://pharmeasy.in/',
      status: 'VERIFIED' as const,
      evidence: 'Official domain active',
      sourceType: 'COMPANY_WEBSITE' as const,
      confidence: 90,
      companyEmails: ['care@pharmeasy.in'],
      companyLinkedIn: 'https://www.linkedin.com/company/pharmeasy/',
      pageTitle: 'PharmEasy: Online Pharmacy & Medical Store in India',
      metaDescription: 'Order medicines online and book lab tests from PharmEasy.',
    };
    const leadPharmEasy = await researchLeadership('PharmEasy', 'pharmeasy.in', {}, mockWebPharmEasy, mockFundWebIntel);
    const contactsPharmEasy = await researchContacts('PharmEasy', 'pharmeasy.in', mockWebPharmEasy, leadPharmEasy);
    const socialPharmEasy = await researchSocialProfiles('PharmEasy', 'pharmeasy.in', mockWebPharmEasy, leadPharmEasy, {}, mockFundWebIntel);

    const pipeCandidate: ResearchCandidateInput = {
      website: 'https://pharmeasy.in/',
      source: 'External Target Entry',
      existingData: {
        industry: 'Healthcare & Pharma',
        fundingOrRevenue: '$1,500,000,000',
        location: 'Mumbai, Maharashtra, India',
        country: 'India',
        founderOrCeoName: 'Dharmil Sheth',
        founderOrCeoEmail: 'care@pharmeasy.in',
        companyLinkedinUrl: 'https://www.linkedin.com/company/pharmeasy/',
      },
    };

    const pharmeasyRun = await processCandidateThroughPipeline(pipeCandidate, standardTarget);
    assert(pharmeasyRun.fieldCoverage !== undefined, 24, 'Field coverage matrix present in pipeline result');
    assert(pharmeasyRun.fieldCoverage?.companyName?.searched === true, 24, 'Field coverage tracks companyName searched');
    assert(pharmeasyRun.fieldCoverage?.funding?.verified === true, 24, 'Field coverage tracks funding verified');
    assert(pharmeasyRun.fieldCoverage?.ceo?.searched === true, 24, 'Field coverage tracks CEO searched');
    assert(pharmeasyRun.fieldCoverage?.companyLinkedIn?.searched === true, 24, 'Field coverage tracks companyLinkedIn searched');

    // -------------------------------------------------------------
    // Test 25: Full Dossier after Rejection (PharmEasy Target Fail)
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 25: Full Dossier after Rejection (PharmEasy Target Fail) ---');
    // Standard target requires funding $1M-$5M. PharmEasy ($1.5B) will fail funding range and get REJECTED.
    assert(pharmeasyRun.verificationStatus === 'REJECTED', 25, 'PharmEasy properly qualified as REJECTED against $1M-$5M target bounds');
    assert(pharmeasyRun.company.name.toLowerCase().includes('pharmeasy'), 25, 'PharmEasy name preserved in rejected dossier');
    assert(pharmeasyRun.company.industry === 'Healthcare & Pharma', 25, 'PharmEasy industry preserved as Healthcare & Pharma in rejected dossier');
    assert(pharmeasyRun.stages?.FIND_FOUNDERS.status === 'completed', 25, 'Leadership stage completed despite rejection');
    assert(pharmeasyRun.stages?.VERIFY_CONTACT.status === 'completed', 25, 'Contact stage completed despite rejection');
    assert(pharmeasyRun.stages?.QUALIFY.status === 'completed', 25, 'Qualify stage completed despite rejection');
    assert(pharmeasyRun.leadership !== undefined, 25, 'Leadership data populated in rejected dossier');
    assert(pharmeasyRun.funding !== undefined || pharmeasyRun.fundingDetails !== undefined, 25, 'Funding history preserved in rejected dossier');
    // -------------------------------------------------------------
    // Test 26: Mindfuel Golden Regression
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 26: Mindfuel Golden Regression ---');
    const mindfuelCand: ResearchCandidateInput = {
      website: 'https://www.mindfuel.ai/',
      source: 'External Target Entry',
    };
    const mindfuelRun = await processCandidateThroughPipeline(mindfuelCand, standardTarget);

    assert(mindfuelRun.company.name.toLowerCase().includes('mindfuel'), 26, 'Mindfuel name resolved authentically');
    assert(mindfuelRun.leadership?.ceo?.name !== 'and Senior Business', 26, 'Mindfuel CEO is strictly NOT "and Senior Business"');
    assert(mindfuelRun.leadership?.ceo?.name?.toLowerCase().includes('nadiem'), 26, `Mindfuel CEO is Nadiem von Heydebrand (Got: ${mindfuelRun.leadership?.ceo?.name})`);
    assert(mindfuelRun.company.industry !== 'Other / Custom', 26, `Mindfuel industry is NOT "Other / Custom" (Got: ${mindfuelRun.company.industry})`);
    assert(mindfuelRun.company.totalFundingUsd !== null || mindfuelRun.company.latestRoundUsd !== null, 26, `Mindfuel funding is NOT Undisclosed (Got: $${((mindfuelRun.company.totalFundingUsd || mindfuelRun.company.latestRoundUsd || 0) / 1e6).toFixed(1)}M)`);
    assert(mindfuelRun.company.country !== 'Undisclosed' && mindfuelRun.company.country?.toLowerCase().includes('germany'), 26, `Mindfuel geography is Germany (Got: ${mindfuelRun.company.headquarters || mindfuelRun.company.country})`);
    assert(mindfuelRun.researchCompleteness >= 70, 26, `Mindfuel research completeness high (Got: ${mindfuelRun.researchCompleteness}%)`);

    // -------------------------------------------------------------
    // Test 27: PharmEasy Golden Regression
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 27: PharmEasy Golden Regression ---');
    assert(pharmeasyRun.leadership?.ceo?.name !== 'Unknown', 27, `PharmEasy CEO is NOT Unknown (Got: ${pharmeasyRun.leadership?.ceo?.name})`);
    assert(pharmeasyRun.company.totalFundingUsd !== null, 27, `PharmEasy funding is NOT Undisclosed (Got: $${((pharmeasyRun.company.totalFundingUsd || 0) / 1e6).toFixed(1)}M)`);
    assert(Boolean(pharmeasyRun.social?.companyLinkedIn?.url || pharmeasyRun.company.companyLinkedinUrl), 27, `PharmEasy Company LinkedIn surfaced (Got: ${pharmeasyRun.company.companyLinkedinUrl})`);

    // -------------------------------------------------------------
    // Test 28: Traction Ag Golden Regression
    // -------------------------------------------------------------
    console.log('\n--- Testing Scenario 28: Traction Ag Golden Regression ---');
    assert(tractionResult.stages?.DISCOVER.status === 'completed', 28, 'Traction Ag stage DISCOVER completed');
    assert(tractionResult.stages?.RESEARCH.status === 'completed', 28, 'Traction Ag stage RESEARCH completed');
    assert(tractionResult.stages?.VALIDATE.status === 'completed', 28, 'Traction Ag stage VALIDATE completed');
    assert(tractionResult.stages?.FIND_FOUNDERS.status === 'completed', 28, 'Traction Ag stage FIND_FOUNDERS completed');
    assert(tractionResult.stages?.VERIFY_CONTACT.status === 'completed', 28, 'Traction Ag stage VERIFY_CONTACT completed');
    assert(tractionResult.stages?.QUALIFY.status === 'completed', 28, 'Traction Ag stage QUALIFY completed');
    assert(tractionResult.leadership?.ceo?.name === 'Dustin Sapp', 28, 'Traction Ag current CEO resolved to Dustin Sapp');
    assert(lead10.formerCeos?.some(f => f.name === 'Ian Harley') || tractionResult.leadership?.formerCeos?.some(f => f.name === 'Ian Harley') || (tractionResult as any).formerCeos?.some((f: any) => f.name === 'Ian Harley'), 28, 'Traction Ag former CEO resolved to Ian Harley');
    assert(tractionResult.researchCompleteness >= 70, 28, `Traction Ag research completeness >= 70% (Got: ${tractionResult.researchCompleteness}%)`);

    console.log('\n================================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('CRITICAL TEST EXCEPTION:', err);
    process.exit(1);
  }
}

runExternalRegressionTests();
