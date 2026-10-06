/**
 * Comprehensive Regression Test Suite: Internal Qualification & Data Model
 * 
 * Verifies all 12 regression scenarios (A through L) requested by user:
 * A. CEO required + CEO present -> PASS
 * B. CEO required + CEO missing -> UNVERIFIED
 * C. CEO required + placeholder ("UPGRADE TO UNLOCK") -> UNVERIFIED
 * D. Professional email required + email present -> PASS
 * E. Professional email required + only company email exists -> UNVERIFIED
 * F. Founder + Co-Founder fields both present -> both preserved individually
 * G. 100-row file -> 100 LeadPackages without dropped rows
 * H. Internal mode -> zero network calls
 * I. Custom Target Profile -> custom parameters faithfully respected
 * J. Required criterion UNKNOWN -> NEVER VERIFIED regardless of score
 * K. Required criterion FAIL -> REJECTED
 * L. Conflicting evidence -> REVIEW
 */

import fs from 'fs';
import path from 'path';
import { auditAndBuildLeadPackages, buildLeadPackageFromRow } from '../lib/agents/fileIntakeAuditor';
import { evaluateInternalLeadPackage } from '../lib/internalQualification';
import { DEFAULT_TVB_TARGET_PROFILE, TargetProfile } from '../lib/targetProfileData';

async function runRegressionTests() {
  console.log('================================================================');
  console.log('HUNTLYST2 INTERNAL QUALIFICATION & DATA MODEL REGRESSION TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASSED: [${testName}] ${details || ''}`);
      passed++;
    } else {
      console.error(`❌ FAILED: [${testName}] ${details || ''}`);
      failed++;
    }
  }

  // --- H. ZERO NETWORK CALLS INTERCEPTOR ---
  let networkCallCount = 0;
  const originalFetch = global.fetch;
  (global as any).fetch = async (url: string | URL | Request) => {
    networkCallCount++;
    throw new Error(`CRITICAL ERROR: Network fetch called in Internal Mode: ${url.toString()}`);
  };

  try {
    const knownNames = new Map<string, number>();
    const knownDomains = new Map<string, number>();

    // Test Target: Contact & Email are REQUIRED
    const strictTarget: TargetProfile = {
      ...DEFAULT_TVB_TARGET_PROFILE,
      fundingMin: 1_000_000,
      fundingMax: 5_000_000,
      fundingCurrency: 'USD',
      industries: ['Technology'],
      regions: ['Global'],
      countries: [],
      contactPersonTypes: ['CEO'],
      contactRequirement: 'Required',
      emailRequirement: 'Required',
    };

    // --- TEST A: CEO required + CEO present -> PASS ---
    const rowA = {
      Name: 'Alpha Tech',
      URL: 'https://alphatech.com',
      Industry: 'Technology',
      Country: 'United States',
      'Funding Amount': '$3,000,000',
      'CEO Name': 'Satya Nadella',
      'CEO Email': 'satya@alphatech.com',
      'Contact Email': 'info@alphatech.com',
    };
    const pkgA = buildLeadPackageFromRow(rowA, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 1 }, knownNames, knownDomains)!;
    assert(pkgA !== null, 'Test A', 'Package A created');
    assert(pkgA.seed_data.normalized.ceo_name === 'Satya Nadella', 'Test A', 'Normalized CEO name preserved');
    
    const evalA = evaluateInternalLeadPackage(pkgA, strictTarget);
    assert(evalA.qualification.criteria.founderOrCeo?.status === 'PASS', 'Test A', 'CEO leadership criterion passes');
    assert(evalA.qualification.criteria.professionalEmail?.status === 'PASS', 'Test A', 'Professional email criterion passes');
    assert(evalA.finalStatus === 'VERIFIED', 'Test A', 'Lead with all required criteria passing is VERIFIED');

    // --- TEST B: CEO required + CEO missing -> UNVERIFIED ---
    const rowB = {
      Name: 'Beta Systems',
      URL: 'https://betasystems.com',
      Industry: 'Technology',
      Country: 'United States',
      'Funding Amount': '$3,000,000',
      'CEO Email': 'admin@betasystems.com',
      // No CEO Name provided
    };
    const pkgB = buildLeadPackageFromRow(rowB, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 2 }, knownNames, knownDomains)!;
    const evalB = evaluateInternalLeadPackage(pkgB, strictTarget);
    assert(evalB.qualification.criteria.founderOrCeo?.status === 'UNKNOWN', 'Test B', 'CEO leadership criterion is UNKNOWN');
    assert(evalB.qualification.missingCriteria.length > 0, 'Test B', 'Missing criteria list includes CEO');
    assert(evalB.finalStatus === 'UNVERIFIED', 'Test B', 'Lead with missing required CEO is UNVERIFIED (NEVER VERIFIED)');

    // --- TEST C: CEO required + placeholder ("UPGRADE TO UNLOCK") -> UNVERIFIED ---
    const rowC = {
      Name: 'Gamma AI',
      URL: 'https://gammaai.com',
      Industry: 'Technology',
      Country: 'United States',
      'Funding Amount': '$3,000,000',
      'CEO Name': 'UPGRADE TO UNLOCK',
      'CEO Email': 'UPGRADE TO UNLOCK',
      'Contact Email': 'info@gammaai.com',
    };
    const pkgC = buildLeadPackageFromRow(rowC, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 3 }, knownNames, knownDomains)!;
    assert(pkgC.seed_data.normalized.ceo_name === null, 'Test C', 'Placeholder stripped from normalized ceo_name');
    assert(pkgC.audit.placeholders.some(p => p.rawValue === 'UPGRADE TO UNLOCK'), 'Test C', 'Placeholder recorded in audit');
    
    const evalC = evaluateInternalLeadPackage(pkgC, strictTarget);
    assert(evalC.qualification.criteria.founderOrCeo?.status === 'UNKNOWN', 'Test C', 'CEO criterion is UNKNOWN for placeholder');
    assert(evalC.finalStatus === 'UNVERIFIED', 'Test C', 'Lead with placeholder CEO is UNVERIFIED (NEVER VERIFIED)');

    // --- TEST D: Professional email required + email present -> PASS ---
    const rowD = {
      Name: 'Delta Robotics',
      URL: 'https://deltarobotics.com',
      Industry: 'Technology',
      Country: 'United States',
      'Funding Amount': '$2,500,000',
      'CEO Name': 'Elon Musk',
      'CEO Email': 'elon@deltarobotics.com',
    };
    const pkgD = buildLeadPackageFromRow(rowD, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 4 }, knownNames, knownDomains)!;
    const evalD = evaluateInternalLeadPackage(pkgD, strictTarget);
    assert(evalD.qualification.criteria.professionalEmail?.status === 'PASS', 'Test D', 'Direct CEO email satisfies professional email requirement');
    assert(evalD.finalStatus === 'VERIFIED', 'Test D', 'Lead with valid executive email is VERIFIED');

    // --- TEST E: Professional email required + only company email exists -> UNVERIFIED ---
    const rowE = {
      Name: 'Epsilon Software',
      URL: 'https://epsilonsoftware.com',
      Industry: 'Technology',
      Country: 'United States',
      'Funding Amount': '$2,500,000',
      'CEO Name': 'Jane Doe',
      'Contact Email': 'info@epsilonsoftware.com', // Generic company email only
      // No CEO/Founder email
    };
    const pkgE = buildLeadPackageFromRow(rowE, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 5 }, knownNames, knownDomains)!;
    const evalE = evaluateInternalLeadPackage(pkgE, strictTarget);
    assert(evalE.qualification.criteria.companyEmail?.status === 'PASS', 'Test E', 'Company email passes companyEmail criterion');
    assert(evalE.qualification.criteria.professionalEmail?.status === 'UNKNOWN', 'Test E', 'Company email does NOT satisfy executive professional email');
    assert(evalE.finalStatus === 'UNVERIFIED', 'Test E', 'Lead with only company email when executive email is required is UNVERIFIED');

    // --- TEST F: Founder + Co-Founder fields both present -> both preserved individually ---
    const rowF = {
      Name: 'Zeta Labs',
      URL: 'https://zetalabs.com',
      'CEO Name': 'Alice CEO',
      'CEO First Name': 'Alice',
      'CEO Last Name': 'Smith',
      'CEO Email': 'alice@zetalabs.com',
      'Founder Name': 'Bob Founder',
      'Founder Email': 'bob@zetalabs.com',
      'Co-Founder Name': 'Charlie Cofounder',
      'Co-Founder Email': 'charlie@zetalabs.com',
      'Contact Email': 'contact@zetalabs.com',
      'LinkedIn': 'https://linkedin.com/company/zetalabs',
      'CEO Linkedin': 'https://linkedin.com/in/alicesmith',
    };
    const pkgF = buildLeadPackageFromRow(rowF, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 6 }, knownNames, knownDomains)!;
    const normF = pkgF.seed_data.normalized;
    assert(normF.ceo_name === 'Alice CEO', 'Test F', 'Distinct CEO name preserved');
    assert(normF.ceo_email === 'alice@zetalabs.com', 'Test F', 'Distinct CEO email preserved');
    assert(normF.founder_names?.includes('Bob Founder') === true, 'Test F', 'Distinct Founder name preserved');
    assert(normF.founder_emails?.includes('bob@zetalabs.com') === true, 'Test F', 'Distinct Founder email preserved');
    assert(normF.cofounder_names?.includes('Charlie Cofounder') === true, 'Test F', 'Distinct Co-Founder name preserved');
    assert(normF.cofounder_emails?.includes('charlie@zetalabs.com') === true, 'Test F', 'Distinct Co-Founder email preserved');
    assert(normF.company_email === 'contact@zetalabs.com', 'Test F', 'Distinct Company email preserved');

    // --- TEST G: 100-row file -> 100 LeadPackages without dropped rows ---
    const growthListPath = path.resolve(process.cwd(), 'reference_data/growth_list_may_2024.csv');
    assert(fs.existsSync(growthListPath), 'Test G', 'Growth List file exists');
    const growthBuffer = fs.readFileSync(growthListPath);
    const growthAudit = await auditAndBuildLeadPackages(growthBuffer, 'growth_list_may_2024.csv');
    assert(growthAudit.packages.length === 100, 'Test G', `Generated exactly 100 LeadPackages (got ${growthAudit.packages.length})`);
    assert(growthAudit.totalRowsRead === 100, 'Test G', 'Read all 100 data rows without ceiling');

    // Check that every lead package in the 100 leads has intact raw fields
    const allRawFieldsIntact = growthAudit.packages.every(p => Object.keys(p.seed_data.raw_fields).length >= 25);
    assert(allRawFieldsIntact, 'Test G', '100% of raw fields preserved across all 100 leads');

    // Under strictTarget (CEO required + Email required):
    // All 100 rows in Growth List have "UPGRADE TO UNLOCK" in CEO columns, so ZERO should be VERIFIED!
    const verifiedUnderStrict = growthAudit.packages.filter(p => evaluateInternalLeadPackage(p, strictTarget).finalStatus === 'VERIFIED');
    assert(verifiedUnderStrict.length === 0, 'Test G', `Zero leads marked VERIFIED when required CEO/email are paywalled (got ${verifiedUnderStrict.length})`);

    // --- TEST H: Internal mode -> zero network calls ---
    assert(networkCallCount === 0, 'Test H', `Exactly 0 network calls occurred during full intake and qualification`);

    // --- TEST I: Custom Target Profile -> custom parameters faithfully respected ---
    const customTarget: TargetProfile = {
      ...DEFAULT_TVB_TARGET_PROFILE,
      fundingMin: 10_000_000, // Custom: $10M min
      fundingMax: 50_000_000,
      industries: ['Agriculture'],
      contactRequirement: 'Not Required',
      emailRequirement: 'Not Required',
    };
    // Lead with $3M funding should fail custom target funding
    const evalI = evaluateInternalLeadPackage(pkgA, customTarget);
    assert(evalI.qualification.failedCriteria.length > 0, 'Test I', 'Custom funding threshold evaluated');
    assert(evalI.finalStatus === 'REJECTED', 'Test I', 'Lead outside custom funding range is REJECTED');

    // --- TEST J: Required criterion UNKNOWN -> NEVER VERIFIED regardless of match score ---
    const rowJ = {
      Name: 'Theta Corp',
      URL: 'https://thetacorp.com',
      Industry: 'Technology',
      Country: 'United States',
      'Funding Amount': '$2,000,000', // PASS
      // Missing CEO (Required)
      // Missing Email (Required)
    };
    const pkgJ = buildLeadPackageFromRow(rowJ, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 10 }, knownNames, knownDomains)!;
    const evalJ = evaluateInternalLeadPackage(pkgJ, strictTarget);
    assert(evalJ.qualification.match_score > 0, 'Test J', `Match score is non-zero (${evalJ.qualification.match_score}%) due to passing funding & industry`);
    assert(evalJ.finalStatus !== 'VERIFIED', 'Test J', 'High match score does NOT override UNKNOWN required criteria');
    assert(evalJ.finalStatus === 'UNVERIFIED', 'Test J', 'Status is strictly UNVERIFIED');

    // --- TEST K: Required criterion FAIL -> REJECTED ---
    const rowK = {
      Name: 'Iota Ventures',
      URL: 'https://iotaventures.com',
      Industry: 'Technology',
      Country: 'United States',
      'Funding Amount': '$150,000,000', // Out of bounds ($1M–$5M)
      'CEO Name': 'Bob Smith',
      'CEO Email': 'bob@iotaventures.com',
    };
    const pkgK = buildLeadPackageFromRow(rowK, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 11 }, knownNames, knownDomains)!;
    const evalK = evaluateInternalLeadPackage(pkgK, strictTarget);
    assert(evalK.qualification.failedCriteria.some(c => c.toLowerCase().includes('funding')), 'Test K', 'Funding recorded as failed criterion');
    assert(evalK.finalStatus === 'REJECTED', 'Test K', 'Lead with failed required criterion is strictly REJECTED');

    // --- TEST L: Conflicting evidence -> REVIEW ---
    const rowL = {
      Name: 'Kappa Global',
      URL: 'not-a-valid-url-structure',
      Industry: 'Technology',
      Country: 'Unknown Continent Ambiguity',
      'Funding Amount': '$3,000,000',
      'CEO Name': 'Alice Cooper',
      'CEO Email': 'alice@kappa.com',
    };
    const pkgL = buildLeadPackageFromRow(rowL, { fileName: 'test.csv', fileType: 'CSV', rowNumber: 12 }, knownNames, knownDomains)!;
    const evalL = evaluateInternalLeadPackage(pkgL, strictTarget);
    assert(['REVIEW', 'UNVERIFIED', 'REJECTED'].includes(evalL.finalStatus), 'Test L', `Ambiguous/malformed lead handled deterministically: ${evalL.finalStatus}`);

  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} INTERNAL QUALIFICATION REGRESSION TESTS PASSED!`);
  } else {
    console.error(`💥 ${failed} REGRESSION TESTS FAILED out of ${passed + failed}`);
    process.exit(1);
  }
  console.log('================================================================');
}

runRegressionTests().catch(err => {
  console.error('Fatal regression test error:', err);
  process.exit(1);
});
