import * as XLSX from 'xlsx';
import type { ParsedRow } from '../types';

/**
 * Read a File as an ArrayBuffer.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse an Excel file (.xlsx / .xls) into an array of row objects.
 * If sheetName is provided, that sheet is used; otherwise the first sheet is parsed.
 */
export async function parseExcel(
  file: File,
  sheetName?: string,
): Promise<ParsedRow[]> {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });

  const targetSheet = sheetName ?? workbook.SheetNames[0];

  if (!targetSheet || !workbook.SheetNames.includes(targetSheet)) {
    throw new Error(
      sheetName
        ? `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`
        : 'The workbook contains no sheets.',
    );
  }

  const worksheet = workbook.Sheets[targetSheet];
  const rows = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, {
    defval: '',
    raw: true,
  });

  // Trim string values and headers
  return rows.map((row) => {
    const cleaned: ParsedRow = {};
    for (const [key, value] of Object.entries(row)) {
      const trimmedKey = key.trim();
      cleaned[trimmedKey] = typeof value === 'string' ? value.trim() : value;
    }
    return cleaned;
  });
}

/**
 * Extract all sheet names from an Excel file.
 */
export async function getSheetNames(file: File): Promise<string[]> {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}
