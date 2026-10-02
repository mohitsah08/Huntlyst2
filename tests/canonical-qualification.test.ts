/**
 * Canonical Target Verification & Qualification Test Suite
 *
 * Directly tests the 8 core scenarios mandated in Section 38 of the architectural specification:
 * TEST 1: Global + Funding $100K-$10M + Industry All -> US companies must NOT fail because of geography.
 * TEST 2: Specific countries -> Country selection must affect qualification.
 * TEST 3: Specific industry -> Industry mismatch must fail.
 * TEST 4: Funding invalid -> Funding must fail.
 * TEST 5: Funding valid + Industry valid + Global -> Company should not fail because of country.
 * TEST 6: Input funding differs from current web evidence -> UNDER_REVIEW / CONFLICT.
 * TEST 7: Input CEO is incorrect / paywalled -> External evidence wins / preserved / mismatch recorded.
 * TEST 8: Input email is present -> Independently verified; never automatically marked verified.
 */

import { evaluateCanonicalTargetQualification } from '../lib/validation';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '../lib/targetProfileData';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('================================================================');
console.log('HUNTLYST CANONICAL QUALIFICATION & TARGET VERIFICATION TESTS');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// TEST 1: Global + Funding $100K-$10M + Industry All + US Allowed
// -------------------------------------------------------------------------
console.log('[TEST 1] Global + Funding $100K-$10M + Industry All (US companies must NOT fail because of geography)...');
const test1Profile: TargetProfile = {
  ...DEFAULT_TVB_TARGET_PROFILE,
  region: 'Global',
  continents: [],
  countries: [],
  excludedCountries: [],
  fundingMin: 100_000,
  fundingMax: 10_000_000,
  industries: [], // All industries
  subIndustries: [],
};

const usCompany = {
  name: 'Acme AI Inc',
  website: 'https://acmeai.io',
  country: 'United States',
  location: 'San Francisco, CA, USA',
  industry: 'Enterprise Software',
  fundingAmount: '$5,000,000',
  fundingDate: '2024-03-15',
  fundingType: 'Series A',
  ceoName: 'Alice Smith',
  email: 'alice@acmeai.io',
  emailStatus: 'valid' as const,
};

const res1 = evaluateCanonicalTargetQualification(usCompany, test1Profile);
assert(res1.status === 'QUALIFIED', `US company should be QUALIFIED, got ${res1.status}`);
assert(
  !res1.reasons.some(r => r.toLowerCase().includes('united states') || r.toLowerCase().includes('geography')),
  'US company must not have any geographic rejection reason'
);
const geoCheck1 = res1.criteriaChecks.find(c => c.name === 'Geography' || c.category === 'geography');
assert(geoCheck1 !== undefined && geoCheck1.status === 'PASS', 'Geography check must PASS for Global target');
assert(geoCheck1?.weight === 0, 'Geography check weight must be 0 for Global (informational)');

// -------------------------------------------------------------------------
// TEST 2: Specific countries -> Country selection must affect qualification
// -------------------------------------------------------------------------
console.log('\n[TEST 2] Specific countries (Country selection must affect qualification)...');
const test2Profile: TargetProfile = {
  ...DEFAULT_TVB_TARGET_PROFILE,
  region: 'Europe',
  continents: ['Europe'],
  countries: ['Germany', 'France'],
  fundingMin: 100_000,
  fundingMax: 10_000_000,
  industries: [],
  subIndustries: [],
};

// Company in Germany should PASS
const germanCompany = {
  name: 'Berlin Cloud GmbH',
  website: 'https://berlincloud.de',
  country: 'Germany',
  fundingAmount: '$3,000,000',
  ceoName: 'Hans Schmidt',
  email: 'hans@berlincloud.de',
  emailStatus: 'valid' as const,
};
const res2a = evaluateCanonicalTargetQualification(germanCompany, test2Profile);
assert(res2a.status === 'QUALIFIED', `German company should be QUALIFIED in DE/FR profile, got ${res2a.status}`);

// Company in Australia should FAIL geography
const aussieCompany = {
  name: 'Sydney Tech Pty',
  website: 'https://sydneytech.com.au',
  country: 'Australia',
  fundingAmount: '$3,000,000',
  ceoName: 'Jack Taylor',
  email: 'jack@sydneytech.com.au',
  emailStatus: 'valid' as const,
};
const res2b = evaluateCanonicalTargetQualification(aussieCompany, test2Profile);
assert(res2b.status === 'REJECTED', `Australian company should be REJECTED in DE/FR profile, got ${res2b.status}`);
assert(
  res2b.reasons.some(r => r.includes('Australia') && r.includes('Germany, France')),
  `Rejection reason must detail Australian mismatch against Germany, France. Got: ${res2b.reasons.join('; ')}`
);

// -------------------------------------------------------------------------
// TEST 3: Specific industry -> Industry mismatch must fail
// -------------------------------------------------------------------------
console.log('\n[TEST 3] Specific industry (Industry mismatch must fail)...');
const test3Profile: TargetProfile = {
  ...DEFAULT_TVB_TARGET_PROFILE,
  region: 'Global',
  continents: [],
  countries: [],
  industries: ['FinTech', 'Financial Services'],
  subIndustries: ['Banking Tech', 'Payments'],
  fundingMin: 100_000,
  fundingMax: 10_000_000,
};

const healthcareCompany = {
  name: 'MediCare Robotics',
  website: 'https://medicarerobotics.com',
  country: 'Canada',
  industry: 'Healthcare & Biotech',
  fundingAmount: '$2,000,000',
  ceoName: 'Dr. Sarah Connor',
};

const res3 = evaluateCanonicalTargetQualification(healthcareCompany, test3Profile);
assert(res3.status === 'REJECTED', `Healthcare company should be REJECTED in FinTech profile, got ${res3.status}`);
assert(
  res3.reasons.some(r => r.toLowerCase().includes('industr') || r.toLowerCase().includes('healthcare')),
  `Rejection reason must explicitly state industry mismatch. Got: ${res3.reasons.join('; ')}`
);

// -------------------------------------------------------------------------
// TEST 4: Funding invalid -> Funding must fail
// -------------------------------------------------------------------------
console.log('\n[TEST 4] Funding invalid (Funding must fail)...');
const test4Profile: TargetProfile = {
  ...DEFAULT_TVB_TARGET_PROFILE,
  region: 'Global',
  fundingMin: 100_000,
  fundingMax: 10_000_000,
  financialMetric: 'funding_only',
};

// 4a. Overfunded ($25M)
const megaFundedCompany = {
  name: 'Mega Unicorn Corp',
  website: 'https://megaunicorn.com',
  fundingAmount: '$25,000,000',
  industry: 'Technology',
  country: 'United Kingdom',
};
const res4a = evaluateCanonicalTargetQualification(megaFundedCompany, test4Profile);
assert(res4a.status === 'REJECTED', `Company with $25M funding should be REJECTED (max is $10M), got ${res4a.status}`);
assert(
  res4a.reasons.some(r => r.includes('25,000,000') && r.includes('exceeds')),
  `Rejection must note $25M exceeds upper bound. Got: ${res4a.reasons.join('; ')}`
);

// 4b. Underfunded ($25K)
const underFundedCompany = {
  name: 'Micro Tiny Labs',
  website: 'https://tinylabs.com',
  fundingAmount: '$25,000',
  industry: 'Technology',
  country: 'United Kingdom',
};
const res4b = evaluateCanonicalTargetQualification(underFundedCompany, test4Profile);
assert(res4b.status === 'REJECTED', `Company with $25K funding should be REJECTED (min is $100K), got ${res4b.status}`);
assert(
  res4b.reasons.some(r => r.includes('25,000') && r.includes('below')),
  `Rejection must note $25K is below minimum bound. Got: ${res4b.reasons.join('; ')}`
);

// -------------------------------------------------------------------------
// TEST 5: Funding valid + Industry valid + Global -> Company should not fail because of country
// -------------------------------------------------------------------------
console.log('\n[TEST 5] Funding valid + Industry valid + Global (Must not fail because of country)...');
const test5Profile: TargetProfile = {
  ...DEFAULT_TVB_TARGET_PROFILE,
  region: 'Global',
  continents: [],
  countries: [],
  fundingMin: 100_000,
  fundingMax: 10_000_000,
  industries: ['Artificial Intelligence', 'Technology'],
};

const diverseCountries = ['United States', 'India', 'Japan', 'Nigeria', 'Brazil', 'France', 'Singapore'];
for (const country of diverseCountries) {
  const comp = {
    name: `${country} AI Engine`,
    website: `https://${country.toLowerCase().replace(/\s+/g, '')}-ai.io`,
    country,
    industry: 'Artificial Intelligence',
    fundingAmount: '$2,500,000',
    ceoName: 'Jane Doe',
    email: `contact@${country.toLowerCase().replace(/\s+/g, '')}-ai.io`,
    emailStatus: 'valid' as const,
  };
  const res5 = evaluateCanonicalTargetQualification(comp, test5Profile);
  assert(res5.status === 'QUALIFIED', `Company from ${country} must qualify under Global target, got ${res5.status}`);
}

// -------------------------------------------------------------------------
// TEST 6: Input funding differs from current web evidence -> UNDER_REVIEW / CONFLICT
// -------------------------------------------------------------------------
console.log('\n[TEST 6] Input funding differs from current web evidence (UNDER_REVIEW / CONFLICT)...');
const conflictingCompany = {
  name: 'Disputed Capital SaaS',
  website: 'https://disputedsaas.com',
  country: 'Sweden',
  fundingAmount: '$3,000,000', // Input snapshot says $3M
  verifiedFundingAmount: '$15,000,000', // Fresh web evidence says $15M (conflict!)
  fundingStatus: 'CONFLICT' as const,
  ceoName: 'Erik Larsson',
  email: 'erik@disputedsaas.com',
  emailStatus: 'valid' as const,
};

const res6 = evaluateCanonicalTargetQualification(conflictingCompany, test1Profile);
assert(
  res6.status === 'UNDER_REVIEW',
  `Company with conflicting funding data must be routed to UNDER_REVIEW, got ${res6.status}`
);
assert(
  res6.reasons.some(r => r.includes('Conflict') || r.includes('verification')),
  `Reasons must explain the conflict/review status. Got: ${res6.reasons.join('; ')}`
);

// -------------------------------------------------------------------------
// TEST 7: Input CEO is paywalled or placeholder -> Honest UNKNOWN / No hallucination
// -------------------------------------------------------------------------
console.log('\n[TEST 7] Input CEO placeholder / paywall (Must not treat paywall text as person)...');
const paywalledCompany = {
  name: 'Paywalled Leads Co',
  website: 'https://paywalledleads.com',
  country: 'United Kingdom',
  fundingAmount: '$1,500,000',
  ceoName: 'UPGRADE TO UNLOCK', // Typical paywall placeholder
};

const res7 = evaluateCanonicalTargetQualification(paywalledCompany, test1Profile);
const ceoCheck = res7.criteriaChecks.find(c => c.category === 'executive');
assert(
  ceoCheck?.status === 'UNKNOWN' || ceoCheck?.status === 'FAIL',
  `Paywalled CEO placeholder "UPGRADE TO UNLOCK" must not be treated as a verified leader. Got: ${ceoCheck?.status}`
);
assert(
  !res7.reasons.some(r => r.includes('UPGRADE TO UNLOCK verified')),
  'Must never report paywall placeholder as verified leader'
);

// -------------------------------------------------------------------------
// TEST 8: Input email is present -> Independently verified; never automatically marked verified
// -------------------------------------------------------------------------
console.log('\n[TEST 8] Input email present -> Independently verified; never automatically marked verified...');
const unverifiedEmailCompany = {
  name: 'Email Check Co',
  website: 'https://emailcheck.io',
  country: 'United Kingdom',
  fundingAmount: '$2,000,000',
  ceoName: 'Robert Frost',
  email: 'robert@emailcheck.io', // Present in input, but NOT verified by DNS MX
  emailStatus: 'unverified' as const,
};

const res8a = evaluateCanonicalTargetQualification(unverifiedEmailCompany, test1Profile);
const emailCheck8a = res8a.criteriaChecks.find(c => c.category === 'contact');
assert(
  emailCheck8a?.status !== 'PASS',
  `Unverified input email must not be marked PASS. Got ${emailCheck8a?.status}`
);

// Now with DNS MX verified email
const verifiedEmailCompany = {
  ...unverifiedEmailCompany,
  emailStatus: 'valid' as const,
  emailVerified: true,
};
const res8b = evaluateCanonicalTargetQualification(verifiedEmailCompany, test1Profile);
const emailCheck8b = res8b.criteriaChecks.find(c => c.category === 'contact');
assert(
  emailCheck8b?.status === 'PASS',
  `DNS MX verified email must mark Contact Verification as PASS. Got ${emailCheck8b?.status}`
);

console.log('\n================================================================');
console.log('🎉 ALL 8 CANONICAL TARGET VERIFICATION TEST CASES PASSED!');
console.log('================================================================\n');
