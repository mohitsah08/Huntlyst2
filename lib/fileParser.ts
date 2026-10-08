/**
 * File Parser Utility for Internal Discovery
 * 
 * Supports: CSV, JSON, TXT, XLSX, PDF, DOCX
 * 
 * STRICT COMPLIANCE RULES:
 * 1. Preserves every original uploaded field in `source_data.raw_fields` exactly.
 * 2. NEVER fabricates or guesses missing factual data.
 * 3. NEVER constructs a website URL by appending `.com` to a business name.
 * 4. Extracts all candidate attributes: name, website, address, city, state, country, phone, email, founder, category/industry.
 */

import * as XLSX from 'xlsx';
import { ResearchCandidateInput, CandidateSourceData } from '../providers/types';

export interface ParsedCandidateBatch {
  candidates: ResearchCandidateInput[];
  fileName: string;
  totalParsed: number;
  detectedFormat: string;
}

/**
 * Extracts candidate from arbitrary record fields, preserving original source data.
 */
function extractCandidateFromRecord(
  rawFields: Record<string, any>,
  fileName: string,
  isHuntlystExport: boolean
): ResearchCandidateInput | null {
  const entries = Object.entries(rawFields);
  if (entries.length === 0 || entries.every(([_, v]) => v === undefined || v === null || String(v).trim() === '')) {
    return null;
  }

  let name = '';
  let website: string | null = null;
  let raw_industry: string | null = null;
  let address: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let country: string | null = null;
  let location: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  let founder: string | null = null;
  let funding: string | null = null;
  let usPresence: string | null = null;
  let evidenceText: string | null = null;
  let huntScore: number | undefined = undefined;
  let description = '';

  for (const [rawKey, rawVal] of entries) {
    if (rawVal === undefined || rawVal === null) continue;
    const k = rawKey.toLowerCase().trim();
    const v = String(rawVal).trim();
    if (!v) continue;

    // 1. Company Name
    if (!name && (
      k === 'company' || k === 'name' || k === 'company name' || k === 'business name' || 
      k === 'salon name' || k === 'store name' || k === 'title' || k === 'business' || 
      k.includes('company') || (k.includes('name') && !k.includes('founder') && !k.includes('ceo') && !k.includes('lead'))
    )) {
      name = v;
    }
    // 2. Website (MUST be a URL or domain, never an email address!)
    else if (!website && (
      k === 'website' || k === 'url' || k === 'domain' || k === 'web' || k === 'site' || k.includes('website') || k.includes('url')
    )) {
      if (!v.includes('@') && (v.startsWith('http://') || v.startsWith('https://') || v.includes('.'))) {
        website = v;
      }
    }
    // 3. Category / Raw Industry
    else if (!raw_industry && (
      k === 'category' || k === 'categories' || k === 'industry' || k === 'sector' || 
      k === 'business type' || k === 'type' || k.includes('category') || k.includes('industry') || k.includes('sector')
    )) {
      raw_industry = v;
    }
    // 4. Address
    else if (!address && (
      k === 'address' || k === 'street' || k === 'street address' || k === 'addr' || k.includes('address')
    )) {
      address = v;
    }
    // 5. City
    else if (!city && (k === 'city' || k === 'town' || k === 'municipality')) {
      city = v;
    }
    // 6. State
    else if (!state && (k === 'state' || k === 'province' || k === 'region')) {
      state = v;
    }
    // 7. Country
    else if (!country && (k === 'country' || k === 'nation')) {
      country = v;
    }
    // 8. Location / Headquarters
    else if (!location && (k === 'location' || k === 'headquarters' || k === 'hq' || k.includes('location'))) {
      location = v;
    }
    // 9. Phone
    else if (!phone && (
      k === 'phone' || k === 'telephone' || k === 'tel' || k === 'mobile' || k.includes('phone')
    )) {
      phone = v;
    }
    // Check for placeholders like 'UPGRADE TO UNLOCK' or 'N/A'
    const isPlaceholder = v.toUpperCase().includes('UPGRADE TO UNLOCK') || v.toUpperCase() === 'N/A' || v.toUpperCase() === 'NULL' || v === '-';

    // 10. Email
    if (!email && (k === 'email' || k === 'contact email' || k === 'verified email' || k === 'ceo email' || k.includes('email'))) {
      if (!isPlaceholder && v.includes('@')) {
        email = v;
      }
    }
    // 11. Founder / CEO
    else if (!founder && (
      k === 'ceo' || k === 'ceo name' || k === 'founder' || k === 'co-founder' || k === 'owner' || 
      k === 'principal' || k === 'director' || k === 'executive' || k.includes('ceo') || k.includes('founder')
    )) {
      if (!isPlaceholder) {
        founder = v.replace(/\s+(?:and|or|with|&)\s*$/i, '').trim();
      }
    }
    // 12. Funding Amount (priority over generic funding/funding date)
    else if (
      k === 'funding amount' || k === 'funding amount (in usd)' || k === 'amount raised' || 
      k === 'total funding' || k === 'funding in usd' || k.includes('funding amount')
    ) {
      if (!isPlaceholder) {
        funding = v;
      }
    }
    // 12b. Funding / Revenue fallback (ignore if it's funding date)
    else if (!funding && !k.includes('funding date') && !k.includes('funding round') && !k.includes('funding type') && (
      k === 'funding' || k === 'revenue' || k === 'raised' || k.includes('funding') || k.includes('revenue')
    )) {
      if (!isPlaceholder) {
        funding = v;
      }
    }
    // 13. US Presence
    else if (!usPresence && (k.includes('us presence') || k.includes('us_presence'))) {
      usPresence = v;
    }
    // 14. Hunt Score
    else if (huntScore === undefined && (k.includes('score') || k.includes('hunt score'))) {
      const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) huntScore = num;
    }
    // 15. Evidence details
    else if (!evidenceText && (k.includes('evidence') || k.includes('audit') || k.includes('source details'))) {
      evidenceText = v;
    }
    // 16. Description
    else if (k.includes('desc') || k.includes('about') || k.includes('summary')) {
      description = v;
    }
  }

  // Synthesize location string if not explicitly set
  if (!location) {
    const locParts = [city, state, country].filter(Boolean);
    if (locParts.length > 0) {
      location = locParts.join(', ');
    }
  }

  // Fallback name if only website was provided
  if (!name && website) {
    const host = website.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    name = host.split('.')[0];
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  if (!name && !website && !address) {
    return null;
  }

  const source_data: CandidateSourceData = {
    name: name || 'Unknown Entity',
    website: website || null,
    raw_industry: raw_industry || null,
    address: address || null,
    city: city || null,
    state: state || null,
    country: country || (location ? location.split(',').pop()?.trim() : null),
    phone: phone || null,
    email: email || null,
    founder: founder || null,
    funding: funding || null,
    raw_fields: { ...rawFields },
  };

  const hasPreviousHuntlystEvidence = isHuntlystExport;

  return {
    name: name || undefined,
    website: website || undefined,
    url: website || undefined,
    rawText: description || undefined,
    source: `Internal File: ${fileName}`,
    source_data,
    isPreviousHuntlystLead: hasPreviousHuntlystEvidence,
    existingData: hasPreviousHuntlystEvidence ? {
      description: description || undefined,
      industry: raw_industry || undefined,
      sector: raw_industry || undefined,
      fundingOrRevenue: funding || undefined,
      location: location || undefined,
      country: country || undefined,
      usPresence: usPresence || undefined,
      founderOrCeoName: founder && founder !== 'Unverified' && founder !== 'Executive' ? founder : undefined,
      founderOrCeoEmail: email && email !== 'Unverified' && email.includes('@') ? email : undefined,
      huntScore,
      evidenceText: evidenceText || undefined,
      website: website || undefined,
    } : undefined,
  };
}

/**
 * Extracts candidate companies from an uploaded file Buffer or string
 */
export async function parseCandidateFile(
  buffer: Buffer,
  fileName: string
): Promise<ParsedCandidateBatch> {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    case 'csv':
      return parseCsv(buffer.toString('utf-8'), fileName);

    case 'json':
      return parseJson(buffer.toString('utf-8'), fileName);

    case 'txt':
      return parseTxt(buffer.toString('utf-8'), fileName);

    case 'xlsx':
    case 'xls':
      return parseXlsx(buffer, fileName);

    case 'pdf':
      return await parsePdf(buffer, fileName);

    case 'docx':
      return parseDocx(buffer, fileName);

    default:
      return parseTxt(buffer.toString('utf-8'), fileName);
  }
}

/**
 * Intelligently parses raw text string by detecting whether it contains CSV, JSON, or plain text
 */
export function parseRawTextContent(content: string, sourceName: string = 'raw-input'): ParsedCandidateBatch {
  const trimmed = content.trim();
  if (!trimmed) {
    return { candidates: [], fileName: sourceName, totalParsed: 0, detectedFormat: 'Plain Text' };
  }

  // 1. Check if JSON array or JSON object
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsedJson = parseJson(trimmed, `${sourceName}.json`);
      if (parsedJson.candidates.length > 0) {
        return parsedJson;
      }
    } catch {}
  }

  // 2. Check if CSV / Delimited
  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  const hasComma = firstLine.includes(',');
  const hasTab = firstLine.includes('\t');
  const hasSemi = firstLine.includes(';');
  const looksLikeHeaders = /company|website|url|funding|revenue|location|founder|ceo|email|name|sector|industry|score|category|address|phone/i.test(firstLine);

  if ((hasComma || hasTab || hasSemi) && (looksLikeHeaders || firstLine.includes('"'))) {
    const parsedCsv = parseCsv(trimmed, `${sourceName}.csv`);
    if (parsedCsv.candidates.length > 0) {
      return parsedCsv;
    }
  }

  // 3. Fallback to line-by-line plain text
  return parseTxt(trimmed, `${sourceName}.txt`);
}

/**
 * Parses CSV text into candidate objects with full column preservation
 */
export function parseCsv(csvText: string, fileName: string = 'upload.csv'): ParsedCandidateBatch {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { candidates: [], fileName, totalParsed: 0, detectedFormat: 'CSV' };
  }

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const rows = lines.map(line => {
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
  });

  const headerRow = rows[0];
  const headers = headerRow.map(h => h.trim());
  const lowerHeaders = headers.map(h => h.toLowerCase());

  const isHuntlystExport = lowerHeaders.some(h => 
    h.includes('hunt score') || 
    h.includes('evidence & source details')
  );

  const candidates: ResearchCandidateInput[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every(cell => !cell)) continue;

    const rowDict: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `Column_${c}`;
      rowDict[key] = row[c] || '';
    }

    const candidate = extractCandidateFromRecord(rowDict, fileName, isHuntlystExport);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return {
    candidates,
    fileName,
    totalParsed: candidates.length,
    detectedFormat: isHuntlystExport ? 'Huntlyst Exported CSV' : 'CSV',
  };
}

/**
 * Parses JSON into candidate objects
 */
export function parseJson(jsonText: string, fileName: string = 'upload.json'): ParsedCandidateBatch {
  try {
    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed) ? parsed : (parsed.companies || parsed.leads || parsed.candidates || [parsed]);
    const candidates: ResearchCandidateInput[] = [];

    for (const item of list) {
      if (typeof item === 'string') {
        const isUrl = item.startsWith('http') || item.includes('.com') || item.includes('.');
        candidates.push({
          name: isUrl ? undefined : item,
          website: isUrl ? item : undefined,
          url: isUrl ? item : undefined,
          source: `Internal File: ${fileName}`,
          source_data: {
            name: isUrl ? '' : item,
            website: isUrl ? item : null,
            raw_fields: { input: item },
          },
        });
      } else if (typeof item === 'object' && item !== null) {
        const candidate = extractCandidateFromRecord(item, fileName, false);
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }

    return {
      candidates,
      fileName,
      totalParsed: candidates.length,
      detectedFormat: 'JSON Data',
    };
  } catch (err) {
    return { candidates: [], fileName, totalParsed: 0, detectedFormat: 'JSON (Parse Error)' };
  }
}

/**
 * Parses plain text line by line
 */
export function parseTxt(text: string, fileName: string = 'upload.txt'): ParsedCandidateBatch {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidates: ResearchCandidateInput[] = [];

  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const url = urlMatch[0].replace(/[,;)]+$/, '');
      const namePart = line.replace(url, '').replace(/^[-–—:|]+|[-–—:|]+$/g, '').trim();
      candidates.push({
        name: namePart || undefined,
        url,
        website: url,
        rawText: line,
        source: `Internal File: ${fileName}`,
        source_data: {
          name: namePart || '',
          website: url,
          raw_fields: { line },
        },
      });
    } else if (line.length >= 2 && line.length < 80) {
      candidates.push({
        name: line,
        source: `Internal File: ${fileName}`,
        source_data: {
          name: line,
          website: null,
          raw_fields: { line },
        },
      });
    }
  }

  return {
    candidates,
    fileName,
    totalParsed: candidates.length,
    detectedFormat: 'Plain Text',
  };
}

/**
 * Parses XLSX spreadsheet with full column retention
 */
export function parseXlsx(buffer: Buffer, fileName: string = 'upload.xlsx'): ParsedCandidateBatch {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const candidates: ResearchCandidateInput[] = [];

    // Check if Huntlyst export
    let isHuntlystExport = false;
    if (jsonData.length > 0) {
      const keys = Object.keys(jsonData[0]).map(k => k.toLowerCase());
      isHuntlystExport = keys.some(k => k.includes('hunt score') || k.includes('evidence & source details'));
    }

    for (const row of jsonData) {
      const candidate = extractCandidateFromRecord(row, fileName, isHuntlystExport);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return {
      candidates,
      fileName,
      totalParsed: candidates.length,
      detectedFormat: isHuntlystExport ? 'Huntlyst Exported XLSX' : 'XLSX Spreadsheet',
    };
  } catch (err) {
    return { candidates: [], fileName, totalParsed: 0, detectedFormat: 'XLSX (Error)' };
  }
}

/**
 * Parses PDF documents for company mentions and URLs
 */
export async function parsePdf(buffer: Buffer, fileName: string = 'upload.pdf'): Promise<ParsedCandidateBatch> {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    const text = data.text || '';
    return parseTxt(text, fileName);
  } catch (err: any) {
    console.warn('[FileParser] PDF parsing failed:', err.message || err);
    const str = buffer.toString('binary');
    const urls = str.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s)]*/g) || [];
    const candidates = Array.from(new Set(urls)).map(u => ({
      website: u,
      url: u,
      source: `Internal File: ${fileName}`,
      source_data: {
        name: '',
        website: u,
        raw_fields: { url: u },
      },
    }));
    return {
      candidates,
      fileName,
      totalParsed: candidates.length,
      detectedFormat: 'PDF (Stream Extracted)',
    };
  }
}

/**
 * Parses DOCX document
 */
export function parseDocx(buffer: Buffer, fileName: string = 'upload.docx'): ParsedCandidateBatch {
  try {
    const str = buffer.toString('utf-8');
    const textMatches = str.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
    const plainText = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
    return parseTxt(plainText, fileName);
  } catch {
    return { candidates: [], fileName, totalParsed: 0, detectedFormat: 'DOCX (Error)' };
  }
}
