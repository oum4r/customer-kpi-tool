import JSZip from 'jszip';
import type { ParsedRow } from '../types';
import { validateFileSize, sanitizeCellValue, isSafeObjectKey } from '../engine/validation';

/**
 * Custom lightweight xlsx parser using JSZip + DOMParser.
 * Handles files from reporting tools that ExcelJS/SheetJS struggle with
 * (inline strings, missing sharedStrings.xml, non-standard namespace prefixes).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Strip BOM and parse XML, returning the Document.
 * Uses a namespace-agnostic approach so `x:row` and `row` both work.
 */
function parseXml(text: string): Document {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '');
  return new DOMParser().parseFromString(clean, 'application/xml');
}

/**
 * Namespace-agnostic element selector.
 * xlsx files may use `<x:row>`, `<row>`, or other prefixes depending on
 * the tool that generated them. We match by local name.
 */
function getElementsByLocalName(parent: Element | Document, localName: string): Element[] {
  return Array.from(parent.getElementsByTagName('*')).filter(
    (el) => el.localName === localName,
  );
}

function getFirstByLocalName(parent: Element | Document, localName: string): Element | null {
  return getElementsByLocalName(parent, localName)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Shared strings (standard xlsx files store string values here)
// ---------------------------------------------------------------------------

async function loadSharedStrings(zip: JSZip): Promise<string[]> {
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (!ssFile) return [];

  const xml = parseXml(await ssFile.async('text'));
  return getElementsByLocalName(xml, 't').map((t) => t.textContent ?? '');
}

// ---------------------------------------------------------------------------
// Sheet info from workbook.xml + relationships
// ---------------------------------------------------------------------------

interface SheetInfo {
  name: string;
  rId: string;
  path: string;
}

async function loadSheetInfo(zip: JSZip): Promise<SheetInfo[]> {
  const wbFile = zip.file('xl/workbook.xml');
  if (!wbFile) throw new Error('Invalid xlsx: missing xl/workbook.xml');

  const wbXml = parseXml(await wbFile.async('text'));
  const sheetEls = getElementsByLocalName(wbXml, 'sheet');

  // Build rId → file path map from relationships
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  const relMap = new Map<string, string>();

  if (relsFile) {
    const relsXml = parseXml(await relsFile.async('text'));
    for (const rel of getElementsByLocalName(relsXml, 'Relationship')) {
      const id = rel.getAttribute('Id') ?? '';
      let target = rel.getAttribute('Target') ?? '';
      // Normalise: some generators use absolute paths (/xl/...), some use relative
      target = target.replace(/^\//, '');
      if (!target.startsWith('xl/')) target = 'xl/' + target;
      relMap.set(id, target);
    }
  }

  return sheetEls.map((el) => {
    const name = el.getAttribute('name') ?? 'Sheet';
    // r:id may appear as "r:id" or with a different namespace prefix
    const rId =
      el.getAttribute('r:id') ??
      el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
      '';
    const path = relMap.get(rId) ?? `xl/worksheets/sheet1.xml`;
    return { name, rId, path };
  });
}

// ---------------------------------------------------------------------------
// Cell value extraction
// ---------------------------------------------------------------------------

function extractCellValue(
  cell: Element,
  sharedStrings: string[],
): string | number {
  const type = cell.getAttribute('t');

  // Inline string: <is><t>text</t></is>
  if (type === 'inlineStr') {
    const tEl = getFirstByLocalName(cell, 't');
    return tEl?.textContent ?? '';
  }

  // Shared string reference
  if (type === 's') {
    const vEl = getFirstByLocalName(cell, 'v');
    const idx = parseInt(vEl?.textContent ?? '', 10);
    return sharedStrings[idx] ?? '';
  }

  // Boolean
  if (type === 'b') {
    const vEl = getFirstByLocalName(cell, 'v');
    return vEl?.textContent === '1' ? 1 : 0;
  }

  // Number (default) or explicit 'n'
  const vEl = getFirstByLocalName(cell, 'v');
  if (!vEl) return '';
  const text = vEl.textContent ?? '';
  const num = Number(text);
  return isNaN(num) ? text : num;
}

// ---------------------------------------------------------------------------
// Parse a single worksheet into rows
// ---------------------------------------------------------------------------

function parseSheet(
  doc: Document,
  sharedStrings: string[],
): ParsedRow[] {
  const rowEls = getElementsByLocalName(doc, 'row');
  if (rowEls.length === 0) return [];

  // First row = headers
  const headerCells = getElementsByLocalName(rowEls[0], 'c');
  const headers: string[] = headerCells.map((c) => {
    const val = extractCellValue(c, sharedStrings);
    return String(val).trim();
  });

  // Data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < rowEls.length; i++) {
    const cells = getElementsByLocalName(rowEls[i], 'c');
    const parsed: ParsedRow = {};
    let hasData = false;

    cells.forEach((cell, colIdx) => {
      const key = headers[colIdx];
      if (!key) return;
      if (!isSafeObjectKey(key)) return;

      const raw = extractCellValue(cell, sharedStrings);
      if (typeof raw === 'string') {
        parsed[key] = sanitizeCellValue(raw.trim());
      } else {
        parsed[key] = raw;
      }
      if (raw !== '' && raw != null) hasData = true;
    });

    if (hasData) {
      rows.push(parsed);
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Public API (same interface as the old ExcelJS-based parser)
// ---------------------------------------------------------------------------

/**
 * Parse an Excel file (.xlsx) into an array of row objects.
 * If sheetName is provided, that sheet is used; otherwise the first sheet is parsed.
 */
export async function parseExcel(
  file: File,
  sheetName?: string,
): Promise<ParsedRow[]> {
  validateFileSize(file);
  const buffer = await readFileAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(buffer);

  const sharedStrings = await loadSharedStrings(zip);
  const sheets = await loadSheetInfo(zip);

  if (sheets.length === 0) {
    throw new Error('The workbook contains no sheets.');
  }

  const target = sheetName
    ? sheets.find((s) => s.name === sheetName)
    : sheets[0];

  if (!target) {
    throw new Error(
      `Sheet "${sheetName}" not found. Available sheets: ${sheets.map((s) => s.name).join(', ')}`,
    );
  }

  const sheetFile = zip.file(target.path);
  if (!sheetFile) {
    throw new Error(`Sheet file not found in archive: ${target.path}`);
  }

  const sheetXml = parseXml(await sheetFile.async('text'));
  return parseSheet(sheetXml, sharedStrings);
}

/**
 * Extract all sheet names from an Excel file.
 */
export async function getSheetNames(file: File): Promise<string[]> {
  validateFileSize(file);
  const buffer = await readFileAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(buffer);
  const sheets = await loadSheetInfo(zip);
  return sheets.map((s) => s.name);
}
