import ExcelJS from 'exceljs';
import type { ParsedRow } from '../types';
import { validateFileSize, sanitizeCellValue, isSafeObjectKey } from '../engine/validation';

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
 * Resolve a cell's display value — use the computed result for formula cells,
 * otherwise use the raw value. Returns the primitive value (string, number, etc.).
 */
function getCellValue(cell: ExcelJS.Cell): string | number | boolean | null {
  const value = cell.value;
  if (value == null) return '';

  // Formula cells: use the computed result
  if (typeof value === 'object' && 'result' in value) {
    return (value as { result: unknown }).result as string | number | boolean | null ?? '';
  }

  // Date objects → ISO string
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Rich text
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  }

  // Primitive
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return String(value);
}

/**
 * Parse an Excel file (.xlsx / .xls) into an array of row objects.
 * If sheetName is provided, that sheet is used; otherwise the first sheet is parsed.
 */
export async function parseExcel(
  file: File,
  sheetName?: string,
): Promise<ParsedRow[]> {
  validateFileSize(file);
  const buffer = await readFileAsArrayBuffer(file);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheetNames = workbook.worksheets.map((ws) => ws.name);
  const targetSheet = sheetName ?? worksheetNames[0];

  if (!targetSheet || !worksheetNames.includes(targetSheet)) {
    throw new Error(
      sheetName
        ? `Sheet "${sheetName}" not found. Available sheets: ${worksheetNames.join(', ')}`
        : 'The workbook contains no sheets.',
    );
  }

  const worksheet = workbook.getWorksheet(targetSheet)!;

  // Row 1 is the header row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = getCellValue(cell);
    headers[colNumber] = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
  });

  // Build data rows (row 2 onwards)
  const rows: ParsedRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const parsed: ParsedRow = {};
    let hasData = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      if (!isSafeObjectKey(key)) return;

      const raw = getCellValue(cell);
      if (typeof raw === 'string') {
        parsed[key] = sanitizeCellValue(raw.trim());
      } else if (typeof raw === 'boolean') {
        parsed[key] = raw ? 1 : 0;
      } else {
        parsed[key] = raw ?? '';
      }
      if (raw !== '' && raw != null) hasData = true;
    });

    if (hasData) {
      rows.push(parsed);
    }
  });

  return rows;
}

/**
 * Extract all sheet names from an Excel file.
 */
export async function getSheetNames(file: File): Promise<string[]> {
  validateFileSize(file);
  const buffer = await readFileAsArrayBuffer(file);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook.worksheets.map((ws) => ws.name);
}
