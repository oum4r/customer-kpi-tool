// ============================================================
// Shared validation constants and helpers for security hardening
// ============================================================

/** Maximum allowed file size for uploads (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Valid week number range (ISO weeks). */
export const MIN_WEEK_NUMBER = 1;
export const MAX_WEEK_NUMBER = 53;

/** Upper bounds for numeric KPI fields. */
export const MAX_SIGN_UPS = 10_000;
export const MAX_REVENUE = 1_000_000;
export const MAX_CAPTURED = 100_000;

/** Data size limits. */
export const MAX_WEEKS = 200;
export const MAX_EMPLOYEES_PER_WEEK = 500;
export const MAX_NAME_LENGTH = 200;

/** Keys that must never be used as dynamic object properties. */
const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Strip leading characters that spreadsheet applications interpret as formulas.
 * Prevents CSV/Excel formula injection when data is later exported or pasted.
 */
export function sanitizeCellValue(value: string): string {
  // Strip any leading sequence of =, +, -, @, tab, or carriage return
  return value.replace(/^[=+\-@\t\r]+/, '');
}

/**
 * Returns false for object keys that could cause prototype pollution.
 */
export function isSafeObjectKey(key: string): boolean {
  return !DANGEROUS_PROTO_KEYS.has(key);
}

/**
 * Throws if the file exceeds the maximum allowed size.
 */
export function validateFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File is too large (${sizeMB} MB). Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
    );
  }
}

/**
 * Returns the week number if it's in the valid range (1-53), or null otherwise.
 */
export function clampWeekNumber(n: number): number | null {
  if (!Number.isInteger(n) || n < MIN_WEEK_NUMBER || n > MAX_WEEK_NUMBER) {
    return null;
  }
  return n;
}
