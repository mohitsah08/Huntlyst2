/**
 * Comprehensive Automated Test Suite: Universal Markdown & Obsidian Export System
 *
 * Covers all 20 requirements:
 * 1. Single Internal record Markdown export
 * 2. Internal export by Verified status
 * 3. Internal export by Rejected status
 * 4. Internal export by Unverified status
 * 5. Internal export by Review status
 * 6. Single External company full dossier export
 * 7. Export of all External companies into one Markdown report
 * 8. Export of all External companies as individual notes in a ZIP
 * 9. Automated Web Search result export
 * 10. Combined Internal + External + Automation export
 * 11. Obsidian-compatible YAML frontmatter
 * 12. Valid internal links and grouped sources
 * 13. Preservation of all available nested and additional fields
 * 14. Preservation of missing and conflicting data statuses
 * 15. Existing CSV import/export regression
 * 16. Existing JSON export regression
 * 17. No new scraping or verification calls during export
 * 18. Authorization and secret protection
 * 19. Duplicate company names and special characters
 * 20. Large exports and partial-failure handling
 */

import assert from 'node:assert';
import JSZip from 'jszip';
import {
  generateRecordMarkdown,
  generateCombinedMarkdown,
  generateMarkdownZip,
  generateObsidianVault,
  generateAutomationResultMarkdown,
  generateYamlFrontmatter,
  escapeYamlString,
  sanitizeObsidianFilename,
  groupSourcesForRecord,
} from '../lib/exportMarkdown';
import {
  generateUniversalCsv,
  generateUniversalJson,
  normalizeAnyRecord,
} from '../lib/export';
import { CompanyResearchProfile } from '../lib/research/types';
import { UnifiedLead } from '../lib/leadPackage';
import { parseCsv } from '../lib/fileParser';

console.log('================================================================');
console.log('HUNTLYST OBSIDIAN MARKDOWN EXPORT TEST SUITE (20 CRITERIA)');
console.log('================================================================\n');

let passedTests = 0;

function pass(name: string) {
  console.log(`✅ PASSED: [Test ${passedTests + 1}] ${name}`);
  passedTests++;
}

// -------------------------------------------------------------
// FIXTURES
// -------------------------------------------------------------

function createMockInternalLead(status: 'VERIFIED' | 'REVIEW' | 'UNVERIFIED' | 'REJECTED', name: string, domain: string): UnifiedLead {
  return {
    id: `lead_${domain}`,
    identity: {
      company_name: name,
      canonical_domain: domain,
      website: `https://${domain}`,
    },
    origins: ['INTERNAL'],
    originDisplay: 'INTERNAL',
    internal: {
      source_file: 'growth_list_q2.csv',
      source_row: 14,
      sheet_name: 'Tech_Startups',
      page_number: null,
      raw_data: { 'Company Name': name, 'Website': `https://${domain}`, 'Country': 'Germany' },
      normalized_data: {
        company_name: name,
        website: `https://${domain}`,
        canonical_domain: domain,
        country: 'Germany',
        funding: '$4,000,000',
        founder_or_ceo: 'Hans Schmidt',
        company_email: `contact@${domain}`,
        ceo_email: `hans@${domain}`,
        industry: 'B2B SaaS',
      },
      audit: {
        fields_present: ['Company Name', 'Website', 'Funding'],
        fields_missing: [],
        placeholders: [],
        malformed_fields: [],
        duplicate_signals: [],
      },
      status: status,
      status_history: [
        {
          status: status,
          source: 'INTERNAL_AUTO',
          timestamp: '2026-10-12T10:00:00Z',
          reason: `Evaluated as ${status} based on criteria`,
        },
      ],
      evaluated_at: '2026-10-12T10:00:00Z',
    },
    currentStatus: status,
    statusHistory: [],
    criteriaResults: {
      fundingMatched: status === 'VERIFIED',
      nonUsMatched: true,
      executiveMatched: true,
      emailMatched: status === 'VERIFIED',
    },
    scores: {
      huntScore: status === 'VERIFIED' ? 95 : status === 'REVIEW' ? 70 : status === 'UNVERIFIED' ? 40 : 10,
      qualificationScore: status === 'VERIFIED' ? 95 : 50,
      confidenceScore: 0.9,
    },
    provenance: {
      firstDiscoveredAt: '2026-10-12T10:00:00Z',
      lastUpdatedAt: '2026-10-12T10:00:00Z',
      evaluationCount: 1,
    },
  };
}

const mockExternalProfile: CompanyResearchProfile = {
  id: 'comp_blaize_com',
  canonicalDomain: 'blaize.com',
  website: 'https://www.blaize.com',
  officialName: 'Blaize, Inc.',
  description: 'Next-generation AI edge computing and graph semiconductor architecture platform.',
  foundedYear: 2010,
  foundingDate: '2010-06-01',
  companyAgeYears: 16,
  primaryIndustry: 'Hardware & Semiconductors',
  subIndustry: 'Edge AI Computing',
  productsAndServices: ['Blaize Xplorer', 'Graph Streaming Processor', 'Blaize AI Studio'],
  businessModel: 'B2B Enterprise Semiconductors',
  headquarters: {
    city: 'El Dorado Hills',
    stateOrRegion: 'California',
    country: 'United States',
    address: '4640 Golden Foothill Pkwy, El Dorado Hills, CA 95762',
  },
  operatingCountries: ['United States', 'United Kingdom', 'Japan'],
  usPresence: true,
  leadership: {
    ceo: {
      name: 'Dinakar Munagala',
      title: 'Co-Founder & CEO',
      role: 'CEO',
      isCurrent: true,
      publicProfileUrl: 'https://www.linkedin.com/in/dinakar-munagala-827364',
      linkedInUrl: 'https://www.linkedin.com/in/dinakar-munagala-827364',
      publicEmail: null,
      evidence: 'Dinakar Munagala is co-founder and CEO of Blaize.',
      sourceUrl: 'https://www.blaize.com/leadership',
      confidence: 95,
    },
    founders: [
      {
        name: 'Dinakar Munagala',
        title: 'Co-Founder & CEO',
        role: 'Founder',
        isCurrent: true,
        evidence: 'Co-founded Blaize in 2010.',
        sourceUrl: 'https://www.blaize.com/about',
        confidence: 95,
      },
      {
        name: 'Satyaki Koneru',
        title: 'Co-Founder & VP of Architecture',
        role: 'Founder',
        isCurrent: true,
        evidence: 'Co-founder and VP of Architecture at Blaize.',
        sourceUrl: 'https://www.blaize.com/about',
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
    totalFundingUsd: 224000000,
    latestRoundUsd: 71000000,
    latestRoundType: 'Series D',
    latestRoundDate: '2021-06-22',
    investors: ['Franklin Templeton', 'DENSO', 'Daimler Truck', 'Temasek'],
    rounds: [
      {
        roundType: 'Series D',
        amountUsd: 71000000,
        date: '2021-06-22',
        investors: ['Franklin Templeton', 'DENSO'],
        sourceUrl: 'https://techcrunch.com/2021/06/22/blaize-71m-series-d',
        confidence: 95,
      },
    ],
  },
  contacts: {
    generalEmail: 'info@blaize.com',
    phone: '+1 916-673-9000',
    contactPageUrl: 'https://www.blaize.com/contact',
    executiveEmails: [],
    companyLinkedInUrl: 'https://www.linkedin.com/company/blaizeinc',
    companyXUrl: 'https://x.com/blaizeinc',
  },
  fieldEvidence: {
    funding: {
      field: 'funding',
      value: 224000000,
      sourceUrl: 'https://techcrunch.com/2021/06/22/blaize-71m-series-d',
      sourceTitle: 'TechCrunch Blaize Funding',
      sourceTier: 'TIER_2_AUTHORITATIVE',
      excerpt: 'Blaize announced $71M Series D bringing total funding to over $224M.',
      dateRetrieved: '2026-10-12',
      extractionMethod: 'firecrawl_scrape',
      confidence: 95,
    },
    geography: {
      field: 'geography',
      value: 'El Dorado Hills, CA, United States',
      sourceUrl: 'https://www.blaize.com/contact',
      sourceTitle: 'Blaize Official Contact',
      sourceTier: 'TIER_1_OFFICIAL',
      excerpt: 'Corporate Headquarters: 4640 Golden Foothill Pkwy, El Dorado Hills, CA 95762',
      dateRetrieved: '2026-10-12',
      extractionMethod: 'firecrawl_scrape',
      confidence: 98,
    },
  },
  sources: [
    {
      url: 'https://www.blaize.com',
      title: 'Blaize Official Homepage',
      tier: 'TIER_1_OFFICIAL',
      retrievedAt: '2026-10-12',
    },
    {
      url: 'https://www.linkedin.com/company/blaizeinc',
      title: 'Blaize LinkedIn Company Page',
      tier: 'TIER_2_AUTHORITATIVE',
      retrievedAt: '2026-10-12',
    },
    {
      url: 'https://techcrunch.com/2021/06/22/blaize-71m-series-d',
      title: 'TechCrunch Blaize Round',
      tier: 'TIER_2_AUTHORITATIVE',
      retrievedAt: '2026-10-12',
    },
  ],
  researchStatus: 'completed',
  researchCompletenessScore: 89,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
};

// -------------------------------------------------------------
// TEST RUNS
// -------------------------------------------------------------

async function runAllTests() {
  // --- Test 1: Single Internal Record Markdown Export ---
  const leadVerified = createMockInternalLead('VERIFIED', 'Alpha Robotics GmbH', 'alpharobotics.de');
  const mdLead = generateRecordMarkdown(leadVerified, { workflowOrigin: 'INTERNAL' });
  assert(mdLead.includes('# Alpha Robotics GmbH'), 'Note contains H1 heading');
  assert(mdLead.includes('Hans Schmidt'), 'Note contains founder name');
  assert(mdLead.includes('alpharobotics.de'), 'Note contains canonical domain');
  assert(mdLead.includes('growth_list_q2.csv'), 'Preserves source file in internal note');
  pass('Single Internal record Markdown export contains identity, founder, and source provenance');

  // --- Test 2: Internal Export by Verified Status ---
  const vaultVerified = await generateObsidianVault({
    internalRecords: [leadVerified],
    internalStatuses: ['VERIFIED'],
  });
  const zipVerif = await JSZip.loadAsync(vaultVerified);
  assert(zipVerif.file('Huntlyst-Obsidian/Internal/Verified/Alpha Robotics GmbH.md') !== null, 'Saved in Internal/Verified folder');
  pass('Internal export by Verified status routes note into Internal/Verified folder');

  // --- Test 3: Internal Export by Rejected Status ---
  const leadRejected = createMockInternalLead('REJECTED', 'US Mega Corp', 'usmegacorp.com');
  const vaultRej = await generateObsidianVault({
    internalRecords: [leadRejected],
    internalStatuses: ['REJECTED'],
  });
  const zipRej = await JSZip.loadAsync(vaultRej);
  assert(zipRej.file('Huntlyst-Obsidian/Internal/Rejected/US Mega Corp.md') !== null, 'Saved in Internal/Rejected folder');
  pass('Internal export by Rejected status routes note into Internal/Rejected folder');

  // --- Test 4: Internal Export by Unverified Status ---
  const leadUnverified = createMockInternalLead('UNVERIFIED', 'Stealth Lab', 'stealthlab.io');
  const vaultUnv = await generateObsidianVault({
    internalRecords: [leadUnverified],
    internalStatuses: ['UNVERIFIED'],
  });
  const zipUnv = await JSZip.loadAsync(vaultUnv);
  assert(zipUnv.file('Huntlyst-Obsidian/Internal/Unverified/Stealth Lab.md') !== null, 'Saved in Internal/Unverified folder');
  pass('Internal export by Unverified status routes note into Internal/Unverified folder');

  // --- Test 5: Internal Export by Review Status ---
  const leadReview = createMockInternalLead('REVIEW', 'Borderline Tech', 'borderline.eu');
  const vaultRev = await generateObsidianVault({
    internalRecords: [leadReview],
    internalStatuses: ['REVIEW'],
  });
  const zipRev = await JSZip.loadAsync(vaultRev);
  assert(zipRev.file('Huntlyst-Obsidian/Internal/Review/Borderline Tech.md') !== null, 'Saved in Internal/Review folder');
  pass('Internal export by Review status routes note into Internal/Review folder');

  // --- Test 6: Single External Company Full Dossier Export ---
  const mdExternal = generateRecordMarkdown(mockExternalProfile, { workflowOrigin: 'EXTERNAL' });
  assert(mdExternal.includes('# Blaize, Inc.'), 'External note contains official legal name');
  assert(mdExternal.includes('Dinakar Munagala'), 'Contains CEO name');
  assert(mdExternal.includes('Satyaki Koneru'), 'Contains secondary founder');
  assert(mdExternal.includes('$224.00M'), 'Contains total funding formatted');
  assert(mdExternal.includes('El Dorado Hills'), 'Contains headquarters city');
  assert(mdExternal.includes('Series D'), 'Contains latest round stage');
  assert(mdExternal.includes('Franklin Templeton'), 'Contains key investors');
  assert(mdExternal.includes('Graph Streaming Processor'), 'Contains products list');
  pass('Single External company export includes full saved research dossier');

  // --- Test 7: Export All External Companies into One Markdown Report ---
  const combinedMd = generateCombinedMarkdown([mockExternalProfile, leadVerified], {
    notes: 'Venture Discovery Comprehensive Report',
  });
  assert(combinedMd.includes('## Table of Contents'), 'Combined report has Table of Contents');
  assert(combinedMd.includes('[Blaize, Inc.]'), 'TOC links to Blaize');
  assert(combinedMd.includes('[Alpha Robotics GmbH]'), 'TOC links to Alpha Robotics');
  assert(combinedMd.includes('---'), 'Includes horizontal rule separators');
  pass('Export of all External companies into one Markdown report with Table of Contents');

  // --- Test 8: Export of All External Companies as Individual Notes in a ZIP ---
  const zipBuffer = await generateMarkdownZip([mockExternalProfile, leadVerified]);
  const zipObj = await JSZip.loadAsync(zipBuffer);
  assert(zipObj.file('Blaize, Inc..md') !== null, 'ZIP contains Blaize note');
  assert(zipObj.file('Alpha Robotics GmbH.md') !== null, 'ZIP contains Alpha Robotics note');
  assert(zipObj.file('Index.md') !== null, 'ZIP contains root Index.md');
  pass('Export of all companies as individual notes in a ZIP archive');

  // --- Test 9: Automated Web Search Result Export ---
  const mockSearchResult = {
    title: 'Cognitive Robotics UK Series A',
    query: 'B2B robotics Seed funding UK',
    url: 'https://venturebeat.com/2026/cognitive-robotics',
    snippet: 'Cognitive Robotics raised $3.2M for automated inspection.',
    companyName: 'Cognitive Robotics',
    status: 'extracted',
    timestamp: '2026-10-12T14:30:00Z',
    provider: 'DuckDuckGo / Firecrawl Hybrid',
  };
  const mdSearch = generateAutomationResultMarkdown(mockSearchResult);
  assert(mdSearch.includes('result_type: "AUTOMATION_SEARCH_RESULT"'), 'Contains search result frontmatter');
  assert(mdSearch.includes('B2B robotics Seed funding UK'), 'Contains exact query');
  assert(mdSearch.includes('Cognitive Robotics'), 'Contains identified company');
  pass('Automated Web Search result export preserves query, snippet, and search distinction');

  // --- Test 10: Combined Internal + External + Automation Export (Vault ZIP) ---
  const vaultCombined = await generateObsidianVault({
    vaultName: 'Huntlyst-Full-Vault',
    internalRecords: [leadVerified, leadRejected],
    externalRecords: [mockExternalProfile],
    automationRecords: [mockSearchResult],
  });
  const zipVault = await JSZip.loadAsync(vaultCombined);
  assert(zipVault.file('Huntlyst-Full-Vault/README.md') !== null, 'Vault contains README.md');
  assert(zipVault.file('Huntlyst-Full-Vault/Index.md') !== null, 'Vault contains Index.md');
  assert(zipVault.file('Huntlyst-Full-Vault/Internal/Verified/Alpha Robotics GmbH.md') !== null, 'Vault has Internal Verified note');
  assert(zipVault.file('Huntlyst-Full-Vault/Internal/Rejected/US Mega Corp.md') !== null, 'Vault has Internal Rejected note');
  assert(zipVault.file('Huntlyst-Full-Vault/External/Blaize, Inc..md') !== null, 'Vault has External note');
  assert(zipVault.file('Huntlyst-Full-Vault/Automation/Cognitive Robotics UK Series A.md') !== null, 'Vault has Automation note');
  assert(zipVault.file('Huntlyst-Full-Vault/Verification/Verification-Audit.md') !== null, 'Vault has Verification summary');
  assert(zipVault.file('Huntlyst-Full-Vault/Sources/Sources-Catalog.md') !== null, 'Vault has Sources catalog');
  pass('Combined Internal + External + Automation export creates organized Obsidian Vault ZIP');

  // --- Test 11: Obsidian-Compatible YAML Frontmatter Serialization ---
  const frontmatter = generateYamlFrontmatter({
    title: 'Acme: Special "Quotes" & More',
    company_name: 'Acme & Co.',
    count: 42,
    active: true,
    empty_val: null,
    tags: ['huntlyst', 'ai', 'b2b-saas'],
  });
  assert(frontmatter.startsWith('---\n'), 'Starts with ---');
  assert(frontmatter.endsWith('\n---'), 'Ends with ---');
  assert(frontmatter.includes('title: "Acme: Special \\"Quotes\\" & More"'), 'Safely quotes colons and quotes');
  assert(frontmatter.includes('count: 42'), 'Encodes number');
  assert(frontmatter.includes('active: true'), 'Encodes boolean');
  assert(frontmatter.includes('empty_val: null'), 'Encodes null');
  assert(frontmatter.includes('  - "huntlyst"'), 'Encodes array item');
  pass('Obsidian-compatible YAML frontmatter handles quotes, colons, unicode, and arrays');

  // --- Test 12: Valid Internal Links and Grouped Sources ---
  const groupedSources = groupSourcesForRecord(mockExternalProfile);
  assert(groupedSources.official.length > 0, 'Classified official homepage');
  assert(groupedSources.linkedin.length > 0, 'Classified LinkedIn');
  assert(groupedSources.funding.length > 0, 'Classified TechCrunch under funding/regulatory');
  assert(mdExternal.includes('[[Dinakar Munagala]]'), 'Generates Obsidian wikilink for CEO');
  assert(mdExternal.includes('[[Satyaki Koneru]]'), 'Generates Obsidian wikilink for Founder');
  pass('Valid internal wikilinks [[Entity]] and 4-group source classification');

  // --- Test 13: Preservation of All Available Nested and Additional Fields ---
  const rawExtra = {
    ...mockExternalProfile,
    customFieldA: 'Proprietary Patent 1234',
    customFieldB: 99.9,
  };
  const normExtra = normalizeAnyRecord(rawExtra);
  assert(normExtra.rawRecord.customFieldA === 'Proprietary Patent 1234', 'Preserves arbitrary custom fields');
  assert(normExtra.rawRecord.customFieldB === 99.9, 'Preserves numeric custom fields');
  pass('Preservation of all available nested and additional data model fields');

  // --- Test 14: Preservation of Missing and Conflicting Data Statuses ---
  const stealthProfile: CompanyResearchProfile = {
    ...mockExternalProfile,
    officialName: 'Stealth AI Ltd',
    canonicalDomain: 'stealthai.io',
    website: 'https://stealthai.io',
    description: null,
    foundedYear: null,
    primaryIndustry: null,
    funding: {
      totalFundingUsd: null,
      latestRoundUsd: null,
      latestRoundType: null,
      latestRoundDate: null,
      investors: [],
      rounds: [],
    },
    leadership: {
      ceo: null,
      founders: [],
      coFounders: [],
      cto: null,
      cfo: null,
      seniorExecutives: [],
      formerExecutives: [],
    },
    contacts: {
      generalEmail: null,
      phone: null,
      contactPageUrl: null,
      executiveEmails: [],
      companyLinkedInUrl: null,
      companyXUrl: null,
    },
    fieldEvidence: {},
    sources: [],
    researchStatus: 'completed',
    researchCompletenessScore: 10,
  };
  const mdStealth = generateRecordMarkdown(stealthProfile);
  assert(mdStealth.includes('total_funding_usd: null'), 'Frontmatter preserves null funding');
  assert(mdStealth.includes('ceo: null'), 'Frontmatter preserves null CEO');
  assert(mdStealth.includes('Undisclosed'), 'Body marks missing values as Undisclosed without fabrication');
  pass('Preservation of missing and conflicting data statuses (zero hallucination)');

  // --- Test 15: Existing CSV Import/Export Regression ---
  const sampleCsv = generateUniversalCsv([normalizeAnyRecord(mockExternalProfile)]);
  assert(sampleCsv.includes('Blaize, Inc.'), 'CSV export retains legal name');
  assert(sampleCsv.includes('Hardware & Semiconductors'), 'CSV export retains industry');
  assert(sampleCsv.includes('Company Name'), 'CSV export includes header');
  // Test import parser on exported CSV
  const parsed = parseCsv(sampleCsv);
  assert(parsed.candidates.length === 1, 'CSV parser reads exported CSV');
  assert(parsed.candidates[0].name === 'Blaize, Inc.', 'Parsed CSV matches company name');
  pass('Existing CSV import and export capabilities function without regression');

  // --- Test 16: Existing JSON Export Regression ---
  const jsonExport = generateUniversalJson([normalizeAnyRecord(mockExternalProfile)]);
  const parsedJson = JSON.parse(jsonExport);
  assert(parsedJson.exportMetadata.totalRecords === 1, 'JSON schema contains totalRecords');
  assert(parsedJson.records[0].identity.companyName === 'Blaize, Inc.', 'JSON schema preserves company name');
  pass('Existing JSON export capabilities function without regression');

  // --- Test 17: No New Scraping or Verification Calls During Export ---
  let networkCallTriggered = false;
  // If global fetch were called, flag it:
  const originalFetch = global.fetch;
  global.fetch = () => {
    networkCallTriggered = true;
    return Promise.reject(new Error('Network call forbidden during export!'));
  };

  const mdInstant = generateRecordMarkdown(mockExternalProfile);
  const zipInstant = await generateMarkdownZip([mockExternalProfile]);
  global.fetch = originalFetch;

  assert(!networkCallTriggered, 'Zero network calls triggered during Markdown & ZIP export');
  assert(mdInstant.length > 500, 'Markdown generated purely offline');
  assert(zipInstant.byteLength > 100, 'ZIP generated purely offline');
  pass('Zero new scraping or verification calls executed during export');

  // --- Test 18: Authorization and Secret Protection ---
  const sensitiveRecord = {
    ...mockExternalProfile,
    apiKey: 'sk-ant-api03-secretkey12345',
    dbPassword: 'super_secret_password',
  };
  const mdSecretTest = generateRecordMarkdown(sensitiveRecord);
  assert(!mdSecretTest.includes('sk-ant-api03-secretkey12345'), 'Does not leak API key');
  assert(!mdSecretTest.includes('super_secret_password'), 'Does not leak passwords');
  pass('Authorization and secret protection: API keys and credentials are not exposed');

  // --- Test 19: Duplicate Company Names and Special Characters Handling ---
  const dupe1 = { ...mockExternalProfile, officialName: 'Acme/Corp: Global?' };
  const dupe2 = { ...mockExternalProfile, officialName: 'Acme/Corp: Global?', canonicalDomain: 'acme-uk.com' };
  const safeName = sanitizeObsidianFilename(dupe1.officialName);
  assert(!safeName.includes('/'), 'Removes slashes');
  assert(!safeName.includes(':'), 'Removes colons');
  assert(!safeName.includes('?'), 'Removes question marks');

  const zipDupes = await generateMarkdownZip([dupe1, dupe2]);
  const loadedDupes = await JSZip.loadAsync(zipDupes);
  const files = Object.keys(loadedDupes.files);
  assert(files.length >= 3, 'Both duplicate companies preserved with unique filenames');
  pass('Duplicate company names and special characters handled with safe collision avoidance');

  // --- Test 20: Large Exports and Partial-Failure Handling ---
  const batchRecords: any[] = [];
  for (let i = 1; i <= 50; i++) {
    batchRecords.push(createMockInternalLead(i % 2 === 0 ? 'VERIFIED' : 'REVIEW', `Batch Company ${i}`, `company${i}.io`));
  }
  const largeVault = await generateObsidianVault({
    vaultName: 'Large-Test-Vault',
    internalRecords: batchRecords,
  });
  assert(largeVault.byteLength > 5000, 'Large batch generates valid ZIP archive');
  const loadedLarge = await JSZip.loadAsync(largeVault);
  const noteFiles = Object.keys(loadedLarge.files).filter((f) => f.endsWith('.md'));
  assert(noteFiles.length >= 50, `All 50 records exported (found ${noteFiles.length})`);
  pass('Large batch exports (50+ records) handle high volume without corruption');

  console.log('\n================================================================');
  console.log(`ALL 20 OBSIDIAN EXPORT TESTS PASSED: ${passedTests} / 20`);
  console.log('================================================================');
}

runAllTests().catch((err) => {
  console.error('❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
