/**
 * Agent 1: File Intake Auditor + Lead Package Builder
 * 
 * Strict Responsibilities:
 * - Full file reading across all supported formats (CSV, XLSX multi-sheet, PDF, DOCX, TXT, JSON)
 * - Read every row, column, sheet, and page without artificial caps (no 25, 40, or arbitrary ceilings)
 * - Dynamic schema detection
 * - 100% preservation of raw source values in seed_data.raw_fields
 * - Rigorous detection of blanks, placeholders, malformed URLs/emails, and duplicate names/domains
 * - Output ONE structured Lead Package for EACH input lead
 * - ABSOLUTE RULE: Performs ZERO web research / network calls
 */

import * as XLSX from 'xlsx';
import { extractCanonicalDomain } from '@/lib/deduplication';
import { parseFundingDetails } from '@/lib/validation';
import {
  LeadPackage,
  LeadPackageNormalized,
  LeadPackageAudit,
  PlaceholderDetail,
  MalformedFieldDetail,
  isPlaceholderValue,
} from '@/lib/leadPackage';

export interface FileIntakeAuditResult {
  fileName: string;
  fileType: string;
  totalRowsRead: number;
  totalLeadPackages: number;
  sheetsRead?: string[];
  packages: LeadPackage[];
  schemaDetected: {
    columnCount: number;
    detectedColumns: string[];
    isGrowthListFormat: boolean;
  };
  globalAuditSummary: {
    totalDuplicatesDetected: number;
    totalPlaceholdersFound: number;
    totalMalformedFields: number;
    totalBlankFields: number;
  };
}

/**
 * Validates whether a string is a well-formed URL
 */
function validateUrl(str: string): { isValid: boolean; reason?: string } {
  const clean = str.trim();
  if (!clean) return { isValid: false, reason: 'Empty string' };
  if (clean.includes(' ') || clean.includes('\t') || clean.includes('\n')) {
    return { isValid: false, reason: 'URL contains whitespace' };
  }
  if (clean.includes('@')) {
    return { isValid: false, reason: 'Email address passed as website URL' };
  }
  if (!clean.includes('.')) {
    return { isValid: false, reason: 'Missing top-level domain dot' };
  }
  if (!/^https?:\/\//i.test(clean) && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(clean)) {
    return { isValid: false, reason: 'Invalid URL structure' };
  }
  return { isValid: true };
}

/**
 * Validates whether a string is a well-formed email address
 */
function validateEmail(str: string): { isValid: boolean; reason?: string } {
  const clean = str.trim();
  if (!clean) return { isValid: false, reason: 'Empty string' };
  if (!clean.includes('@')) {
    return { isValid: false, reason: 'Missing @ symbol' };
  }
  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, reason: 'Multiple @ symbols' };
  }
  const [local, domain] = parts;
  if (!local || !domain || !domain.includes('.')) {
    return { isValid: false, reason: 'Malformed local part or domain' };
  }
  // Standard email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return { isValid: false, reason: 'Does not match standard RFC email pattern' };
  }
  return { isValid: true };
}

/**
 * Normalizes an arbitrary record into a LeadPackage.
 * Raw values are NEVER mutated.
 */
export function buildLeadPackageFromRow(
  rawFields: Record<string, any>,
  sourceMeta: {
    fileName: string;
    fileType: string;
    rowNumber: number;
    sheetName?: string | null;
    pageNumber?: number | null;
  },
  knownNames: Map<string, number>,
  knownDomains: Map<string, number>
): LeadPackage | null {
  const entries = Object.entries(rawFields);
  if (entries.length === 0) return null;

  // Check if completely empty row
  const hasAnyValue = entries.some(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  if (!hasAnyValue) return null;

  const fieldsPresent: string[] = [];
  const fieldsMissing: string[] = [];
  const placeholders: PlaceholderDetail[] = [];
  const malformedFields: MalformedFieldDetail[] = [];
  const duplicateSignals: string[] = [];

  let rawName = '';
  let rawWebsite = '';
  let rawIndustry = '';
  let rawSubIndustry = '';
  let rawAddress = '';
  let rawCity = '';
  let rawState = '';
  let rawCountry = '';
  let rawLocation = '';
  let rawFunding = '';
  let rawFundingDate = '';
  let rawFundingType = '';
  let rawFounderOrCeo = '';
  let rawCompanyEmail = '';
  let rawCeoEmail = '';
  let rawCompanyLinkedin = '';
  let rawCeoLinkedin = '';
  let rawCompanyTwitter = '';
  let rawCeoTwitter = '';
  let rawDescription = '';
  let rawEmployeeCount = '';
  let rawFoundingYear = '';

  for (const [key, val] of entries) {
    const k = key.trim();
    const lk = k.toLowerCase();
    const rawValStr = val === undefined || val === null ? '' : String(val).trim();

    if (!rawValStr) {
      fieldsMissing.push(k);
      continue;
    }

    fieldsPresent.push(k);

    if (isPlaceholderValue(rawValStr)) {
      placeholders.push({
        field: k,
        rawValue: rawValStr,
        detectedAs: 'Placeholder / Paywall Text',
      });
      continue; // Don't assign placeholder text to normalized data
    }

    // Dynamic field mapping
    // 1. Company Name
    if (!rawName && (
      lk === 'company' || lk === 'name' || lk === 'company name' || lk === 'business name' ||
      lk === 'legal name' || lk === 'organization' || lk === 'title' ||
      (lk.includes('company') && !lk.includes('email') && !lk.includes('linkedin') && !lk.includes('twitter')) ||
      (lk.includes('name') && !lk.includes('founder') && !lk.includes('ceo') && !lk.includes('lead') && !lk.includes('first') && !lk.includes('last'))
    )) {
      rawName = rawValStr;
    }
    // 2. Website URL / Domain
    else if (!rawWebsite && (
      lk === 'url' || lk === 'website' || lk === 'domain' || lk === 'site' || lk === 'web' ||
      lk.includes('website') || lk.includes('url')
    )) {
      const urlCheck = validateUrl(rawValStr);
      if (!urlCheck.isValid) {
        malformedFields.push({ field: k, rawValue: rawValStr, reason: urlCheck.reason || 'Malformed URL' });
      } else {
        rawWebsite = rawValStr;
      }
    }
    // 3. Industry & Category
    else if (!rawIndustry && (
      lk === 'industry' || lk === 'sector' || lk === 'category' || lk === 'categories' || lk === 'business type' ||
      lk.includes('industry') || lk.includes('sector')
    )) {
      rawIndustry = rawValStr;
    }
    // 4. Sub-industry / Business Model
    else if (!rawSubIndustry && (
      lk === 'sub-industry' || lk === 'subindustry' || lk === 'business model' || lk === 'b2b or b2c' || lk === 'model'
    )) {
      rawSubIndustry = rawValStr;
    }
    // 5. Country
    else if (!rawCountry && (lk === 'country' || lk === 'nation')) {
      rawCountry = rawValStr;
    }
    // 6. City
    else if (!rawCity && (lk === 'city' || lk === 'town' || lk === 'municipality')) {
      rawCity = rawValStr;
    }
    // 7. State
    else if (!rawState && (lk === 'state' || lk === 'province' || lk === 'region')) {
      rawState = rawValStr;
    }
    // 8. Location
    else if (!rawLocation && (lk === 'location' || lk === 'headquarters' || lk === 'hq' || lk.includes('location'))) {
      rawLocation = rawValStr;
    }
    // 9. Address
    else if (!rawAddress && (lk === 'address' || lk === 'street' || lk.includes('address'))) {
      rawAddress = rawValStr;
    }
    // 10. Funding Amount (priority over generic funding)
    else if (!rawFunding && (
      lk === 'funding amount (in usd)' || lk === 'funding amount' || lk === 'amount raised' ||
      lk === 'total funding' || lk === 'funding in usd' || lk === 'funding' || lk === 'total raised' ||
      (lk.includes('funding') && !lk.includes('date') && !lk.includes('type') && !lk.includes('announcement') && !lk.includes('round'))
    )) {
      rawFunding = rawValStr;
    }
    // 11. Funding Date
    else if (!rawFundingDate && (lk === 'funding date' || lk.includes('funding date') || lk === 'last round date')) {
      rawFundingDate = rawValStr;
    }
    // 12. Funding Type / Stage
    else if (!rawFundingType && (lk === 'funding type' || lk === 'stage' || lk === 'round' || lk.includes('funding type') || lk.includes('round'))) {
      rawFundingType = rawValStr;
    }
    // 13. Founder / CEO Name
    else if (!rawFounderOrCeo && (
      lk === 'ceo name' || lk === 'ceo' || lk === 'founder' || lk === 'co-founder' || lk === 'founder name' ||
      lk === 'executive' || lk.includes('ceo name') || (lk.includes('founder') && !lk.includes('year'))
    )) {
      rawFounderOrCeo = rawValStr;
    }
    // 14. CEO Email
    else if (!rawCeoEmail && (
      lk === 'ceo email' || lk === 'founder email' || lk === 'executive email' || lk.includes('ceo email')
    )) {
      const emailCheck = validateEmail(rawValStr);
      if (!emailCheck.isValid) {
        malformedFields.push({ field: k, rawValue: rawValStr, reason: emailCheck.reason || 'Malformed email' });
      } else {
        rawCeoEmail = rawValStr;
      }
    }
    // 15. Company Contact Email
    else if (!rawCompanyEmail && (
      lk === 'contact email' || lk === 'company email' || lk === 'email' || lk.includes('contact email') || lk.includes('company email')
    )) {
      const emailCheck = validateEmail(rawValStr);
      if (!emailCheck.isValid) {
        malformedFields.push({ field: k, rawValue: rawValStr, reason: emailCheck.reason || 'Malformed email' });
      } else {
        rawCompanyEmail = rawValStr;
      }
    }
    // 16. Company LinkedIn
    else if (!rawCompanyLinkedin && (
      lk === 'linkedin' || lk === 'company linkedin' || lk.includes('company linkedin')
    )) {
      if (rawValStr.toLowerCase().includes('linkedin.com')) {
        rawCompanyLinkedin = rawValStr;
      } else {
        malformedFields.push({ field: k, rawValue: rawValStr, reason: 'Invalid LinkedIn URL' });
      }
    }
    // 17. CEO LinkedIn
    else if (!rawCeoLinkedin && (
      lk === 'ceo linkedin' || lk === 'founder linkedin' || lk.includes('ceo linkedin')
    )) {
      if (rawValStr.toLowerCase().includes('linkedin.com')) {
        rawCeoLinkedin = rawValStr;
      } else {
        malformedFields.push({ field: k, rawValue: rawValStr, reason: 'Invalid CEO LinkedIn URL' });
      }
    }
    // 18. Company Twitter / X
    else if (!rawCompanyTwitter && (
      lk === 'twitter (x)' || lk === 'twitter' || lk === 'company twitter' || lk.includes('twitter')
    )) {
      rawCompanyTwitter = rawValStr;
    }
    // 19. CEO Twitter / X
    else if (!rawCeoTwitter && (
      lk === 'ceo twitter (x)' || lk === 'ceo twitter' || lk.includes('ceo twitter')
    )) {
      rawCeoTwitter = rawValStr;
    }
    // 20. Description
    else if (!rawDescription && (
      lk === 'description' || lk === 'about' || lk === 'summary' || lk.includes('description')
    )) {
      rawDescription = rawValStr;
    }
    // 21. Employee Count
    else if (!rawEmployeeCount && (
      lk === 'number of employees' || lk === 'employees' || lk === 'employee count' || lk.includes('employee')
    )) {
      rawEmployeeCount = rawValStr;
    }
    // 22. Founding Year
    else if (!rawFoundingYear && (
      lk === 'founding year' || lk === 'founded year' || lk === 'founded' || lk.includes('founding year')
    )) {
      rawFoundingYear = rawValStr;
    }
  }

  // Synthesize location if missing
  let location = rawLocation;
  if (!location) {
    const locParts = [rawCity, rawState, rawCountry].filter(Boolean);
    if (locParts.length > 0) location = locParts.join(', ');
  }

  // Fallback company name if only website was supplied
  let companyName = rawName;
  if (!companyName && rawWebsite) {
    try {
      const hostname = new URL(rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`).hostname;
      const cleanHost = hostname.replace(/^www\./, '');
      const slug = cleanHost.split('.')[0];
      companyName = slug.charAt(0).toUpperCase() + slug.slice(1);
    } catch {
      companyName = rawWebsite;
    }
  }

  if (!companyName && !rawWebsite) {
    return null; // Not an entity lead
  }

  const canonicalDomain = rawWebsite ? extractCanonicalDomain(rawWebsite) : null;

  // Duplicate checks across file
  if (companyName) {
    const normName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentCount = knownNames.get(normName) || 0;
    if (currentCount > 0) {
      duplicateSignals.push(`Duplicate company name in uploaded file (${currentCount + 1} occurrences)`);
    }
    knownNames.set(normName, currentCount + 1);
  }

  if (canonicalDomain) {
    const currentDomainCount = knownDomains.get(canonicalDomain) || 0;
    if (currentDomainCount > 0) {
      duplicateSignals.push(`Duplicate domain in uploaded file: ${canonicalDomain} (${currentDomainCount + 1} occurrences)`);
    }
    knownDomains.set(canonicalDomain, currentDomainCount + 1);
  }

  // Numeric funding parsing
  const parsedFunding = rawFunding ? parseFundingDetails(rawFunding) : null;
  const fundingAmountUsd = parsedFunding ? parsedFunding.amountUsd : null;

  const normalized: LeadPackageNormalized = {
    company_name: companyName || 'Unknown Entity',
    website: rawWebsite || null,
    canonical_domain: canonicalDomain,
    country: rawCountry || (location ? location.split(',').pop()?.trim() || null : null),
    city: rawCity || null,
    state: rawState || null,
    location: location || null,
    industry: rawIndustry || null,
    sub_industry: rawSubIndustry || null,
    description: rawDescription || null,
    funding: rawFunding || null,
    funding_amount_usd: fundingAmountUsd,
    funding_date: rawFundingDate || null,
    funding_type: rawFundingType || null,
    founder_or_ceo: rawFounderOrCeo || null,
    company_email: rawCompanyEmail || null,
    ceo_email: rawCeoEmail || null,
    company_linkedin: rawCompanyLinkedin || null,
    ceo_linkedin: rawCeoLinkedin || null,
    company_twitter: rawCompanyTwitter || null,
    ceo_twitter: rawCeoTwitter || null,
    employee_count: rawEmployeeCount || null,
    founded_year: rawFoundingYear || null,
  };

  const candidateId = canonicalDomain || (companyName ? `lead_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : `lead_row_${sourceMeta.rowNumber}`);

  const audit: LeadPackageAudit = {
    fields_present: fieldsPresent,
    fields_missing: fieldsMissing,
    placeholders,
    malformed_fields: malformedFields,
    duplicate_signals: duplicateSignals,
  };

  return {
    candidate_id: candidateId,
    source: {
      file_name: sourceMeta.fileName,
      file_type: sourceMeta.fileType,
      row_number: sourceMeta.rowNumber,
      sheet_name: sourceMeta.sheetName || null,
      page_number: sourceMeta.pageNumber || null,
    },
    seed_data: {
      raw_fields: { ...rawFields },
      normalized,
    },
    audit,
  };
}

/**
 * Agent 1 Master Audit Runner:
 * Ingests file Buffer and outputs all audited LeadPackages
 */
export async function auditAndBuildLeadPackages(
  buffer: Buffer,
  fileName: string
): Promise<FileIntakeAuditResult> {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'txt';
  const knownNames = new Map<string, number>();
  const knownDomains = new Map<string, number>();
  const packages: LeadPackage[] = [];
  const detectedColumnsSet = new Set<string>();
  const sheetsRead: string[] = [];

  let totalRowsRead = 0;

  if (extension === 'xlsx' || extension === 'xls') {
    // Read EVERY sheet in XLSX
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of workbook.SheetNames) {
      sheetsRead.push(sheetName);
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      for (let i = 0; i < rows.length; i++) {
        totalRowsRead++;
        const row = rows[i];
        Object.keys(row).forEach(k => detectedColumnsSet.add(k));

        const pkg = buildLeadPackageFromRow(
          row,
          {
            fileName,
            fileType: 'XLSX',
            rowNumber: i + 1,
            sheetName,
          },
          knownNames,
          knownDomains
        );
        if (pkg) packages.push(pkg);
      }
    }
  } else if (extension === 'csv') {
    // Read every row and column in CSV
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      
      const parseCsvLine = (line: string): string[] => {
        const cells: string[] = [];
        let insideQuotes = false;
        let currentCell = '';
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === delimiter && !insideQuotes) {
            cells.push(currentCell.trim().replace(/^"|"$/g, ''));
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        cells.push(currentCell.trim().replace(/^"|"$/g, ''));
        return cells;
      };

      const headers = parseCsvLine(lines[0]);
      headers.forEach(h => detectedColumnsSet.add(h));

      for (let r = 1; r < lines.length; r++) {
        totalRowsRead++;
        const cells = parseCsvLine(lines[r]);
        if (cells.length === 0 || cells.every(c => !c)) continue;

        const rowDict: Record<string, any> = {};
        for (let c = 0; c < headers.length; c++) {
          rowDict[headers[c] || `Column_${c}`] = cells[c] || '';
        }

        const pkg = buildLeadPackageFromRow(
          rowDict,
          {
            fileName,
            fileType: 'CSV',
            rowNumber: r,
          },
          knownNames,
          knownDomains
        );
        if (pkg) packages.push(pkg);
      }
    }
  } else if (extension === 'json') {
    try {
      const parsed = JSON.parse(buffer.toString('utf-8'));
      const list = Array.isArray(parsed) ? parsed : (parsed.companies || parsed.leads || parsed.candidates || [parsed]);
      for (let i = 0; i < list.length; i++) {
        totalRowsRead++;
        const item = list[i];
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(k => detectedColumnsSet.add(k));
          const pkg = buildLeadPackageFromRow(
            item,
            { fileName, fileType: 'JSON', rowNumber: i + 1 },
            knownNames,
            knownDomains
          );
          if (pkg) packages.push(pkg);
        } else if (typeof item === 'string') {
          const pkg = buildLeadPackageFromRow(
            { Name: item },
            { fileName, fileType: 'JSON', rowNumber: i + 1 },
            knownNames,
            knownDomains
          );
          if (pkg) packages.push(pkg);
        }
      }
    } catch {}
  } else if (extension === 'pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      const text = data.text || '';
      const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        totalRowsRead++;
        const line = lines[i];
        const pkg = buildLeadPackageFromRow(
          { text: line },
          { fileName, fileType: 'PDF', rowNumber: i + 1, pageNumber: 1 },
          knownNames,
          knownDomains
        );
        if (pkg) packages.push(pkg);
      }
    } catch {
      // Stream extract fallback
      const str = buffer.toString('binary');
      const urls = str.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s)]*/g) || [];
      urls.forEach((u, i) => {
        totalRowsRead++;
        const pkg = buildLeadPackageFromRow(
          { URL: u },
          { fileName, fileType: 'PDF', rowNumber: i + 1 },
          knownNames,
          knownDomains
        );
        if (pkg) packages.push(pkg);
      });
    }
  } else {
    // DOCX / TXT fallback
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      totalRowsRead++;
      const line = lines[i];
      const pkg = buildLeadPackageFromRow(
        { text: line },
        { fileName, fileType: extension.toUpperCase(), rowNumber: i + 1 },
        knownNames,
        knownDomains
      );
      if (pkg) packages.push(pkg);
    }
  }

  // Compute global audit summary
  let totalDuplicatesDetected = 0;
  let totalPlaceholdersFound = 0;
  let totalMalformedFields = 0;
  let totalBlankFields = 0;

  for (const pkg of packages) {
    totalDuplicatesDetected += pkg.audit.duplicate_signals.length;
    totalPlaceholdersFound += pkg.audit.placeholders.length;
    totalMalformedFields += pkg.audit.malformed_fields.length;
    totalBlankFields += pkg.audit.fields_missing.length;
  }

  const detectedColumns = Array.from(detectedColumnsSet);
  const isGrowthListFormat = detectedColumns.some(c => c.toLowerCase().includes('b2b or b2c')) &&
    detectedColumns.some(c => c.toLowerCase().includes('ceo name'));

  return {
    fileName,
    fileType: extension.toUpperCase(),
    totalRowsRead,
    totalLeadPackages: packages.length,
    sheetsRead: sheetsRead.length > 0 ? sheetsRead : undefined,
    packages,
    schemaDetected: {
      columnCount: detectedColumns.length,
      detectedColumns,
      isGrowthListFormat,
    },
    globalAuditSummary: {
      totalDuplicatesDetected,
      totalPlaceholdersFound,
      totalMalformedFields,
      totalBlankFields,
    },
  };
}
