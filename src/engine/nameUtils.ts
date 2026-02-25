/**
 * Utility functions for cleaning up employee names from PowerBI exports.
 *
 * PowerBI exports employee names with trailing employee numbers,
 * e.g. "Manshpreet Das 7014697".  These helpers strip the number
 * and extract first names for display purposes.
 */

/**
 * Remove a trailing employee number from a name string.
 * Matches 6–8 digit sequences at the end of the string.
 *
 * "Manshpreet Das 7014697"  →  "Manshpreet Das"
 * "Jesui Silzie D Souza"    →  "Jesui Silzie D Souza" (no number, unchanged)
 */
export function stripEmployeeNumber(name: string): string {
  return name.replace(/\s+\d{6,8}$/, '').trim();
}

/**
 * Extract the first name from a full name string.
 * Strips employee numbers first, then returns the first word.
 *
 * "Manshpreet Das 7014697"  →  "Manshpreet"
 * "Jesui Silzie D Souza"    →  "Jesui"
 */
export function firstName(name: string): string {
  const clean = stripEmployeeNumber(name);
  return clean.split(/\s+/)[0] || clean;
}
