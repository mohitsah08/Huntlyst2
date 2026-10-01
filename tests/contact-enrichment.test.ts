/**
 * Unit Test Suite for Contact & Decision-Maker Enrichment Engine
 * Tests adherence to Sections 1–22 of the non-negotiable specification:
 * - Company contact profile structure & provenance
 * - Decision-maker discovery & role prioritization (CEO > Founder > Co-Founder > Executive)
 * - Professional email verification & DNS MX validation
 * - Public personal email guardrails (NEVER guess or infer)
 * - Company email vs decision-maker email separation
 * - LinkedIn & Twitter/X verification
 * - Best Contact Path computation & explanation
 * - Contact Completeness independent calculation (no penalty for personal email)
 * - Preservation of user-supplied input data without replacement
 * - Multiple contacts support (primary + secondary)
 * - Complete Contact Export CSV column compliance
 */

import { ContactEnrichmentService } from '../lib/contactEnrichment';
import { generateUniversalCsv, normalizeCompanyRecord } from '../lib/export';
import { CompanyRecord } from '../lib/types';
import { DecisionMakerContact, CompanyContactProfile } from '../lib/contactTypes';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedTests++;
  console.log(`✅ PASSED: ${msg}`);
}

async function runTests() {
  console.log('\n==================================================');
  console.log('STARTING CONTACT & DECISION-MAKER ENRICHMENT TESTS');
  console.log('==================================================\n');

  // TEST 1: Company Contact Profile Structure & Provenance (Section 1 & 12)
  console.log('--- Test 1: Company Contact Profile Structure & Provenance ---');
  const profile1 = await ContactEnrichmentService.enrichCompanyContacts({
    companyName: 'Synthesia AI',
    website: 'https://synthesia.io',
    description: 'AI video generation platform founded by Victor Riparbelli and Steffen Tjerrild.',
    industry: 'AI & Machine Learning',
    city: 'London',
    country: 'United Kingdom',
    rawSnippet: 'Synthesia is a generative AI video platform founded by Victor Riparbelli. Contact at info@synthesia.io.',
  });

  assert(profile1.company_name.value === 'Synthesia AI', 'Preserves company_name value');
  assert(profile1.company_name.verification_status === 'VERIFIED', 'company_name status is VERIFIED');
  assert(!!profile1.company_name.checked_at, 'company_name has checked_at timestamp');
  assert(profile1.company_description.value?.includes('AI video') || false, 'Preserves company_description');
  assert(profile1.company_city.value === 'London', 'Preserves company_city');
  assert(profile1.company_country.value === 'United Kingdom', 'Preserves company_country');
  assert(profile1.website.value === 'https://synthesia.io', 'Preserves website');

  // TEST 2: Decision-Maker Discovery (Section 2 & 3)
  console.log('\n--- Test 2: Decision-Maker Discovery ---');
  assert(profile1.primary_contact !== null, 'Identifies at least one decision maker');
  const primary = profile1.primary_contact!;
  assert(primary.full_name === 'Victor Riparbelli', `Extracted correct leader name: ${primary.full_name}`);
  assert(primary.first_name.toLowerCase() === 'victor', `Extracted first_name: ${primary.first_name}`);
  assert(primary.last_name.toLowerCase() === 'riparbelli', `Extracted last_name: ${primary.last_name}`);
  assert(primary.current_role === 'CEO' || primary.current_role === 'Founder', `Assigned verified role: ${primary.current_role}`);
  assert(primary.is_primary === true, 'Top executive is marked primary');

  // TEST 3: Professional Email vs Public Personal Email (Sections 4 & 5)
  console.log('\n--- Test 3: Professional Email vs Public Personal Email ---');
  // Synthesia domain synthesia.io has active DNS MX
  assert(!!primary.professional_email, 'Synthesized professional email for primary decision-maker');
  assert(primary.professional_email!.endsWith('@synthesia.io'), 'Professional email matches company domain');
  assert(primary.professional_email_status === 'VALID', 'Professional email verified via DNS MX');
  assert(primary.public_personal_email === null, 'Personal email is NEVER inferred or guessed');
  assert(primary.public_personal_email_status === 'NOT_DISCLOSED', 'Personal email marked NOT_DISCLOSED when not explicitly public');

  // TEST 4: Company Email Separation (Section 6)
  console.log('\n--- Test 4: Company Email Separation ---');
  assert(profile1.company_email.value === 'info@synthesia.io', `Separated company email: ${profile1.company_email.value}`);
  assert(profile1.company_email.value !== primary.professional_email, 'Company email is distinct from personal decision-maker email');
  assert(profile1.company_email.verification_status === 'VERIFIED', 'Company email domain verified via DNS MX');

  // TEST 5: Person Selection Priority Rule (Section 15)
  console.log('\n--- Test 5: Person Selection Priority (CEO > Founder > Executive) ---');
  const multiProfile = await ContactEnrichmentService.enrichCompanyContacts({
    companyName: 'Fintech Hub',
    website: 'https://fintechhub.co',
    description: 'B2B banking engine co-founded by Alice Smith and Bob Jones (CEO).',
    rawSnippet: 'Bob Jones is Chief Executive Officer, and Alice Smith is Co-Founder.',
  });

  assert(multiProfile.primary_contact !== null, 'Found primary executive');
  // Bob Jones is CEO, Alice Smith is Co-Founder -> CEO must be primary!
  assert(
    multiProfile.primary_contact!.full_name.includes('Bob') || multiProfile.primary_contact!.current_role === 'CEO',
    `Prioritized CEO as primary contact: ${multiProfile.primary_contact!.full_name} (${multiProfile.primary_contact!.current_role})`
  );

  // TEST 6: Best Contact Path Calculation (Section 9)
  console.log('\n--- Test 6: Best Contact Path Calculation ---');
  const bestPath = profile1.best_contact_path;
  assert(bestPath.method === 'Verified Professional Email', `Calculated best contact method: ${bestPath.method}`);
  assert(bestPath.explanation.includes('professional email — verified'), `Clear explanation: "${bestPath.explanation}"`);
  assert(bestPath.target === 'decision_maker', 'Target is decision_maker');

  // TEST 7: Contact Completeness Calculation (Section 10)
  console.log('\n--- Test 7: Contact Completeness Calculation ---');
  const completeness = profile1.contact_completeness;
  assert(completeness.maxScore === 6, 'Uses 6 measurable core contact fields');
  assert(completeness.score >= 3, `Score calculated accurately: ${completeness.score}/6`);
  assert(completeness.details.decisionMakerFound === true, 'decisionMakerFound flag is true');
  assert(completeness.details.companyEmailVerified === true, 'companyEmailVerified flag is true');
  assert(completeness.details.publicPersonalEmailStatus === 'not_disclosed', 'Personal email tracked without completeness penalty');

  // TEST 8: Preserves User-Supplied Input File Data (Sections 13 & 14)
  console.log('\n--- Test 8: User Input Preservation & Cross-Checking ---');
  const userSuppliedProfile = await ContactEnrichmentService.enrichCompanyContacts({
    companyName: 'Acme Robotics',
    website: 'https://acmerobotics.de',
    description: 'Robotics automation',
    userInput: {
      ceoName: 'Hans Gruber',
      ceoEmail: 'h.gruber@acmerobotics.de',
      ceoLinkedin: 'https://linkedin.com/in/hansgruber',
      ceoTwitter: '@hansrobotics',
      contactEmail: 'contact@acmerobotics.de',
      phone: '+49 89 123456',
    },
  });

  assert(userSuppliedProfile.primary_contact !== null, 'Preserves user-supplied CEO');
  assert(userSuppliedProfile.primary_contact!.full_name === 'Hans Gruber', 'CEO name matches input');
  assert(userSuppliedProfile.primary_contact!.professional_email === 'h.gruber@acmerobotics.de', 'CEO email matches input');
  assert(userSuppliedProfile.primary_contact!.linkedin_url === 'https://linkedin.com/in/hansgruber', 'CEO LinkedIn matches input');
  assert(userSuppliedProfile.primary_contact!.source === 'User Input File', 'Preserved source provenance as User Input File');
  assert(userSuppliedProfile.company_phone.value === '+49 89 123456', 'Preserved company phone');
  assert(userSuppliedProfile.company_phone.verification_status === 'VERIFIED', 'User provided phone marked verified');

  // TEST 9: Distinct States (Section 11)
  console.log('\n--- Test 9: Distinct Verification States ---');
  const noDataProfile = await ContactEnrichmentService.enrichCompanyContacts({
    companyName: 'Ghost Startup',
    website: 'https://ghoststartup1234567.xyz',
    description: null,
  });

  assert(noDataProfile.company_description.verification_status === 'NOT_FOUND', 'Description without data is NOT_FOUND');
  assert(noDataProfile.company_phone.verification_status === 'UNAVAILABLE', 'Phone without data is UNAVAILABLE');
  assert(noDataProfile.company_linkedin.verification_status === 'NOT_FOUND', 'Missing LinkedIn is NOT_FOUND');
  assert(noDataProfile.company_email.verification_status === 'UNVERIFIED', 'Unresolvable domain email is UNVERIFIED');

  // TEST 10: Section 17 Export Columns Compliance
  console.log('\n--- Test 10: Section 17 Contact Export Columns Compliance ---');
  const mockCompany: CompanyRecord = {
    name: 'Synthesia AI',
    website: 'https://synthesia.io',
    description: 'AI platform',
    industry: 'AI & Machine Learning',
    fundingOrRevenue: '$150M',
    usPresence: true,
    founderOrCeoName: 'Victor Riparbelli',
    founderOrCeoEmail: 'victor.riparbelli@synthesia.io',
    emailVerified: true,
    confidenceScore: 95,
    sourceType: 'Houston Pipeline',
    country: 'United Kingdom',
    contactProfile: profile1,
  };

  const normalized = normalizeCompanyRecord(mockCompany);
  assert(normalized.ceoName === 'Victor Riparbelli', 'Export record contains ceoName');
  assert(normalized.ceoFirstName === 'Victor', 'Export record contains ceoFirstName');
  assert(normalized.ceoLastName === 'Riparbelli', 'Export record contains ceoLastName');
  assert(normalized.primaryProfessionalEmail?.includes('synthesia.io') || false, 'Export record contains primaryProfessionalEmail');
  assert(normalized.companyEmail === 'info@synthesia.io', 'Export record contains companyEmail');
  assert(normalized.bestContactMethod === 'Verified Professional Email', 'Export record contains bestContactMethod');

  const csv = generateUniversalCsv([normalized]);
  const requiredHeaders = [
    'CEO Name',
    'CEO First Name',
    'CEO Last Name',
    'CEO Email',
    'CEO Email Status',
    'CEO Linkedin',
    'CEO Twitter (X)',
    'Primary Decision Maker',
    'Primary Decision Maker Role',
    'Primary Professional Email',
    'Primary Professional Email Status',
    'Public Personal Email',
    'Public Personal Email Status',
    'Primary LinkedIn',
    'Primary LinkedIn Status',
    'Primary X/Twitter',
    'Primary X/Twitter Status',
    'Company Email',
    'Company Email Status',
    'Company LinkedIn',
    'Company LinkedIn Status',
    'Company X/Twitter',
    'Company X/Twitter Status',
    'Best Contact Method',
    'Contact Completeness',
    'Contact Verification Summary',
  ];

  for (const h of requiredHeaders) {
    assert(csv.includes(h), `Primary CSV header contains required column: "${h}"`);
  }

  // Also check that existing columns are preserved
  assert(csv.includes('Canonical Domain'), 'Preserved existing column: Canonical Domain');
  assert(csv.includes('Reasons For Selection'), 'Preserved existing column: Reasons For Selection');
  assert(csv.includes('Reasons For Rejection'), 'Preserved existing column: Reasons For Rejection');
  assert(csv.includes('Snapshot Time'), 'Preserved existing column: Snapshot Time');

  console.log('\n==================================================');
  console.log(`ALL ${passedTests} / ${totalTests} CONTACT ENRICHMENT TESTS PASSED!`);
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
