import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { AppData, WeekData, Targets, Settings, PeriodConfig } from '../types';
import { MOCK_APP_DATA } from '../mock/mockData';
import { createGist, readGist, updateGist } from '../engine/gistStorage';

// ============================================================
// Context interface
// ============================================================

export interface AppDataContextValue {
  appData: AppData;
  setAppData: (data: AppData) => void;
  addWeekData: (week: WeekData) => void;
  updateTargets: (targets: Targets) => void;
  updateSettings: (settings: Settings) => void;
  updatePeriodConfig: (config: PeriodConfig) => void;
  updateColumnMappings: (mappings: Record<string, Record<string, string>>) => void;
  resetPeriod: () => void;
  exportData: () => string;
  importData: (json: string) => void;
  currentWeek: number | null;
  setCurrentWeek: (week: number) => void;
  /** True while a Gist cloud sync operation is in progress */
  isSyncing: boolean;
  /** Timestamp of last successful Gist sync */
  lastSyncedAt: Date | null;
  /** Error message from last sync attempt, or null if successful */
  syncError: string | null;
  /** Manually push current data to Gist */
  syncToGist: () => Promise<void>;
  /** Manually pull data from Gist and merge into local state */
  loadFromGist: () => Promise<void>;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

// ============================================================
// LocalStorage key
// ============================================================

const STORAGE_KEY = 'kpi-tool-app-data';

/** Debounce delay (ms) before auto-syncing to Gist after a local save */
const AUTO_SYNC_DELAY_MS = 1000;

/**
 * Load persisted AppData from localStorage, falling back to mock data.
 */
function loadFromStorage(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      // Basic structural validation
      if (parsed && parsed.period && Array.isArray(parsed.weeks) && parsed.targets && parsed.settings) {
        // Backwards compatibility: ensure managementNames exists
        if (!Array.isArray(parsed.settings.managementNames)) {
          parsed.settings.managementNames = [];
        }
        return parsed;
      }
    }
  } catch {
    // Corrupted data — fall back
  }
  return MOCK_APP_DATA;
}

/**
 * Persist AppData to localStorage.
 */
function saveToStorage(data: AppData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error persisting app data to localStorage:', error);
  }
}

// ============================================================
// Validation helpers
// ============================================================

function isValidAppData(obj: unknown): obj is AppData {
  if (typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;

  if (!data.period || typeof data.period !== 'object') return false;
  if (!Array.isArray(data.weeks)) return false;
  if (!data.targets || typeof data.targets !== 'object') return false;
  if (!data.settings || typeof data.settings !== 'object') return false;

  const period = data.period as Record<string, unknown>;
  if (typeof period.name !== 'string') return false;
  if (!Array.isArray(period.weeks)) return false;

  const targets = data.targets as Record<string, unknown>;
  if (typeof targets.cnlWeekly !== 'number') return false;
  if (typeof targets.digitalReceiptPercentage !== 'number') return false;
  if (typeof targets.oisWeekly !== 'number') return false;

  return true;
}

// ============================================================
// Provider
// ============================================================

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [appData, setAppDataState] = useState<AppData>(loadFromStorage);
  const [currentWeek, setCurrentWeek] = useState<number | null>(() => {
    const loaded = loadFromStorage();
    return loaded.weeks.length > 0
      ? loaded.weeks[loaded.weeks.length - 1].weekNumber
      : null;
  });

  // ── Gist sync state ──────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  /** Timer handle for debounced auto-sync */
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Guard to prevent the initial loadFromGist from being called more than
   * once (React StrictMode double-mount, etc.).
   */
  const hasLoadedFromGistRef = useRef(false);

  // ── Gist sync: push to cloud ─────────────────────────────

  /**
   * Push current appData to the configured GitHub Gist.
   * If no PAT is set, silently returns without error.
   * If no gistId exists yet, a new Gist is created and the
   * returned ID is persisted into settings.
   */
  const syncToGist = useCallback(async () => {
    // Use a ref-based read of the latest state so the callback
    // identity stays stable while still accessing fresh data.
    const data = appData;
    const pat = data.settings.githubPAT;

    if (!pat) return; // No token configured — nothing to do

    setIsSyncing(true);
    setSyncError(null);

    try {
      if (data.settings.gistId) {
        // Update existing Gist
        await updateGist(pat, data.settings.gistId, data);
      } else {
        // Create a brand-new Gist and save the ID locally
        const newGistId = await createGist(pat, data);
        const updatedSettings: Settings = { ...data.settings, gistId: newGistId };
        const updatedData: AppData = { ...data, settings: updatedSettings };
        setAppDataState(updatedData);
        saveToStorage(updatedData);
      }

      setLastSyncedAt(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error.';
      setSyncError(message);
      console.error('Gist sync failed:', message);
    } finally {
      setIsSyncing(false);
    }
  }, [appData]);

  // ── Gist sync: pull from cloud ────────────────────────────

  /**
   * Pull data from the configured GitHub Gist and merge it into local state.
   * Gist data wins for all fields except the local PAT and gistId, which are
   * preserved so the user never loses their credentials.
   */
  const loadFromGist = useCallback(async () => {
    const data = appData;
    const pat = data.settings.githubPAT;
    const gistId = data.settings.gistId;

    if (!pat || !gistId) return; // Not configured — nothing to do

    setIsSyncing(true);
    setSyncError(null);

    try {
      const remote = await readGist(pat, gistId);

      if (remote) {
        // Merge: remote data wins, but preserve local PAT and gistId
        const merged: AppData = {
          ...remote,
          settings: {
            ...remote.settings,
            githubPAT: pat,
            gistId: gistId,
          },
        };

        setAppDataState(merged);
        saveToStorage(merged);

        // Update currentWeek to match the merged data
        if (merged.weeks.length > 0) {
          setCurrentWeek(merged.weeks[merged.weeks.length - 1].weekNumber);
        }
      }

      setLastSyncedAt(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error.';
      setSyncError(message);
      console.error('Gist load failed:', message);
    } finally {
      setIsSyncing(false);
    }
  }, [appData]);

  // ── Persist to localStorage + schedule debounced auto-sync ─

  useEffect(() => {
    saveToStorage(appData);

    // Schedule a debounced auto-sync if a PAT is configured
    if (appData.settings.githubPAT) {
      // Clear any previously scheduled sync
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }

      autoSyncTimerRef.current = setTimeout(() => {
        // Fire-and-forget — errors are captured in syncError state
        void syncToGist();
      }, AUTO_SYNC_DELAY_MS);
    }

    // Cleanup on unmount or before re-running the effect
    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, [appData, syncToGist]);

  // ── On mount: pull from Gist if credentials exist ─────────

  useEffect(() => {
    if (hasLoadedFromGistRef.current) return;
    hasLoadedFromGistRef.current = true;

    const data = loadFromStorage();
    if (data.settings.githubPAT && data.settings.gistId) {
      void loadFromGist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Existing mutation callbacks ───────────────────────────

  const setAppData = useCallback((data: AppData) => {
    setAppDataState(data);
  }, []);

  const addWeekData = useCallback((week: WeekData) => {
    setAppDataState((prev) => {
      // Validate required fields
      if (week.weekNumber == null || typeof week.weekNumber !== 'number') {
        throw new Error('Week number is required and must be a number.');
      }

      // Check for existing week — smart merge so that uploading one dataset
      // never wipes previously-saved data for another dataset.
      const existing = prev.weeks.find((w) => w.weekNumber === week.weekNumber);
      if (existing) {
        const merged: WeekData = { ...existing };
        // Only overwrite a dataset if the incoming data is non-empty
        if (week.cnl.signUps > 0) merged.cnl = week.cnl;
        if (week.digitalReceipts.byPerson.length > 0) merged.digitalReceipts = week.digitalReceipts;
        if (week.ois.byPerson.length > 0) merged.ois = week.ois;
        return {
          ...prev,
          weeks: prev.weeks.map((w) =>
            w.weekNumber === week.weekNumber ? merged : w,
          ),
        };
      }

      return { ...prev, weeks: [...prev.weeks, week] };
    });

    setCurrentWeek(week.weekNumber);
  }, []);

  const updateTargets = useCallback((targets: Targets) => {
    setAppDataState((prev) => ({ ...prev, targets }));
  }, []);

  const updateSettings = useCallback((settings: Settings) => {
    setAppDataState((prev) => ({ ...prev, settings }));
  }, []);

  const updatePeriodConfig = useCallback((config: PeriodConfig) => {
    setAppDataState((prev) => ({ ...prev, period: config }));
  }, []);

  const updateColumnMappings = useCallback(
    (mappings: Record<string, Record<string, string>>) => {
      setAppDataState((prev) => ({ ...prev, columnMappings: mappings }));
    },
    [],
  );

  const resetPeriod = useCallback(() => {
    setAppDataState((prev) => ({ ...prev, weeks: [] }));
    setCurrentWeek(null);
  }, []);

  const exportData = useCallback((): string => {
    const json = JSON.stringify(appData, null, 2);

    // Trigger file download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kpi-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return json;
  }, [appData]);

  const importData = useCallback((json: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Invalid JSON format. Please check the file contents.');
    }

    if (!isValidAppData(parsed)) {
      throw new Error(
        'Invalid data structure. The JSON file does not match the expected KPI data format.',
      );
    }

    setAppDataState(parsed);
    if (parsed.weeks.length > 0) {
      setCurrentWeek(parsed.weeks[parsed.weeks.length - 1].weekNumber);
    } else {
      setCurrentWeek(null);
    }
  }, []);

  return (
    <AppDataContext.Provider
      value={{
        appData,
        setAppData,
        addWeekData,
        updateTargets,
        updateSettings,
        updatePeriodConfig,
        updateColumnMappings,
        resetPeriod,
        exportData,
        importData,
        currentWeek,
        setCurrentWeek,
        isSyncing,
        lastSyncedAt,
        syncError,
        syncToGist,
        loadFromGist,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}
