import type { DatasetType } from '../types';

// ============================================================
// Required field definitions per dataset type
// ============================================================

export interface FieldDefinition {
  key: string;
  label: string;
}

export const REQUIRED_FIELDS: Record<DatasetType, FieldDefinition[]> = {
  cnl: [],
  digitalReceipts: [
    { key: 'name', label: 'Team Member Name' },
    { key: 'captured', label: 'Receipts Captured' },
    { key: 'totalTransactions', label: 'Total Transactions' },
  ],
  ois: [
    { key: 'name', label: 'Team Member Name' },
    { key: 'revenue', label: 'Revenue' },
  ],
};

export const DATASET_LABELS: Record<DatasetType, string> = {
  cnl: 'CNL',
  digitalReceipts: 'Digital Receipts',
  ois: 'OIS',
};

// ============================================================
// localStorage mapping persistence
// ============================================================

function storageKey(datasetType: DatasetType): string {
  return `kpi-column-mapping-${datasetType}`;
}

export function loadSavedMapping(datasetType: DatasetType): Record<string, string> | null {
  try {
    const raw = window.localStorage.getItem(storageKey(datasetType));
    if (raw) {
      return JSON.parse(raw) as Record<string, string>;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveMappingToStorage(datasetType: DatasetType, mapping: Record<string, string>): void {
  try {
    window.localStorage.setItem(storageKey(datasetType), JSON.stringify(mapping));
  } catch {
    // ignore
  }
}

// ============================================================
// Fuzzy column matching
// ============================================================

/**
 * Attempt to auto-detect a column mapping using a simple fuzzy match.
 */
export function autoDetectColumn(fieldKey: string, columns: string[]): string | undefined {
  const normalisedKey = fieldKey.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Exact match (case-insensitive)
  const exact = columns.find(
    (col) => col.toLowerCase().replace(/[^a-z0-9]/g, '') === normalisedKey,
  );
  if (exact) return exact;

  // Partial match
  const partial = columns.find((col) => {
    const normCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normCol.includes(normalisedKey) || normalisedKey.includes(normCol);
  });
  return partial;
}

// ============================================================
// Dataset type auto-detection
// ============================================================

/**
 * Attempt to determine the dataset type from column names.
 * Checks for known PowerBI column names first, then falls back to fuzzy detection.
 * Returns null if ambiguous or unrecognisable.
 */
export function detectDatasetType(columns: string[]): DatasetType | null {
  // Check for known PowerBI Digital Receipts columns first
  const hasDigitalReceipts = columns.includes('Digital Receipts');
  const hasTotalReceipts = columns.includes('Total Receipts');
  if (hasDigitalReceipts && hasTotalReceipts) return 'digitalReceipts';

  const normCols = columns.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Digital Receipts signature: has "captured" AND "transaction" columns
  const hasCaptured = normCols.some((c) => c.includes('captured'));
  const hasTransactions = normCols.some((c) => c.includes('transaction'));
  if (hasCaptured && hasTransactions) return 'digitalReceipts';

  // OIS signature: has "revenue" or "sales" column (without captured/transactions)
  const hasRevenue = normCols.some((c) => c.includes('revenue') || c.includes('sales'));
  if (hasRevenue) return 'ois';

  return null;
}

// ============================================================
// Hardcoded PowerBI export mappings
// ============================================================

/**
 * Known column names from standard PowerBI exports.
 * These are tried FIRST so non-technical users never see a mapping screen.
 */
const HARDCODED_MAPPINGS: Partial<Record<DatasetType, Record<string, string>>> = {
  digitalReceipts: {
    name: 'Employee Name & No',
    captured: 'Digital Receipts',
    totalTransactions: 'Total Receipts',
  },
  // OIS: handled by pdfParser directly — no column mapping needed
};

// ============================================================
// Full mapping resolution (hardcoded → saved → fuzzy fallback)
// ============================================================

/**
 * Try to fully resolve column mappings for a given dataset type:
 * 1. Try hardcoded PowerBI mappings (standard exports).
 * 2. If a saved mapping exists and all columns are present, use it.
 * 3. Otherwise, fuzzy-detect each required field.
 * Returns the complete mapping if all required fields resolve, null otherwise.
 */
export function resolveMapping(
  datasetType: DatasetType,
  columns: string[],
): Record<string, string> | null {
  const fields = REQUIRED_FIELDS[datasetType];
  if (fields.length === 0) return {};

  // 1. Try hardcoded PowerBI mapping first
  const hardcoded = HARDCODED_MAPPINGS[datasetType];
  if (hardcoded) {
    const allPresent = Object.values(hardcoded).every((col) => columns.includes(col));
    if (allPresent) return hardcoded;
  }

  // 2. Try saved mapping from localStorage
  const saved = loadSavedMapping(datasetType);
  if (saved) {
    const allPresent = Object.values(saved).every((col) => columns.includes(col));
    if (allPresent) return saved;
  }

  // 3. Fall back to fuzzy detection
  const detected: Record<string, string> = {};
  for (const field of fields) {
    const match = autoDetectColumn(field.key, columns);
    if (match) {
      detected[field.key] = match;
    } else {
      return null; // Cannot resolve all fields
    }
  }

  return detected;
}
