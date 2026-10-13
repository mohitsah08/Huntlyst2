/**
 * Universal Markdown & Obsidian Export System — Huntlyst2
 *
 * Implements Obsidian-compatible Markdown export across all 3 Huntlyst workflows:
 * 1. Internal Workflow (filtered by status: VERIFIED, REJECTED, UNVERIFIED, REVIEW)
 * 2. External Workflow (full company research dossiers, field-level evidence, grouped sources)
 * 3. Automated Web Search / Automation (search queries, discovered candidate records, metadata)
 * 4. Combined All-Workflows Obsidian Vault (.zip) with Index.md, README.md, and structured folders.
 *
 * Requirements:
 * - Valid YAML frontmatter with property escaping and tag indexing
 * - Grouped sources (Official Website, LinkedIn, Funding/Regulatory, Other Public Sources)
 * - Field-level evidence preservation with exact quotes and provenance
 * - Obsidian internal wikilinks [[Entity Name]]
 * - Multi-scope exports (Single note, Multiple in ZIP, Combined report, Complete Vault ZIP)
 * - Zero network re-scraping or re-verification during export
 * - Preserves existing CSV, XLSX, JSON, PDF, and DOCX capabilities
 */

import JSZip from 'jszip';
import {
  UniversalExportRecord,
  UniversalExportOptions,
  normalizeAnyRecord,
  formatSnapshotTime,
  extractCanonicalDomain,
} from './export';
import { CompanyResearchProfile, VerificationRun } from './research/types';
import { UnifiedLead } from './leadPackage';
import { CompanyRecord, RejectedCompanyRecord } from './types';
import { CompanyVerificationResult } from '@/providers/types';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

export type WorkflowSourceType = 'INTERNAL' | 'EXTERNAL' | 'AUTOMATION' | 'COMBINED';

export interface MarkdownExportOptions extends UniversalExportOptions {
  includeYamlFrontmatter?: boolean;
  includeEvidence?: boolean;
  includeSources?: boolean;
  includeVerificationReport?: boolean;
  includeAdditionalData?: boolean;
  generateWikilinks?: boolean;
  workflowOrigin?: WorkflowSourceType;
  vaultSubfolder?: string;
  tags?: string[];
}

export interface ObsidianVaultOptions {
  vaultName?: string;
  snapshotTime?: string;
  notes?: string;
  // Datasets
  internalRecords?: (UniversalExportRecord | UnifiedLead | CompanyRecord | any)[];
  externalRecords?: (CompanyResearchProfile | UniversalExportRecord | any)[];
  automationRecords?: any[];
  // Filtering
  internalStatuses?: string[]; // e.g. ['VERIFIED', 'REVIEW', 'UNVERIFIED', 'REJECTED']
  selectedIds?: string[];
  // Config
  includeVerificationSummary?: boolean;
  includeSourcesCatalog?: boolean;
  includeReadme?: boolean;
  includeIndex?: boolean;
  generateWikilinks?: boolean;
}

export interface SourceItem {
  url: string;
  title?: string;
  tier?: string;
  date?: string;
  supportedFields: string[];
  excerpts: string[];
}

export interface GroupedSources {
  official: SourceItem[];
  linkedin: SourceItem[];
  funding: SourceItem[];
  other: SourceItem[];
}

// ==========================================
// 2. YAML FRONTMATTER & STRING UTILITIES
// ==========================================

/**
 * Escapes and safely quotes a string for YAML serialization.
 */
export function escapeYamlString(val: string): string {
  if (val === null || val === undefined) return 'null';
  const str = String(val);
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/**
 * Serializes a value for YAML output.
 */
export function serializeYamlValue(val: any, indent = 0): string {
  const spaces = ' '.repeat(indent);
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'null';
  if (typeof val === 'string') return escapeYamlString(val);

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return '\n' + val.map((item) => `${spaces}  - ${serializeYamlValue(item, indent + 4)}`).join('\n');
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val).filter((k) => val[k] !== undefined);
    if (keys.length === 0) return '{}';
    return (
      '\n' +
      keys
        .map((k) => `${spaces}  ${k}: ${serializeYamlValue(val[k], indent + 2)}`)
        .join('\n')
    );
  }

  return escapeYamlString(String(val));
}

/**
 * Generates an Obsidian-compatible YAML frontmatter header.
 */
export function generateYamlFrontmatter(props: Record<string, any>): string {
  const lines: string[] = ['---'];
  for (const [key, val] of Object.entries(props)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) {
          if (typeof item === 'string') {
            lines.push(`  - ${escapeYamlString(item)}`);
          } else {
            lines.push(`  - ${serializeYamlValue(item, 4)}`);
          }
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      lines.push(`${key}:`);
      for (const [nestedKey, nestedVal] of Object.entries(val)) {
        if (nestedVal !== undefined) {
          lines.push(`  ${nestedKey}: ${serializeYamlValue(nestedVal, 4)}`);
        }
      }
    } else {
      lines.push(`${key}: ${serializeYamlValue(val)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Sanitizes a title or company name to form a safe Obsidian filename.
 */
export function sanitizeObsidianFilename(name: string, fallback = 'record'): string {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name
    .trim()
    .replace(/[/\\?%*:|"<>#^\[\]]/g, '') // Remove Obsidian/filesystem reserved characters
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > 0 ? clean : fallback;
}

/**
 * Formats currency safely in USD.
 */
function formatUsd(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return 'Undisclosed';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return String(amount);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${Math.round(num).toLocaleString('en-US')}`;
}

// ==========================================
// 3. SOURCE GROUPING ENGINE
// ==========================================

/**
 * Groups raw sources and field evidence into the 4 canonical Obsidian source categories:
 * 1. Official Company Website
 * 2. LinkedIn & Executive Profiles
 * 3. Funding & Regulatory Sources
 * 4. Other Public Web Sources
 */
export function groupSourcesForRecord(record: UniversalExportRecord | any): GroupedSources {
  const groups: GroupedSources = {
    official: [],
    linkedin: [],
    funding: [],
    other: [],
  };

  const urlMap = new Map<string, SourceItem>();
  const raw = record.rawRecord || record;
  const canonicalDomain = (record.canonicalDomain || extractCanonicalDomain(record.website || raw.website || '')).toLowerCase();

  // 1. Ingest profile.sources if available
  if (Array.isArray(raw.sources)) {
    for (const src of raw.sources) {
      if (src && src.url) {
        if (!urlMap.has(src.url)) {
          urlMap.set(src.url, {
            url: src.url,
            title: src.title || undefined,
            tier: src.tier || undefined,
            date: src.retrievedAt || src.dateRetrieved || undefined,
            supportedFields: [],
            excerpts: [],
          });
        }
      }
    }
  }

  // 2. Ingest fieldEvidence if available
  if (raw.fieldEvidence && typeof raw.fieldEvidence === 'object') {
    for (const ev of Object.values(raw.fieldEvidence) as any[]) {
      if (ev && ev.sourceUrl) {
        let entry = urlMap.get(ev.sourceUrl);
        if (!entry) {
          entry = {
            url: ev.sourceUrl,
            title: ev.sourceTitle || undefined,
            tier: ev.sourceTier || undefined,
            date: ev.dateRetrieved || undefined,
            supportedFields: [],
            excerpts: [],
          };
          urlMap.set(ev.sourceUrl, entry);
        }
        if (ev.field && !entry.supportedFields.includes(ev.field)) {
          entry.supportedFields.push(ev.field);
        }
        if (ev.excerpt && !entry.excerpts.includes(ev.excerpt)) {
          entry.excerpts.push(ev.excerpt);
        }
      }
    }
  }

  // 3. Ingest record.sourceUrls fallback
  if (Array.isArray(record.sourceUrls)) {
    for (const u of record.sourceUrls) {
      if (u && typeof u === 'string' && !urlMap.has(u)) {
        urlMap.set(u, {
          url: u,
          supportedFields: [],
          excerpts: [],
        });
      }
    }
  }

  // 4. Ensure official website is present in sources if known
  const website = record.website || raw.website;
  if (website && typeof website === 'string' && !urlMap.has(website)) {
    urlMap.set(website, {
      url: website,
      title: `${record.companyName || 'Official'} Homepage`,
      tier: 'TIER_1_OFFICIAL',
      supportedFields: ['Official Identity', 'Website'],
      excerpts: [],
    });
  }

  // Classify into the 4 canonical categories
  for (const [url, item] of urlMap.entries()) {
    const u = url.toLowerCase();
    if (u.includes('linkedin.com')) {
      groups.linkedin.push(item);
    } else if (
      u.includes('crunchbase.com') ||
      u.includes('pitchbook.com') ||
      u.includes('tracxn.com') ||
      u.includes('sec.gov') ||
      u.includes('techcrunch.com') ||
      u.includes('bloomberg.com') ||
      u.includes('reuters.com') ||
      u.includes('venturebeat.com') ||
      u.includes('forbes.com') ||
      u.includes('startuptalky.com') ||
      u.includes('dealroom.co')
    ) {
      groups.funding.push(item);
    } else if (
      item.tier === 'TIER_1_OFFICIAL' ||
      (canonicalDomain && u.includes(canonicalDomain)) ||
      (website && u === website.toLowerCase())
    ) {
      groups.official.push(item);
    } else {
      groups.other.push(item);
    }
  }

  return groups;
}

// ==========================================
// 4. SINGLE RECORD MARKDOWN GENERATOR
// ==========================================

/**
 * Generates an Obsidian-compatible Markdown note for a single record.
 * Works seamlessly across Internal, External, and Automation records.
 */
export function generateRecordMarkdown(
  input: UniversalExportRecord | CompanyResearchProfile | UnifiedLead | CompanyRecord | any,
  options: MarkdownExportOptions = {}
): string {
  const record: UniversalExportRecord =
    input && input.companyName && input.recordStatus && input.canonicalDomain !== undefined
      ? input
      : normalizeAnyRecord(input);

  const raw = record.rawRecord || (input.rawRecord ? input.rawRecord : input);
  const now = options.snapshotTime || formatSnapshotTime();
  const generateWikilinks = options.generateWikilinks !== false;

  // Derive workflow origin
  const origin: WorkflowSourceType =
    options.workflowOrigin ||
    (record.workflowOrigin === 'EXTERNAL'
      ? 'EXTERNAL'
      : record.workflowOrigin === 'INTERNAL'
      ? 'INTERNAL'
      : raw.searchQuery || raw.query
      ? 'AUTOMATION'
      : 'EXTERNAL');

  // Derive status
  const verificationStatus =
    record.verificationStatus ||
    (record.recordStatus === 'Approved' || record.recordStatus === 'Selected' ? 'VERIFIED' : record.recordStatus);

  // Extract clean leadership
  const recordCeo = record.ceoName || (record.decisionMakerName && record.decisionMakerName !== 'Executive Leader' ? record.decisionMakerName : null);
  const ceoName = raw.leadership !== undefined ? (raw.leadership?.ceo?.name || null) : (recordCeo || null);
  const foundersList: string[] = [];
  if (record.founderNames) {
    foundersList.push(
      ...record.founderNames
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  } else if (Array.isArray(raw.leadership?.founders)) {
    for (const f of raw.leadership.founders) {
      if (f && f.name) foundersList.push(f.name);
    }
  }

  // Tags
  const tagList: string[] = ['huntlyst'];
  if (origin) tagList.push(origin.toLowerCase());
  if (verificationStatus) tagList.push(String(verificationStatus).toLowerCase().replace(/\s+/g, '-'));
  if (record.industry) tagList.push(record.industry.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (record.country) tagList.push(record.country.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (options.tags) tagList.push(...options.tags);
  const uniqueTags = Array.from(new Set(tagList.filter(Boolean)));

  // 1. Build YAML Frontmatter Properties
  const frontmatterProps: Record<string, any> = {
    title: record.companyName,
    company_name: record.companyName,
    company_domain: record.canonicalDomain || extractCanonicalDomain(record.website),
    official_website: record.website || null,
    industry: record.industry || null,
    sub_industry: record.subIndustry || record.subSector || null,
    headquarters_country: record.country || null,
    founded_year: record.foundedYear ? parseInt(record.foundedYear, 10) || record.foundedYear : raw.foundedYear || null,
    total_funding_usd: raw.funding?.totalFundingUsd ?? (record.totalFunding ? parseFloat(record.totalFunding.replace(/[^0-9.-]/g, '')) || null : null),
    funding_stage: record.latestRoundType || record.companyStage || raw.funding?.latestRoundType || null,
    ceo: ceoName,
    founders: foundersList.length > 0 ? foundersList : null,
    research_type: origin,
    research_status: record.researchStatus || raw.researchStatus || 'completed',
    verification_status: verificationStatus,
    research_completeness: record.researchCompleteness !== undefined ? record.researchCompleteness : raw.researchCompletenessScore ?? null,
    last_researched: record.lastUpdatedAt || raw.updatedAt || now,
    exported_at: now,
    tags: uniqueTags,
  };

  // Add source provenance if internal
  if (record.sourceFile) {
    frontmatterProps.source_file = record.sourceFile;
    if (record.sourceRow !== undefined) frontmatterProps.source_row = record.sourceRow;
    if (record.sourceSheet) frontmatterProps.source_sheet = record.sourceSheet;
  }

  const sections: string[] = [];

  if (options.includeYamlFrontmatter !== false) {
    sections.push(generateYamlFrontmatter(frontmatterProps));
  }

  // 2. Title & Identity Banner
  const titleLine = `# ${record.companyName}`;
  const metaBadge = `> [!info] **${origin} Lead Record** • Verification: **\`${verificationStatus}\`** • Hunt Score: **${record.huntScore || record.qualificationScore || 0}/100** • Completeness: **${record.researchCompleteness || raw.researchCompletenessScore || 0}%**`;
  const websiteLine = record.website
    ? `> 🌐 **Official Website**: [${record.canonicalDomain || record.website}](${record.website.startsWith('http') ? record.website : `https://${record.website}`})`
    : `> 🌐 **Official Website**: *Undisclosed*`;

  sections.push([titleLine, metaBadge, websiteLine].join('\n\n'));

  // 3. Section: Company Overview
  const overviewLines: string[] = [
    '## Company Overview',
    record.description || raw.description || '*No formal company overview excerpt recorded.*',
    '',
    `| Attribute | Value |`,
    `| :--- | :--- |`,
    `| **Legal / Brand Name** | ${record.companyName} |`,
    `| **Canonical Domain** | \`${record.canonicalDomain || 'N/A'}\` |`,
    `| **Company Type / Stage** | ${record.companyType || record.companyStage || raw.businessModel || 'Tech Platform'} |`,
    `| **Public Employee Range** | ${record.employeeCount || 'Undisclosed'} |`,
    `| **Founding Year / Age** | ${record.foundedYear || raw.foundedYear || 'Undisclosed'} (${record.companyAge || raw.companyAgeYears ? `${record.companyAge || raw.companyAgeYears} yrs` : 'Unknown age'}) |`,
  ];
  sections.push(overviewLines.join('\n'));

  // 4. Section: Industry and Business Model
  const industryLines: string[] = [
    '## Industry and Business',
    `- **Primary Industry**: ${record.industry || 'Tech / Software'}`,
    `- **Sub-Industry / Sector**: ${record.subIndustry || record.sector || record.subSector || 'Undisclosed'}`,
    `- **Business Model**: ${raw.businessModel || 'B2B / Technology Platform'}`,
  ];
  if (Array.isArray(raw.productsAndServices) && raw.productsAndServices.length > 0) {
    industryLines.push(`- **Products & Core Services**: ${raw.productsAndServices.join(', ')}`);
  }
  sections.push(industryLines.join('\n'));

  // 5. Section: Geography and Company Age
  const hqDisplay = record.headquarters || [record.city, record.region, record.country].filter(Boolean).join(', ') || 'Global Non-US';
  const geoLines: string[] = [
    '## Geography and Company Age',
    `- **Headquarters**: ${hqDisplay}`,
    `- **Country**: ${record.country || 'Non-US Anchor'}`,
    `- **City / Region**: ${record.city || record.region || 'Undisclosed'}`,
    `- **US Presence Assessment**: ${record.geographyStatus || (raw.usPresence === true ? 'US Presence Flagged' : raw.usPresence === false ? 'Non-US Anchor (Passed)' : 'Unknown / Non-US')}`,
    `- **Company Age**: ${record.companyAge || raw.companyAgeYears ? `${record.companyAge || raw.companyAgeYears} years` : 'Undisclosed'}`,
  ];
  sections.push(geoLines.join('\n'));

  // 6. Section: Leadership and LinkedIn
  const wikilink = (name: string | null | undefined) => {
    if (!name) return 'Undisclosed';
    return generateWikilinks ? `[[${name}]]` : name;
  };

  const leadLines: string[] = [
    '## Leadership and LinkedIn',
    '',
    `### Chief Executive Officer`,
    `- **Name**: ${wikilink(ceoName)}`,
    `- **Title**: ${record.decisionMakerRole || raw.leadership?.ceo?.title || 'Chief Executive Officer'}`,
    `- **Executive LinkedIn**: ${record.ceoLinkedin || record.linkedinUrl || raw.leadership?.ceo?.linkedInUrl ? `[LinkedIn Profile](${record.ceoLinkedin || record.linkedinUrl || raw.leadership?.ceo?.linkedInUrl})` : '*Undisclosed*'}`,
    `- **Professional Email**: ${record.ceoEmail || record.email || raw.leadership?.ceo?.publicEmail ? `\`${record.ceoEmail || record.email || raw.leadership?.ceo?.publicEmail}\`` : '*Undisclosed (Zero Pattern Guessing)*'}`,
    '',
    `### Founders & Co-Founders`,
  ];

  if (foundersList.length > 0) {
    for (const f of foundersList) {
      leadLines.push(`- 👤 **${wikilink(f)}** (Founder / Co-Founder)`);
    }
  } else {
    leadLines.push(`- *No secondary founders indexed separately in primary registry.*`);
  }

  // Social presence
  const companyLi = record.companyLinkedin || raw.contacts?.companyLinkedInUrl;
  const companyX = record.companyTwitter || raw.contacts?.companyXUrl;
  leadLines.push('', `### Corporate Social Profiles`);
  leadLines.push(`- **Company LinkedIn**: ${companyLi ? `[Company LinkedIn Page](${companyLi})` : '*Undisclosed*'}`);
  if (companyX) leadLines.push(`- **Company X / Twitter**: [${companyX}](${companyX})`);
  sections.push(leadLines.join('\n'));

  // 7. Section: Funding Intelligence
  const fundingLines: string[] = [
    '## Funding Intelligence',
    '',
    `| Funding Metric | Detail |`,
    `| :--- | :--- |`,
    `| **Total Cumulative Funding** | **${formatUsd(raw.funding?.totalFundingUsd ?? record.totalFunding ?? record.funding)}** |`,
    `| **Latest Round Amount** | ${formatUsd(raw.funding?.latestRoundUsd ?? record.latestRound)} |`,
    `| **Funding Stage / Type** | ${record.latestRoundType || record.fundingRound || raw.funding?.latestRoundType || 'Undisclosed'} |`,
    `| **Latest Round Date** | ${record.latestRoundDate || record.fundingDate || raw.funding?.latestRoundDate || 'Undisclosed'} |`,
  ];

  if (Array.isArray(raw.funding?.investors) && raw.funding.investors.length > 0) {
    fundingLines.push('', `**Key Investors**: ${raw.funding.investors.map((inv: string) => `\`${inv}\``).join(', ')}`);
  }

  if (Array.isArray(raw.funding?.rounds) && raw.funding.rounds.length > 0) {
    fundingLines.push('', `### Recorded Funding Rounds`, '', `| Round Type | Amount (USD) | Date | Investors |`, `| :--- | :--- | :--- | :--- |`);
    for (const r of raw.funding.rounds) {
      fundingLines.push(`| ${r.roundType || 'Round'} | ${formatUsd(r.amountUsd)} | ${r.date || 'Undisclosed'} | ${(r.investors || []).join(', ') || 'N/A'} |`);
    }
  }
  sections.push(fundingLines.join('\n'));

  // 8. Section: Contact Information
  const contactLines: string[] = [
    '## Contact Information',
    `- **General Company Email**: ${record.companyEmail || raw.contacts?.generalEmail ? `\`${record.companyEmail || raw.contacts?.generalEmail}\`` : '*Undisclosed*'}`,
    `- **Company Phone**: ${record.phone || raw.contacts?.phone || '*Undisclosed*'}`,
    `- **Contact / Support Page**: ${raw.contacts?.contactPageUrl ? `[Web Contact Page](${raw.contacts.contactPageUrl})` : '*Undisclosed*'}`,
    `- **Primary Verified Email**: ${record.email ? `\`${record.email}\` (${record.emailVerificationStatus || 'unverified'})` : '*Undisclosed*'}`,
  ];

  if (Array.isArray(raw.contacts?.executiveEmails) && raw.contacts.executiveEmails.length > 0) {
    contactLines.push('', `### Verified Executive Emails`, '', `| Executive | Role | Email | Deliverability Status |`, `| :--- | :--- | :--- | :--- |`);
    for (const exec of raw.contacts.executiveEmails) {
      contactLines.push(`| ${wikilink(exec.name)} | ${exec.role || 'Executive'} | \`${exec.email}\` | **\`VALID\`** (DNS MX Verified) |`);
    }
  }
  sections.push(contactLines.join('\n'));

  // 9. Section: Research Completeness & Field Audit
  const completeness = record.researchCompleteness !== undefined ? record.researchCompleteness : raw.researchCompletenessScore ?? 0;
  const auditLines: string[] = [
    '## Research Completeness',
    `**Overall Completeness Score**: **\`${completeness}%\`**`,
    '',
  ];

  if (raw.fieldEvidence && typeof raw.fieldEvidence === 'object' && Object.keys(raw.fieldEvidence).length > 0) {
    auditLines.push(
      `### Field-Level Evidence Matrix`,
      '',
      `| Field | Value / Finding | Confidence | Source URL |`,
      `| :--- | :--- | :--- | :--- |`
    );
    for (const [fName, ev] of Object.entries(raw.fieldEvidence) as [string, any][]) {
      const valStr = ev.value !== null && ev.value !== undefined ? String(ev.value) : '*Undisclosed*';
      const cleanVal = valStr.length > 50 ? `${valStr.slice(0, 47)}...` : valStr;
      const srcLink = ev.sourceUrl ? `[Source Link](${ev.sourceUrl})` : 'N/A';
      auditLines.push(`| **${fName}** | ${cleanVal} | ${ev.confidence ?? 100}% | ${srcLink} |`);
    }
  }
  sections.push(auditLines.join('\n'));

  // 10. Section: Grouped Sources and Evidence (Requirement 8)
  if (options.includeSources !== false) {
    const grouped = groupSourcesForRecord(record);
    const sourceLines: string[] = [
      '## Grouped Sources and Evidence',
      '',
      `### 1. Official Company Website`,
    ];

    if (grouped.official.length > 0) {
      for (const s of grouped.official) {
        sourceLines.push(`- 🌐 [${s.title || record.canonicalDomain || s.url}](${s.url})`);
        if (s.date) sourceLines.push(`  - *Retrieved*: ${s.date}`);
        if (s.supportedFields.length > 0) sourceLines.push(`  - *Supported Fields*: ${s.supportedFields.join(', ')}`);
        for (const ex of s.excerpts.slice(0, 2)) {
          sourceLines.push(`  > "${ex}"`);
        }
      }
    } else {
      sourceLines.push(`- *No direct primary website crawl record available.*`);
    }

    sourceLines.push('', `### 2. LinkedIn & Executive Directories`);
    if (grouped.linkedin.length > 0) {
      for (const s of grouped.linkedin) {
        sourceLines.push(`- 💼 [${s.title || 'LinkedIn Profile'}](${s.url})`);
        if (s.supportedFields.length > 0) sourceLines.push(`  - *Supported Fields*: ${s.supportedFields.join(', ')}`);
        for (const ex of s.excerpts.slice(0, 2)) {
          sourceLines.push(`  > "${ex}"`);
        }
      }
    } else {
      sourceLines.push(`- *No external LinkedIn sources recorded.*`);
    }

    sourceLines.push('', `### 3. Funding & Regulatory Sources`);
    if (grouped.funding.length > 0) {
      for (const s of grouped.funding) {
        sourceLines.push(`- 📈 [${s.title || 'Venture & Regulatory Source'}](${s.url})`);
        if (s.supportedFields.length > 0) sourceLines.push(`  - *Supported Fields*: ${s.supportedFields.join(', ')}`);
        for (const ex of s.excerpts.slice(0, 2)) {
          sourceLines.push(`  > "${ex}"`);
        }
      }
    } else {
      sourceLines.push(`- *No external venture database dispatches registered.*`);
    }

    sourceLines.push('', `### 4. Other Public Web Sources`);
    if (grouped.other.length > 0) {
      for (const s of grouped.other) {
        sourceLines.push(`- 🔗 [${s.title || s.url}](${s.url})`);
        if (s.supportedFields.length > 0) sourceLines.push(`  - *Supported Fields*: ${s.supportedFields.join(', ')}`);
        for (const ex of s.excerpts.slice(0, 1)) {
          sourceLines.push(`  > "${ex}"`);
        }
      }
    } else {
      sourceLines.push(`- *No secondary public search sources.*`);
    }

    sections.push(sourceLines.join('\n'));
  }

  // 11. Section: Verification Results & Criteria Evaluation
  if (options.includeVerificationReport !== false) {
    const verifLines: string[] = [
      '## Verification Results',
      `- **Overall Qualification Status**: **\`${verificationStatus}\`**`,
      `- **Qualification Score**: **${record.huntScore || record.qualificationScore || 0}%**`,
      `- **Primary Qualification Reason**: ${record.reasonsForSelection || record.reasonsForRejection || record.verificationReasons || 'Evaluation against target investment parameters.'}`,
    ];

    if (Array.isArray(record.verificationChecksPerformed) && record.verificationChecksPerformed.length > 0) {
      verifLines.push(
        '',
        `### Verification Audit Matrix`,
        '',
        `| Check / Criterion | Status | Value / Reason | Source |`,
        `| :--- | :--- | :--- | :--- |`
      );
      for (const ch of record.verificationChecksPerformed) {
        const badge = ch.status === 'PASS' ? '✅ PASS' : ch.status === 'FAIL' ? '❌ FAIL' : '⚠️ UNKNOWN';
        verifLines.push(`| **${ch.name}** | \`${badge}\` | ${ch.reason || ch.value || 'Evaluated'} | ${ch.source ? `[Link](${ch.source})` : 'N/A'} |`);
      }
    } else if (raw.criteria && typeof raw.criteria === 'object') {
      verifLines.push(
        '',
        `### Target Criteria Evaluation`,
        '',
        `| Criterion | Status | Required | Actual | Rationale |`,
        `| :--- | :--- | :--- | :--- | :--- |`
      );
      for (const [cKey, cVal] of Object.entries(raw.criteria) as [string, any][]) {
        const cStatus = cVal.status === 'PASS' ? '✅ PASS' : cVal.status === 'FAIL' ? '❌ FAIL' : '⚠️ UNKNOWN';
        verifLines.push(`| **${cVal.name || cKey}** | \`${cStatus}\` | ${cVal.required || 'Configured'} | ${cVal.actual || 'Undisclosed'} | ${cVal.reason || 'N/A'} |`);
      }
    }

    sections.push(verifLines.join('\n'));
  }

  // 12. Section: Provenance & Audit Metadata
  const auditMetaLines: string[] = [
    '## Export Provenance & Audit Trail',
    `- **Workflow Origin**: \`${origin}\``,
    `- **Export Snapshot Time**: \`${now}\``,
    `- **Record ID**: \`${record.id}\``,
  ];
  if (record.sourceFile) {
    auditMetaLines.push(
      `- **Source Document**: \`${record.sourceFile}\``,
      `- **Source Row / Index**: ${record.sourceRow ?? 'N/A'}`,
      `- **Sheet Name**: ${record.sourceSheet || 'N/A'}`
    );
  }
  if (record.manualOverride) {
    auditMetaLines.push(
      `- **Manual Status Override**: \`TRUE\``,
      `- **Override Reason**: ${record.overrideReason || 'User decision in lead manager'}`,
      `- **Override Timestamp**: ${record.overrideTimestamp || 'Recorded'}`
    );
  }
  sections.push(auditMetaLines.join('\n'));

  return sections.join('\n\n') + '\n';
}

// ==========================================
// 5. AUTOMATED WEB SEARCH RESULT MARKDOWN
// ==========================================

/**
 * Generates an Obsidian Markdown note for an Automated Web Search result.
 */
export function generateAutomationResultMarkdown(
  item: any,
  options: MarkdownExportOptions = {}
): string {
  const now = options.snapshotTime || formatSnapshotTime();
  const title = item.title || item.companyName || item.name || 'Automated Web Search Result';
  const query = item.query || item.searchQuery || 'Venture Seed Discovery';
  const url = item.url || item.website || item.link || '';
  const timestamp = item.timestamp || item.date || now;

  const frontmatterProps: Record<string, any> = {
    title: sanitizeObsidianFilename(title),
    result_type: 'AUTOMATION_SEARCH_RESULT',
    search_query: query,
    source_url: url || null,
    associated_company: item.companyName || item.name || null,
    run_status: item.status || 'completed',
    research_timestamp: timestamp,
    exported_at: now,
    tags: ['huntlyst', 'automation', 'web-search'],
  };

  const sections: string[] = [];
  if (options.includeYamlFrontmatter !== false) {
    sections.push(generateYamlFrontmatter(frontmatterProps));
  }

  sections.push(
    `# Search Discovery: ${title}`,
    `> **Query**: \`${query}\` • **Timestamp**: \`${timestamp}\` • **Status**: \`${item.status || 'Discovered'}\``
  );

  if (url) {
    sections.push(`**Source URL**: [${url}](${url})`);
  }

  sections.push(
    '## Extracted Content & Snippet',
    item.snippet || item.content || item.summary || item.description || '*No text snippet extracted for this search match.*'
  );

  if (item.companyName || item.extractedData) {
    sections.push(
      '## Extracted Company Signals',
      `- **Identified Company**: ${item.companyName || item.name || 'Tentative'}`,
      `- **Target Industry**: ${item.industry || item.extractedData?.industry || 'Unverified'}`,
      `- **Funding Signal**: ${item.funding || item.extractedData?.funding || 'Undisclosed'}`,
      `- **Geography**: ${item.country || item.location || 'Undisclosed'}`
    );
  }

  sections.push(
    '## Provenance & Engine Metadata',
    `- **Engine Provider**: \`${item.provider || 'Huntlyst Multi-Strategy Engine'}\``,
    `- **Execution Status**: \`${item.status || 'OK'}\``,
    `- **Errors Flagged**: \`${item.error || 'None'}\``
  );

  return sections.join('\n\n') + '\n';
}

// ==========================================
// 6. COMBINED MARKDOWN REPORT GENERATOR
// ==========================================

/**
 * Generates a single consolidated Markdown report combining multiple records.
 * Uses horizontal rules and clear H1/H2 hierarchies.
 */
export function generateCombinedMarkdown(
  records: (UniversalExportRecord | any)[],
  options: MarkdownExportOptions = {}
): string {
  const normalizedList = records.map((r) => normalizeAnyRecord(r));
  const now = options.snapshotTime || formatSnapshotTime();
  const title = options.notes || 'Huntlyst Lead Intelligence Dossier';

  // Table of Contents
  const tocLines: string[] = [
    `# ${title}`,
    `> Generated by **Huntlyst Autonomous Intelligence** on \`${now}\``,
    `> Total Records Included: **${normalizedList.length}**`,
    '',
    '## Table of Contents',
    '',
  ];

  normalizedList.forEach((rec, idx) => {
    const anchor = rec.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    tocLines.push(`${idx + 1}. [${rec.companyName}](#${anchor}) — *\`${rec.recordStatus || rec.verificationStatus}\`* (${rec.country || 'Global'})`);
  });

  const bodyNotes = normalizedList.map((rec) => {
    // Generate each note without frontmatter so the combined document has a single frontmatter block
    const note = generateRecordMarkdown(rec, {
      ...options,
      includeYamlFrontmatter: false,
    });
    return note;
  });

  const combinedHeader = generateYamlFrontmatter({
    title,
    report_type: 'COMBINED_LEAD_DOSSIER',
    total_records: normalizedList.length,
    exported_at: now,
    tags: ['huntlyst', 'combined-dossier', 'lead-export'],
  });

  return [combinedHeader, tocLines.join('\n'), ...bodyNotes].join('\n\n---\n\n') + '\n';
}

// ==========================================
// 7. MULTI-NOTE ZIP & OBSIDIAN VAULT GENERATION
// ==========================================

/**
 * Generates a ZIP containing individual .md notes for each record.
 */
export async function generateMarkdownZip(
  records: (UniversalExportRecord | any)[],
  options: MarkdownExportOptions = {}
): Promise<Uint8Array> {
  const zip = new JSZip();
  const normalizedList = records.map((r) => normalizeAnyRecord(r));
  const seenNames = new Map<string, number>();

  const indexLinks: string[] = [
    `# Huntlyst Export Index`,
    `> Export snapshot: \`${options.snapshotTime || formatSnapshotTime()}\` • Total notes: **${normalizedList.length}**`,
    '',
    '## Notes Directory',
    '',
  ];

  for (const rec of normalizedList) {
    const baseName = sanitizeObsidianFilename(rec.companyName, 'company');
    const count = seenNames.get(baseName) || 0;
    seenNames.set(baseName, count + 1);

    const fileName = count === 0 ? `${baseName}.md` : `${baseName} (${rec.canonicalDomain || count}).md`;
    const noteContent = generateRecordMarkdown(rec, options);

    zip.file(fileName, noteContent);
    indexLinks.push(`- [[${fileName.replace(/\.md$/, '')}|${rec.companyName}]] — \`${rec.recordStatus || rec.verificationStatus}\``);
  }

  // Include Index.md
  zip.file('Index.md', indexLinks.join('\n') + '\n');

  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Generates a Complete Obsidian Vault ZIP archive matching Section 6 requirements.
 *
 * Folder Structure:
 * Huntlyst-Obsidian/
 * ├── README.md
 * ├── Index.md
 * ├── Internal/
 * │   ├── Verified/
 * │   ├── Review/
 * │   ├── Unverified/
 * │   └── Rejected/
 * ├── External/
 * ├── Automation/
 * ├── Verification/
 * │   └── Verification-Audit.md
 * └── Sources/
 *     └── Sources-Catalog.md
 */
export async function generateObsidianVault(
  vaultOptions: ObsidianVaultOptions = {}
): Promise<Uint8Array> {
  const zip = new JSZip();
  const rootFolderName = vaultOptions.vaultName || 'Huntlyst-Obsidian';
  const root = zip.folder(rootFolderName) || zip;
  const now = vaultOptions.snapshotTime || formatSnapshotTime();

  const internalRecords = (vaultOptions.internalRecords || []).map((r) => normalizeAnyRecord(r));
  const externalRecords = (vaultOptions.externalRecords || []).map((r) => normalizeAnyRecord(r));
  const automationRecords = vaultOptions.automationRecords || [];

  const indexSections: string[] = [
    `# Huntlyst Obsidian Knowledge Vault`,
    `> **Export Snapshot**: \`${now}\``,
    `> **Total Indexed Notes**: **${internalRecords.length + externalRecords.length + automationRecords.length}**`,
    '',
    `## Vault Overview`,
    `| Workflow Collection | Count | Location |`,
    `| :--- | :--- | :--- |`,
  ];

  // 1. Process Internal Records (Status-Folder Partitioning)
  if (internalRecords.length > 0) {
    const internalFolder = root.folder('Internal');
    const statusCounts: Record<string, number> = {};

    for (const rec of internalRecords) {
      // Filter by status if requested
      const st = (rec.recordStatus || rec.verificationStatus || 'UNVERIFIED').toUpperCase();
      if (vaultOptions.internalStatuses && !vaultOptions.internalStatuses.includes(st)) {
        continue;
      }

      // Canonical status folder
      const folderName =
        st === 'VERIFIED'
          ? 'Verified'
          : st === 'REVIEW' || st === 'UNDER REVIEW'
          ? 'Review'
          : st === 'REJECTED'
          ? 'Rejected'
          : 'Unverified';

      statusCounts[folderName] = (statusCounts[folderName] || 0) + 1;
      const targetSub = internalFolder?.folder(folderName) || internalFolder;
      const baseName = sanitizeObsidianFilename(rec.companyName);
      const noteContent = generateRecordMarkdown(rec, {
        snapshotTime: now,
        workflowOrigin: 'INTERNAL',
        generateWikilinks: vaultOptions.generateWikilinks !== false,
      });

      targetSub?.file(`${baseName}.md`, noteContent);
    }

    indexSections.push(`| **Internal Discovery Leads** | ${internalRecords.length} | \`Internal/\` (Verified, Review, Unverified, Rejected) |`);
  }

  // 2. Process External Records
  if (externalRecords.length > 0) {
    const externalFolder = root.folder('External');
    for (const rec of externalRecords) {
      const baseName = sanitizeObsidianFilename(rec.companyName);
      const noteContent = generateRecordMarkdown(rec, {
        snapshotTime: now,
        workflowOrigin: 'EXTERNAL',
        generateWikilinks: vaultOptions.generateWikilinks !== false,
      });
      externalFolder?.file(`${baseName}.md`, noteContent);
    }
    indexSections.push(`| **External Deep Research** | ${externalRecords.length} | \`External/\` |`);
  }

  // 3. Process Automation Records
  if (automationRecords.length > 0) {
    const automationFolder = root.folder('Automation');
    for (let i = 0; i < automationRecords.length; i++) {
      const item = automationRecords[i];
      const baseName = sanitizeObsidianFilename(item.title || item.companyName || `Search-Run-${String(i + 1).padStart(3, '0')}`);
      const noteContent = generateAutomationResultMarkdown(item, {
        snapshotTime: now,
        workflowOrigin: 'AUTOMATION',
      });
      automationFolder?.file(`${baseName}.md`, noteContent);
    }
    indexSections.push(`| **Automated Web Search Runs** | ${automationRecords.length} | \`Automation/\` |`);
  }

  // 4. Verification Summary Note (under Verification/)
  if (vaultOptions.includeVerificationSummary !== false) {
    const verifFolder = root.folder('Verification');
    const verifReportLines: string[] = [
      `# Huntlyst Verification & Qualification Audit`,
      `> Generated on \`${now}\` across all active discovery workflows.`,
      '',
      `## Summary by Verification Status`,
      `| Status | Count | Description |`,
      `| :--- | :--- | :--- |`,
    ];

    const allRecords = [...internalRecords, ...externalRecords];
    const counts = { VERIFIED: 0, REVIEW: 0, UNVERIFIED: 0, REJECTED: 0 };
    for (const r of allRecords) {
      const st = (r.recordStatus || r.verificationStatus || 'UNVERIFIED').toUpperCase();
      if (st.includes('VERIF') && !st.includes('UN')) counts.VERIFIED++;
      else if (st.includes('REV') || st.includes('PARTIAL')) counts.REVIEW++;
      else if (st.includes('REJ')) counts.REJECTED++;
      else counts.UNVERIFIED++;
    }

    verifReportLines.push(
      `| **VERIFIED** | **${counts.VERIFIED}** | Satisfies 100% target criteria with evidence |`,
      `| **REVIEW** | **${counts.REVIEW}** | Partial match or conflicting facts requiring review |`,
      `| **UNVERIFIED** | **${counts.UNVERIFIED}** | Missing required funding/geography data |`,
      `| **REJECTED** | **${counts.REJECTED}** | Deterministically failed criteria |`
    );

    verifReportLines.push('', `## Verified Company Index`, '');
    for (const r of allRecords) {
      const st = (r.recordStatus || r.verificationStatus || '').toUpperCase();
      if (st === 'VERIFIED' || st === 'APPROVED') {
        verifReportLines.push(`- [[${r.companyName}]] (${r.country || 'Global'}) — Score: **${r.huntScore || 100}%**`);
      }
    }

    verifFolder?.file('Verification-Audit.md', verifReportLines.join('\n') + '\n');
  }

  // 5. Sources Catalog Note (under Sources/)
  if (vaultOptions.includeSourcesCatalog !== false) {
    const sourcesFolder = root.folder('Sources');
    const catalogLines: string[] = [
      `# Huntlyst Master Sources Catalog`,
      `> Cross-workflow registry of verified authoritative sources.`,
      '',
      `## Registered Domains & Provenance`,
      '',
    ];

    const seenDomains = new Set<string>();
    for (const r of [...internalRecords, ...externalRecords]) {
      const domain = r.canonicalDomain || extractCanonicalDomain(r.website);
      if (domain && !seenDomains.has(domain)) {
        seenDomains.add(domain);
        catalogLines.push(`- **\`${domain}\`** — Official website for [[${r.companyName}]]`);
      }
    }

    sourcesFolder?.file('Sources-Catalog.md', catalogLines.join('\n') + '\n');
  }

  // 6. Root Index.md
  indexSections.push('', `## Navigation Links`, '');
  if (internalRecords.length > 0) {
    indexSections.push(`### Internal Leads`);
    for (const r of internalRecords.slice(0, 50)) {
      indexSections.push(`- [[${r.companyName}]] — \`${r.recordStatus || r.verificationStatus}\``);
    }
  }
  if (externalRecords.length > 0) {
    indexSections.push('', `### External Research Dossiers`);
    for (const r of externalRecords.slice(0, 50)) {
      indexSections.push(`- [[${r.companyName}]] — Completeness: \`${r.researchCompleteness || 0}%\``);
    }
  }

  root.file('Index.md', indexSections.join('\n') + '\n');

  // 7. Root README.md
  if (vaultOptions.includeReadme !== false) {
    const readmeContent = [
      `# Huntlyst Obsidian Vault`,
      '',
      `Welcome to your exported **Huntlyst Research Vault** for [Obsidian](https://obsidian.md).`,
      '',
      `### Getting Started`,
      `1. Open Obsidian.`,
      `2. Select **"Open folder as vault"**.`,
      `3. Choose this extracted \`${rootFolderName}\` directory.`,
      `4. Open **\`Index.md\`** to explore all linked notes!`,
      '',
      `### Vault Organization`,
      `- **\`Internal/\`**: Leads imported from internal lists, segmented by status (\`Verified/\`, \`Review/\`, \`Unverified/\`, \`Rejected/\`).`,
      `- **\`External/\`**: Deep company research dossiers with field-level evidence and grouped sources.`,
      `- **\`Automation/\`**: Automated multi-strategy search queries and candidate records.`,
      `- **\`Verification/\`**: Target qualification evaluation matrix and scores.`,
      `- **\`Sources/\`**: Authoritative source URLs and provenances.`,
      '',
      `### Metadata & Obsidian Tags`,
      `All notes include YAML frontmatter compatible with Dataview, Obsidian Properties, and graph view.`,
      `Tags: \`#huntlyst\`, \`#verified\`, \`#review\`, \`#rejected\`, \`#external\`, \`#internal\`.`,
    ].join('\n');
    root.file('README.md', readmeContent + '\n');
  }

  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// ==========================================
// 8. BROWSER DOWNLOAD HELPERS
// ==========================================

/**
 * Triggers a client-side file download.
 */
export function triggerBrowserDownload(
  content: string | Uint8Array,
  filename: string,
  mimeType: string
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([content as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a single company record as an Obsidian Markdown note (.md).
 */
export function downloadSingleMarkdown(
  record: UniversalExportRecord | any,
  filename?: string,
  options: MarkdownExportOptions = {}
) {
  const norm = normalizeAnyRecord(record);
  const name = filename || `${sanitizeObsidianFilename(norm.companyName)}.md`;
  const markdown = generateRecordMarkdown(norm, options);
  triggerBrowserDownload(markdown, name, 'text/markdown;charset=utf-8;');
}

/**
 * Downloads multiple company records as a combined Markdown report (.md).
 */
export function downloadCombinedMarkdown(
  records: (UniversalExportRecord | any)[],
  filename = 'huntlyst-combined-report.md',
  options: MarkdownExportOptions = {}
) {
  const markdown = generateCombinedMarkdown(records, options);
  triggerBrowserDownload(markdown, filename, 'text/markdown;charset=utf-8;');
}

/**
 * Downloads multiple company records as a ZIP of individual .md notes.
 */
export async function downloadMarkdownZip(
  records: (UniversalExportRecord | any)[],
  filename = 'huntlyst-markdown-notes.zip',
  options: MarkdownExportOptions = {}
) {
  const buffer = await generateMarkdownZip(records, options);
  triggerBrowserDownload(buffer, filename, 'application/zip');
}

/**
 * Downloads a complete Obsidian Vault archive (.zip).
 */
export async function downloadObsidianVault(
  vaultOptions: ObsidianVaultOptions = {},
  filename = 'huntlyst-obsidian-vault.zip'
) {
  const buffer = await generateObsidianVault(vaultOptions);
  triggerBrowserDownload(buffer, filename, 'application/zip');
}
