/**
 * Phase 1: Internal File Parser & In-Browser Preparation Pipeline
 * 
 * Pipeline:
 * Upload File → Parse File → Inspect Columns → Map Fields → Normalize Values → Classify Availability → Preview Companies → Show Summary
 * 
 * Supported Input Formats:
 * 1. CSV (.csv)
 * 2. Excel (.xlsx)
 * 3. Legacy Excel (.xls)
 * 4. Markdown (.md)
 * 
 * Rules:
 * - Local-only processing in browser
 * - Zero network / external API calls
 * - In-memory state only
 * - Preserves 100% of raw fields & unmapped columns
 * - Never hallucinates or fabricates missing information
 * - Disallows PDF, OCR, doc AI in Phase 1 with clear user-facing errors
 */

import * as XLSX from 'xlsx';
import {
  Phase1ImportResult,
  Phase1CompanyRecord,
  Phase1ParseError,
  CanonicalFieldKey,
  Phase1GlobalSummary,
} from './phase1Types';
import { mapColumnHeaders, normalizeCompanyRow } from './phase1Normalizer';

/**
 * Splits raw CSV text into rows and cells, respecting RFC 4180 quotes & multiline cells
 */
function parseCsvRows(text: string): { headers: string[]; rows: string[][]; errors: Phase1ParseError[]; emptyRowsCount: number } {
  const errors: Phase1ParseError[] = [];
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentLine += '""';
        i++; // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
        currentLine += char;
      }
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip CRLF
      }
      if (currentLine.trim().length > 0) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], errors, emptyRowsCount: 0 };
  }

  // Detect delimiter from first non-empty line
  const sampleHeader = lines[0];
  let delimiter = ',';
  const commaCount = (sampleHeader.match(/,/g) || []).length;
  const tabCount = (sampleHeader.match(/\t/g) || []).length;
  const semiCount = (sampleHeader.match(/;/g) || []).length;
  const pipeCount = (sampleHeader.match(/\|/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (pipeCount > commaCount && pipeCount > tabCount) delimiter = '|';

  const tokenizeLine = (line: string): string[] => {
    const tokens: string[] = [];
    let cur = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const nc = line[i + 1];

      if (c === '"') {
        if (inQuote && nc === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === delimiter && !inQuote) {
        tokens.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    tokens.push(cur.trim().replace(/^"|"$/g, ''));
    return tokens;
  };

  const rawHeaders = tokenizeLine(lines[0]);
  const headers = rawHeaders.map((h, idx) => h || `Column_${idx + 1}`);

  let emptyRowsCount = 0;
  const rows: string[][] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = tokenizeLine(lines[r]);
    // Skip empty row
    if (cells.length === 0 || cells.every(c => !c)) {
      emptyRowsCount++;
      continue;
    }

    if (cells.length !== headers.length) {
      errors.push({
        rowNumber: r + 1,
        message: `Row column count mismatch: expected ${headers.length} columns, found ${cells.length}`,
        severity: 'warning',
        rawSnippet: lines[r].slice(0, 100),
      });
    }

    rows.push(cells);
  }

  return { headers, rows, errors, emptyRowsCount };
}

/**
 * Parses Markdown (.md) table or structured key-value list
 */
function parseMarkdownContent(text: string): { headers: string[]; rows: string[][]; errors: Phase1ParseError[]; emptyRowsCount: number } {
  const errors: Phase1ParseError[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [], errors, emptyRowsCount: 0 };
  }

  // Pass 1: Check for Markdown pipe table (| Col 1 | Col 2 |)
  const tableLines = lines.filter(l => l.startsWith('|') && l.endsWith('|'));
  if (tableLines.length >= 2) {
    const splitPipeRow = (line: string): string[] => {
      // Split on pipe not escaped by backslash
      const inner = line.slice(1, -1);
      return inner
        .split(/(?<!\\)\|/)
        .map(cell => cell.replace(/\\\|/g, '|').trim());
    };

    const headerLine = tableLines[0];
    const headers = splitPipeRow(headerLine);

    // Skip separator line (e.g. | --- | :---: |)
    const dataLines = tableLines.slice(1).filter(l => !/^[|\s-:]+$/.test(l));
    const rows: string[][] = [];
    let emptyRowsCount = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const cells = splitPipeRow(dataLines[i]);
      if (cells.length === 0 || cells.every(c => !c)) {
        emptyRowsCount++;
        continue;
      }
      rows.push(cells);
    }

    return { headers, rows, errors, emptyRowsCount };
  }

  // Pass 2: Fallback for structured Markdown list/headings
  // e.g.:
  // ## Acme AI
  // - Website: https://acme.ai
  // - Industry: AI/ML
  const sections: { name: string; props: Record<string, string> }[] = [];
  let currentSection: { name: string; props: Record<string, string> } | null = null;
  const discoveredKeys = new Set<string>();

  for (const line of lines) {
    if (line.startsWith('#')) {
      if (currentSection) sections.push(currentSection);
      const name = line.replace(/^#+\s*/, '').trim();
      currentSection = { name, props: { 'Company Name': name } };
      discoveredKeys.add('Company Name');
    } else if (currentSection && (line.startsWith('-') || line.startsWith('*'))) {
      const bullet = line.replace(/^[-*]\s*/, '').trim();
      const colonIdx = bullet.indexOf(':');
      if (colonIdx > 0) {
        const key = bullet.slice(0, colonIdx).trim();
        const val = bullet.slice(colonIdx + 1).trim();
        currentSection.props[key] = val;
        discoveredKeys.add(key);
      }
    }
  }

  if (currentSection) sections.push(currentSection);

  if (sections.length > 0) {
    const headers = Array.from(discoveredKeys);
    const rows = sections.map(s => {
      return headers.map(h => s.props[h] || '');
    });
    return { headers, rows, errors, emptyRowsCount: 0 };
  }

  return { headers: [], rows: [], errors, emptyRowsCount: 0 };
}

/**
 * Parses XLSX / XLS workbook
 */
function parseExcelContent(
  data: ArrayBuffer | Uint8Array,
  fileName: string
): { headers: string[]; rows: Record<string, any>[]; errors: Phase1ParseError[] } {
  const errors: Phase1ParseError[] = [];

  try {
    const workbook = XLSX.read(data, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      errors.push({ message: 'Excel workbook contains no sheets', severity: 'error' });
      return { headers: [], rows: [], errors };
    }

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
      errors.push({ message: `Sheet "${firstSheetName}" is empty`, severity: 'error' });
      return { headers: [], rows: [], errors };
    }

    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (rawRows.length === 0) {
      return { headers: [], rows: [], errors };
    }

    const headers = Array.from(
      new Set(rawRows.flatMap(row => Object.keys(row)))
    );

    return { headers, rows: rawRows, errors };
  } catch (err: any) {
    errors.push({
      message: `Failed to parse Excel workbook: ${err.message || 'Corrupted file structure'}`,
      severity: 'error',
    });
    return { headers: [], rows: [], errors };
  }
}

/**
 * Computes global field availability statistics
 */
function computeGlobalSummary(companies: Phase1CompanyRecord[]): Phase1GlobalSummary {
  let totalAvailableFields = 0;
  let totalMissingFields = 0;
  let totalInvalidFields = 0;
  let totalAmbiguousFields = 0;

  const fieldStats: Record<CanonicalFieldKey, { available: number; missing: number; invalid: number; ambiguous: number }> = {
    companyName: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    website: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    canonicalDomain: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    industry: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    geography: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    foundingYear: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    companyAge: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    companyStage: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    totalFundingAmount: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    latestFundingRoundAmount: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
    fundingStage: { available: 0, missing: 0, invalid: 0, ambiguous: 0 },
  };

  for (const comp of companies) {
    for (const [key, detail] of Object.entries(comp.canonicalFields) as [CanonicalFieldKey, any][]) {
      if (!fieldStats[key]) continue;
      const status = detail.status;
      if (status === 'AVAILABLE') {
        fieldStats[key].available++;
        totalAvailableFields++;
      } else if (status === 'MISSING') {
        fieldStats[key].missing++;
        totalMissingFields++;
      } else if (status === 'INVALID') {
        fieldStats[key].invalid++;
        totalInvalidFields++;
      } else if (status === 'AMBIGUOUS') {
        fieldStats[key].ambiguous++;
        totalAmbiguousFields++;
      }
    }
  }

  return {
    totalCompanies: companies.length,
    totalAvailableFields,
    totalMissingFields,
    totalInvalidFields,
    totalAmbiguousFields,
    fieldAvailabilityPercentages: fieldStats,
  };
}

/**
 * Master Phase 1 In-Browser Local Pipeline:
 * Upload File → Parse File → Inspect Columns → Map Fields → Normalize Values → Classify Availability → Preview Companies → Show Summary
 */
export async function processPhase1File(
  input: File | Blob | ArrayBuffer | Uint8Array | string,
  fileName: string
): Promise<Phase1ImportResult> {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. Validate File Format according to Phase 1 Scope
  let detectedType: Phase1ImportResult['fileType'] = 'UNSUPPORTED';
  if (extension === 'csv') detectedType = 'CSV';
  else if (extension === 'xlsx') detectedType = 'XLSX';
  else if (extension === 'xls') detectedType = 'XLS';
  else if (extension === 'md' || extension === 'markdown') detectedType = 'MARKDOWN';

  if (detectedType === 'UNSUPPORTED') {
    const isDocOrPdf = ['pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg'].includes(extension);
    const message = isDocOrPdf
      ? `Unsupported format ".${extension}". Phase 1 supports CSV (.csv), Excel (.xlsx, .xls), and Markdown (.md). Document AI, OCR, and PDF parsing are out of scope for Phase 1.`
      : `Unsupported file format ".${extension}". Please upload a .csv, .xlsx, .xls, or .md file.`;

    return {
      fileName,
      fileType: 'UNSUPPORTED',
      fileSizeBytes: 0,
      totalRowsRead: 0,
      emptyRowsSkipped: 0,
      totalCompanies: 0,
      detectedColumns: [],
      columnMappings: [],
      unmappedColumns: [],
      errors: [{ message, severity: 'error' }],
      companies: [],
      globalSummary: {
        totalCompanies: 0,
        totalAvailableFields: 0,
        totalMissingFields: 0,
        totalInvalidFields: 0,
        totalAmbiguousFields: 0,
        fieldAvailabilityPercentages: {} as any,
      },
    };
  }

  // 2. Read File Content into Memory
  let fileSizeBytes = 0;
  let textContent = '';
  let binaryBuffer: ArrayBuffer | Uint8Array | null = null;

  if (typeof input === 'string') {
    textContent = input;
    fileSizeBytes = new Blob([input]).size;
  } else if (input instanceof ArrayBuffer) {
    binaryBuffer = input;
    fileSizeBytes = input.byteLength;
    if (detectedType === 'CSV' || detectedType === 'MARKDOWN') {
      textContent = new TextDecoder('utf-8').decode(input);
    }
  } else if (input instanceof Uint8Array) {
    binaryBuffer = input;
    fileSizeBytes = input.byteLength;
    if (detectedType === 'CSV' || detectedType === 'MARKDOWN') {
      textContent = new TextDecoder('utf-8').decode(input);
    }
  } else if ((typeof Blob !== 'undefined' && input instanceof Blob) || (input && typeof (input as any).arrayBuffer === 'function')) {
    const blobLike = input as Blob;
    fileSizeBytes = blobLike.size || 0;
    if (detectedType === 'CSV' || detectedType === 'MARKDOWN') {
      textContent = typeof blobLike.text === 'function' ? await blobLike.text() : new TextDecoder('utf-8').decode(await blobLike.arrayBuffer());
    } else {
      binaryBuffer = await blobLike.arrayBuffer();
    }
  }

  // Empty File Check
  if (fileSizeBytes === 0 || (textContent && !textContent.trim())) {
    return {
      fileName,
      fileType: detectedType,
      fileSizeBytes,
      totalRowsRead: 0,
      emptyRowsSkipped: 0,
      totalCompanies: 0,
      detectedColumns: [],
      columnMappings: [],
      unmappedColumns: [],
      errors: [{ message: 'Uploaded file is empty (0 bytes). Please upload a valid file containing company records.', severity: 'error' }],
      companies: [],
      globalSummary: {
        totalCompanies: 0,
        totalAvailableFields: 0,
        totalMissingFields: 0,
        totalInvalidFields: 0,
        totalAmbiguousFields: 0,
        fieldAvailabilityPercentages: {} as any,
      },
    };
  }

  // 3. Parse File Rows
  let detectedHeaders: string[] = [];
  let rowRecords: Record<string, any>[] = [];
  const parseErrors: Phase1ParseError[] = [];
  let totalRowsRead = 0;
  let emptyRowsSkipped = 0;

  if (detectedType === 'CSV') {
    const csvResult = parseCsvRows(textContent);
    parseErrors.push(...csvResult.errors);
    detectedHeaders = csvResult.headers;
    emptyRowsSkipped += csvResult.emptyRowsCount;
    totalRowsRead += csvResult.emptyRowsCount;

    for (let r = 0; r < csvResult.rows.length; r++) {
      totalRowsRead++;
      const cells = csvResult.rows[r];
      const rowDict: Record<string, any> = {};
      for (let c = 0; c < detectedHeaders.length; c++) {
        rowDict[detectedHeaders[c]] = cells[c] || '';
      }
      rowRecords.push(rowDict);
    }
  } else if (detectedType === 'MARKDOWN') {
    const mdResult = parseMarkdownContent(textContent);
    parseErrors.push(...mdResult.errors);
    detectedHeaders = mdResult.headers;
    emptyRowsSkipped += mdResult.emptyRowsCount;
    totalRowsRead += mdResult.emptyRowsCount;

    for (let r = 0; r < mdResult.rows.length; r++) {
      totalRowsRead++;
      const cells = mdResult.rows[r];
      const rowDict: Record<string, any> = {};
      for (let c = 0; c < detectedHeaders.length; c++) {
        rowDict[detectedHeaders[c]] = cells[c] || '';
      }
      rowRecords.push(rowDict);
    }
  } else if (detectedType === 'XLSX' || detectedType === 'XLS') {
    if (!binaryBuffer) {
      parseErrors.push({ message: 'Unable to read binary data from Excel workbook', severity: 'error' });
    } else {
      const excelResult = parseExcelContent(binaryBuffer, fileName);
      parseErrors.push(...excelResult.errors);
      detectedHeaders = excelResult.headers;
      rowRecords = excelResult.rows;
      totalRowsRead = rowRecords.length;
    }
  }

  if (detectedHeaders.length === 0) {
    parseErrors.push({
      message: 'No headers or recognizable columns could be detected in this file.',
      severity: 'error',
    });
  }

  // 4. Inspect Columns & Map Fields
  const { mappings, unmappedColumns } = mapColumnHeaders(detectedHeaders);

  // 5. Normalize Values & Classify Availability for Each Company
  const companies: Phase1CompanyRecord[] = [];
  for (let idx = 0; idx < rowRecords.length; idx++) {
    const row = rowRecords[idx];
    const company = normalizeCompanyRow(row, idx + 1, mappings);
    if (company) {
      companies.push(company);
    } else {
      emptyRowsSkipped++;
    }
  }

  // 6. Compute Global Summary
  const globalSummary = computeGlobalSummary(companies);

  return {
    fileName,
    fileType: detectedType,
    fileSizeBytes,
    totalRowsRead,
    emptyRowsSkipped,
    totalCompanies: companies.length,
    detectedColumns: detectedHeaders,
    columnMappings: mappings,
    unmappedColumns,
    errors: parseErrors,
    companies,
    globalSummary,
  };
}
