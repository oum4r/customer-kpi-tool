import type { AppData } from '../types';
import { supabase } from './supabaseClient';

// ============================================================
// Constants
// ============================================================

const TABLE = 'kpi_store_data';

// ============================================================
// Helpers
// ============================================================

/**
 * Prepare AppData for cloud storage.
 * Strips the storeNumber from the stored JSON — it's the PK column, not part of the blob.
 */
function prepareForStorage(data: AppData): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      storeNumber: undefined, // Stored as column, not in JSON blob
    },
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Test that the Supabase connection is working and the table exists.
 * Returns true if a simple query succeeds.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .select('store_number')
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Read AppData for a specific store from Supabase.
 * Returns the parsed data, or null if no row exists for that store.
 */
export async function readStoreData(storeNumber: string): Promise<AppData | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('store_number', storeNumber)
    .single();

  if (error) {
    // PGRST116 = "no rows returned" (not found) — perfectly fine for a new store
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to read store data: ${error.message}`);
  }

  if (!data?.data) return null;

  try {
    // data.data is already a parsed JSONB object from Supabase
    return data.data as AppData;
  } catch {
    return null;
  }
}

/**
 * Write (upsert) AppData for a specific store to Supabase.
 * Creates the row if it doesn't exist, updates if it does.
 */
export async function writeStoreData(storeNumber: string, appData: AppData): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        store_number: storeNumber,
        data: prepareForStorage(appData),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_number' },
    );

  if (error) {
    throw new Error(`Failed to save store data: ${error.message}`);
  }
}
