import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ParsedRow } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ============================================================
// Public types
// ============================================================

export interface PdfParseResult {
  rows: ParsedRow[];
  detectedWeekNumber: number | null;
}

// ============================================================
// Internal helpers
// ============================================================

/** Tolerance (in PDF points) for grouping text items into the same row. */
const Y_TOLERANCE = 3;

/**
 * Patterns that identify the start of a later section in the PDF.
 * Must be specific enough to avoid matching subtitle text that mentions
 * report names like "Multi Channel - LW QTD YTD".
 */
const SECTION_TERMINATOR_PATTERNS: RegExp[] = [
  /- YTD\b/i,                // Matches "...Staff Member - YTD 202547"
  /^OIS Employee Tracker/i,  // Matches "OIS Employee Tracker" page title
];

interface TextItem {
  text: string;
  x: number;
  y: number;
  page: number;
}

/**
 * Read a File as an ArrayBuffer.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read PDF file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Strip currency symbols, commas, and whitespace then attempt to parse as a
 * number.  Returns the original trimmed string when parsing fails.
 */
function parseNumericValue(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;

  // Remove £ signs, commas, and surrounding whitespace
  const cleaned = trimmed.replace(/[£,]/g, '').trim();

  // Also strip trailing % for the percentage column
  const withoutPercent = cleaned.replace(/%$/, '').trim();

  const num = Number(withoutPercent);
  if (!Number.isNaN(num) && withoutPercent !== '') {
    return num;
  }
  return trimmed;
}

/**
 * Group an array of TextItems into rows based on Y-position proximity.
 * Returns rows sorted top-to-bottom (descending Y in PDF coordinates).
 */
function groupIntoRows(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];

  // Sort by Y descending (top-to-bottom in visual order), then X ascending
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > Y_TOLERANCE) return yDiff;
    return a.x - b.x;
  });

  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= Y_TOLERANCE) {
      currentRow.push(item);
    } else {
      // Sort current row left-to-right before pushing
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    }
  }
  // Push final row
  currentRow.sort((a, b) => a.x - b.x);
  rows.push(currentRow);

  return rows;
}

interface HeaderPosition {
  name: string;
  x: number;
  page: number;
}

/**
 * Given a set of header positions and a text item, find the closest header.
 * Prefers headers on the same page as the item — this prevents overflow-page
 * data values (with different X-coordinates) from being mis-assigned to
 * main-page headers.
 */
function assignToColumn(
  itemX: number,
  itemPage: number,
  headerPositions: HeaderPosition[],
): string | null {
  if (headerPositions.length === 0) return null;

  // Prefer headers on the same page; fall back to all headers
  const samePageHeaders = headerPositions.filter((h) => h.page === itemPage);
  const candidates = samePageHeaders.length > 0 ? samePageHeaders : headerPositions;

  let bestMatch = candidates[0];
  let bestDist = Math.abs(itemX - bestMatch.x);

  for (let i = 1; i < candidates.length; i++) {
    const dist = Math.abs(itemX - candidates[i].x);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = candidates[i];
    }
  }

  return bestMatch.name;
}

// ============================================================
// Main parser
// ============================================================

export async function parsePdf(file: File): Promise<PdfParseResult> {
  const buffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // ----------------------------------------------------------
  // Step 1: Extract all text items across all pages
  // ----------------------------------------------------------
  const allItems: TextItem[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    for (const item of content.items) {
      // pdfjs-dist types include TextItem and TextMarkedContent;
      // we only care about items with a `str` property.
      if (!('str' in item) || typeof item.str !== 'string') continue;
      const text = item.str.trim();
      if (text === '') continue;

      const transform = item.transform as number[];
      allItems.push({
        text,
        x: transform[4],
        y: transform[5],
        page: p,
      });
    }
  }

  if (allItems.length === 0) {
    return { rows: [], detectedWeekNumber: null };
  }

  // ----------------------------------------------------------
  // Step 2: Concatenate all text to detect week number
  // ----------------------------------------------------------
  // Build a simple text stream (page-order, top-to-bottom) for regex matching.
  // We target the "Last Week" section — the completed week's data.
  const fullText = allItems.map((i) => i.text).join(' ');

  let detectedWeekNumber: number | null = null;
  const weekMatch = fullText.match(/Last\s+Week\s+(\d{4,6})/i);
  if (weekMatch) {
    const digits = weekMatch[1];
    // Last 2 digits are the week number
    detectedWeekNumber = parseInt(digits.slice(-2), 10);
  }

  // ----------------------------------------------------------
  // Step 3: Isolate "Last Week" section items
  // ----------------------------------------------------------
  // Find the first item that contains "Last Week" — this is the section
  // header for the completed week's data.
  const lastWeekIndex = allItems.findIndex((item) =>
    /Last\s*Week/i.test(item.text),
  );

  if (lastWeekIndex === -1) {
    // No "Last Week" section found at all
    return { rows: [], detectedWeekNumber };
  }

  // The section header's page and Y give us the starting boundary.
  // Collect items that come *after* the header (visually below it on the same
  // page, or on subsequent pages) until we hit a section terminator or the
  // "Total:" row.  Because PDF Y increases upward, "below" means smaller Y on
  // the same page, or a later page number.
  const headerItem = allItems[lastWeekIndex];
  const sectionItems: TextItem[] = [];
  let reachedTotal = false;

  for (const item of allItems) {
    // Skip items on pages before the header page
    if (item.page < headerItem.page) continue;

    // On the header page, skip ALL items that are at or above the header Y.
    // These are page titles (e.g. "OIS Employee Tracker") and the section
    // header itself — not table data.
    if (item.page === headerItem.page && item.y >= headerItem.y) {
      continue;
    }

    // Check for section terminators (e.g. "- YTD 202547", "OIS Employee Tracker"
    // on a later page signals we've left the "Last Week" section)
    const isSectionEnd = SECTION_TERMINATOR_PATTERNS.some((re) =>
      re.test(item.text),
    );
    if (isSectionEnd) break;

    // Check for "Total:" row — include it so we can detect and exclude it
    // later, but stop collecting after it.
    if (/^Total/i.test(item.text)) {
      reachedTotal = true;
      sectionItems.push(item);
      continue;
    }
    if (reachedTotal) {
      // We might still have items on the same Y as the Total row
      // (other columns of Total).  Collect them if they share the Y.
      const totalItems = sectionItems.filter((si) => /^Total/i.test(si.text));
      const totalY = totalItems.length > 0 ? totalItems[0].y : null;
      if (totalY !== null && Math.abs(item.y - totalY) <= Y_TOLERANCE && item.page === totalItems[0].page) {
        sectionItems.push(item);
        continue;
      }
      // Otherwise we're past the Total row.  The "% of OIS Sales" column can
      // overflow to the next page, so keep collecting until a terminator.
    }

    sectionItems.push(item);
  }

  if (sectionItems.length === 0) {
    return { rows: [], detectedWeekNumber };
  }

  // ----------------------------------------------------------
  // Step 4: Group into rows and identify header row
  // ----------------------------------------------------------
  const rows = groupIntoRows(sectionItems);

  // Find the header row — it should contain "Staff Member"
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].map((item) => item.text).join(' ');
    if (/Staff\s*Member/i.test(rowText)) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    // Could not find column headers
    return { rows: [], detectedWeekNumber };
  }

  // Build column positions from the header row.
  // The table may overflow to a second page — the overflow page repeats the
  // header for the overflowed column(s) but at completely different X-
  // coordinates.  We keep each page's headers separate so that page-aware
  // column assignment routes data items to the correct header.
  const headerRow = rows[headerRowIndex];
  const headerPage = headerRow[0]?.page;

  // Look for overflow header fragments on the next page
  const overflowHeaderItems: TextItem[] = [];
  if (headerRowIndex + 1 < rows.length) {
    const nextRow = rows[headerRowIndex + 1];
    const nextPage = nextRow[0]?.page;
    if (nextPage !== undefined && nextPage !== headerPage) {
      // Check if this looks like a header continuation rather than data
      // Header continuations typically have text that isn't purely numeric
      const hasNonNumeric = nextRow.some((item) => {
        const cleaned = item.text.replace(/[£,%\s]/g, '');
        return Number.isNaN(Number(cleaned)) && cleaned.length > 0;
      });
      if (hasNonNumeric) {
        overflowHeaderItems.push(...nextRow);
      }
    }
  }

  // Build the column definitions — main page headers
  const headerPositions: HeaderPosition[] = [];

  for (const item of headerRow) {
    headerPositions.push({ name: item.text, x: item.x, page: item.page });
  }

  // Add overflow page headers as separate entries (different page, different X).
  // Page-aware assignToColumn will route overflow-page data items to these
  // headers, preventing them from being mis-assigned to main-page columns.
  for (const overflow of overflowHeaderItems) {
    headerPositions.push({ name: overflow.text, x: overflow.x, page: overflow.page });
  }

  // ----------------------------------------------------------
  // Step 5: Build data rows
  // ----------------------------------------------------------
  // Determine which rows after the header are data rows.
  // Start from headerRowIndex + 1 (or +2 if we consumed an overflow header).
  const dataStartIndex =
    overflowHeaderItems.length > 0 ? headerRowIndex + 2 : headerRowIndex + 1;

  // Build a canonical-name map for normalising duplicate/truncated headers.
  // E.g. page 3 has "% of OIS Sa" (truncated) and page 4 has "% of OIS Sales"
  // (full) — both should map to the same canonical name.
  const canonicalNames = buildCanonicalNameMap(headerPositions);

  const parsedRows: ParsedRow[] = [];

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.map((item) => item.text).join(' ');

    // Skip the "Total:" summary row
    if (/^Total/i.test(rowText.trim())) continue;
    // Also skip if any item in the row starts with "Total"
    if (row.some((item) => /^Total/i.test(item.text))) continue;

    // Skip rows that are footer text or other non-data content
    if (/Report will display/i.test(rowText)) continue;

    // Build the parsed row by assigning items to columns (page-aware)
    const parsedRow: ParsedRow = {};
    for (const item of row) {
      const rawColName = assignToColumn(item.x, item.page, headerPositions);
      if (rawColName === null) continue;

      // Normalise to canonical column name
      const colName = canonicalNames.get(rawColName) ?? rawColName;

      // If we've already assigned a value to this column (e.g. multi-word
      // name), concatenate with a space — but skip if it's an exact duplicate
      // (happens when overflow-page values map to the same canonical column
      // as main-page values).
      if (colName in parsedRow) {
        const existing = String(parsedRow[colName]);
        if (existing !== item.text) {
          parsedRow[colName] = existing + ' ' + item.text;
        }
      } else {
        parsedRow[colName] = item.text;
      }
    }

    // Skip empty rows (rows with no meaningful data)
    const values = Object.values(parsedRow);
    if (values.length === 0) continue;
    if (values.every((v) => String(v).trim() === '')) continue;

    // Parse numeric values in each column
    for (const [key, val] of Object.entries(parsedRow)) {
      if (typeof val === 'string') {
        parsedRow[key] = parseNumericValue(val);
      }
    }

    parsedRows.push(parsedRow);
  }

  return { rows: parsedRows, detectedWeekNumber };
}

/**
 * Build a map from raw header name → canonical (longest/most complete) name.
 * Handles truncated headers on the main page vs full headers on the overflow
 * page (e.g. "% of OIS Sa" → "% of OIS Sales").
 */
function buildCanonicalNameMap(
  headers: HeaderPosition[],
): Map<string, string> {
  const map = new Map<string, string>();

  // Normalise for comparison: lowercase, collapse whitespace, strip trailing fragments
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  // Group headers whose normalised names overlap (one is a prefix of the other)
  const used = new Set<number>();
  for (let i = 0; i < headers.length; i++) {
    if (used.has(i)) continue;
    let canonical = headers[i].name;

    for (let j = i + 1; j < headers.length; j++) {
      if (used.has(j)) continue;
      const a = norm(canonical);
      const b = norm(headers[j].name);

      // Check if one is a prefix of the other (allowing for truncation)
      if (a.startsWith(b) || b.startsWith(a)) {
        used.add(j);
        // Keep the longer (more complete) name as canonical
        if (headers[j].name.length > canonical.length) {
          map.set(canonical, headers[j].name);
          canonical = headers[j].name;
        } else {
          map.set(headers[j].name, canonical);
        }
      }
    }
  }

  // Also normalise "O IS" → "OIS" in canonical names
  for (const [key, val] of map) {
    const fixed = val.replace(/O\s+IS/gi, 'OIS');
    if (fixed !== val) {
      map.set(key, fixed);
    }
  }

  return map;
}
