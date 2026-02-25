import Papa from 'papaparse';
import type { ParsedRow } from '../types';

/**
 * Parse a CSV file into an array of row objects keyed by column header.
 * Handles BOM stripping, whitespace trimming, and auto-detects the delimiter.
 */
export async function parseCSV(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      transformHeader: (header: string) => header.replace(/^\uFEFF/, '').trim(),
      transform: (value: string) => {
        if (typeof value === 'string') {
          return value.trim();
        }
        return value;
      },
      complete(results) {
        if (results.errors.length > 0) {
          // Filter for fatal errors only; warnings (e.g. trailing comma) are tolerable
          const fatal = results.errors.filter(
            (e) => e.type === 'Delimiter' || e.type === 'FieldMismatch',
          );
          if (fatal.length > 0) {
            reject(new Error(`CSV parse error: ${fatal[0].message} (row ${fatal[0].row})`));
            return;
          }
        }
        resolve(results.data as ParsedRow[]);
      },
      error(err: Error) {
        reject(new Error(`Failed to parse CSV: ${err.message}`));
      },
    });
  });
}
