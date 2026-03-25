import { useState, useEffect, useCallback, useMemo } from 'react';
import type { WeekData } from '../../types';
import { MAX_SIGN_UPS } from '../../engine/validation';
import { useAppData } from '../../hooks/useAppData';
import { getCurrentFiscalWeeks } from '../../engine/fiscalCalendar';
import { stripEmployeeNumber } from '../../engine/nameUtils';

// ============================================================
// Types
// ============================================================

interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

interface CnlEntry {
  name: string;
  signUps: number;
}

type EntryMode = 'grid' | 'simple';

// ============================================================
// Component
// ============================================================

export function CnlQuickEntry() {
  const { appData, addWeekData } = useAppData();

  // Default to the last week in the current fiscal period
  const currentISOWeek = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  })();
  const fiscalWeeks = getCurrentFiscalWeeks(currentISOWeek);
  const defaultWeek = fiscalWeeks.length > 0 ? fiscalWeeks[fiscalWeeks.length - 1] : undefined;

  const [weekNumber, setWeekNumber] = useState<string>(
    defaultWeek != null ? String(defaultWeek) : '',
  );
  const [mode, setMode] = useState<EntryMode>('grid');
  const [entries, setEntries] = useState<CnlEntry[]>([]);
  const [simpleSignUps, setSimpleSignUps] = useState<string>('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Auto-dismiss success banners after 3 seconds
  useEffect(() => {
    if (feedback?.type !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // ----------------------------------------------------------
  // Pre-fill names from existing week data
  // ----------------------------------------------------------

  const parsedWeek = Number(weekNumber);
  const isWeekValid =
    weekNumber.trim() !== '' &&
    Number.isInteger(parsedWeek) &&
    parsedWeek >= 1 &&
    parsedWeek <= 52;

  // Collect unique names from the selected week's DR + OIS data
  const existingWeekData = useMemo(
    () => appData.weeks.find((w) => w.weekNumber === parsedWeek),
    [appData.weeks, parsedWeek],
  );

  useEffect(() => {
    if (!isWeekValid) {
      setEntries([]);
      return;
    }

    const nameMap = new Map<string, number>();

    // If this week already has per-person CNL data, use that
    if (existingWeekData?.cnl.byPerson && existingWeekData.cnl.byPerson.length > 0) {
      for (const p of existingWeekData.cnl.byPerson) {
        const name = stripEmployeeNumber(p.name);
        nameMap.set(name.toLowerCase(), p.signUps);
      }
    }

    // Also collect names from DR and OIS (may add new names not yet in CNL)
    if (existingWeekData) {
      for (const p of existingWeekData.digitalReceipts.byPerson) {
        const name = stripEmployeeNumber(p.name);
        if (!nameMap.has(name.toLowerCase())) {
          nameMap.set(name.toLowerCase(), 0);
        }
      }
      for (const p of existingWeekData.ois.byPerson) {
        const name = stripEmployeeNumber(p.name);
        if (!nameMap.has(name.toLowerCase())) {
          nameMap.set(name.toLowerCase(), 0);
        }
      }
    }

    // Build entries preserving original casing from the first occurrence
    const caseMap = new Map<string, string>();
    const allPeople = [
      ...(existingWeekData?.cnl.byPerson ?? []),
      ...(existingWeekData?.digitalReceipts.byPerson ?? []),
      ...(existingWeekData?.ois.byPerson ?? []),
    ];
    for (const p of allPeople) {
      const name = stripEmployeeNumber(p.name);
      if (!caseMap.has(name.toLowerCase())) {
        caseMap.set(name.toLowerCase(), name);
      }
    }

    const newEntries: CnlEntry[] = [];
    for (const [key, signUps] of nameMap) {
      newEntries.push({ name: caseMap.get(key) ?? key, signUps });
    }

    setEntries(newEntries.length > 0 ? newEntries : [{ name: '', signUps: 0 }]);
  }, [isWeekValid, parsedWeek, existingWeekData]);

  // ----------------------------------------------------------
  // Entry manipulation
  // ----------------------------------------------------------

  const updateEntry = useCallback((index: number, field: keyof CnlEntry, value: string | number) => {
    setEntries((prev) => {
      const next = [...prev];
      if (field === 'name') {
        next[index] = { ...next[index], name: value as string };
      } else {
        next[index] = { ...next[index], signUps: Math.max(0, value as number) };
      }
      return next;
    });
  }, []);

  const incrementEntry = useCallback((index: number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], signUps: next[index].signUps + 1 };
      return next;
    });
  }, []);

  const decrementEntry = useCallback((index: number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], signUps: Math.max(0, next[index].signUps - 1) };
      return next;
    });
  }, []);

  const addRow = useCallback(() => {
    setEntries((prev) => [...prev, { name: '', signUps: 0 }]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ----------------------------------------------------------
  // Computed values
  // ----------------------------------------------------------

  const gridTotal = entries.reduce((sum, e) => sum + e.signUps, 0);
  const validEntries = entries.filter((e) => e.name.trim() !== '');

  // Simple mode validation
  const parsedSimpleSignUps = Number(simpleSignUps);
  const isSimpleValid =
    simpleSignUps.trim() !== '' &&
    Number.isInteger(parsedSimpleSignUps) &&
    parsedSimpleSignUps >= 0 &&
    parsedSimpleSignUps <= MAX_SIGN_UPS;

  const canSave =
    isWeekValid &&
    (mode === 'grid' ? validEntries.length > 0 : isSimpleValid);

  // ----------------------------------------------------------
  // Save handler
  // ----------------------------------------------------------

  const handleSave = useCallback(() => {
    if (!canSave) return;

    try {
      let weekData: WeekData;

      if (mode === 'grid') {
        const byPerson = validEntries.map((e) => ({
          name: e.name.trim(),
          signUps: e.signUps,
        }));
        weekData = {
          weekNumber: parsedWeek,
          cnl: { signUps: gridTotal, byPerson },
          digitalReceipts: { byPerson: [] },
          ois: { byPerson: [] },
        };
      } else {
        weekData = {
          weekNumber: parsedWeek,
          cnl: { signUps: parsedSimpleSignUps },
          digitalReceipts: { byPerson: [] },
          ois: { byPerson: [] },
        };
      }

      addWeekData(weekData);

      setFeedback({
        type: 'success',
        message: `CNL data saved for Week ${parsedWeek}${mode === 'grid' ? ` (${validEntries.length} people, ${gridTotal} total)` : ''}`,
      });

      // Reset sign-ups but keep week and names
      if (mode === 'grid') {
        setEntries((prev) => prev.map((e) => ({ ...e, signUps: 0 })));
      } else {
        setSimpleSignUps('');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setFeedback({ type: 'error', message });
    }
  }, [canSave, mode, parsedWeek, validEntries, gridTotal, parsedSimpleSignUps, addWeekData]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">CNL Quick Entry</h2>
          <p className="mt-1 text-sm text-gray-500">
            {mode === 'grid'
              ? 'Enter each team member\'s CNL sign-ups for the week.'
              : 'Enter the store\'s total CNL sign-ups for the week.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'grid' ? 'simple' : 'grid'))}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          {mode === 'grid' ? 'Switch to store total' : 'Switch to per-person'}
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mt-4 rounded-md border p-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Week Number */}
      <div className="mt-4">
        <label
          htmlFor="cnl-week-number"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Week Number
        </label>
        <input
          id="cnl-week-number"
          type="number"
          min={1}
          max={52}
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          placeholder="e.g. 46"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Grid mode */}
      {mode === 'grid' && isWeekValid && (
        <div className="mt-4">
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                {/* Name */}
                <input
                  type="text"
                  value={entry.name}
                  onChange={(e) => updateEntry(index, 'name', e.target.value)}
                  placeholder="Name"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                {/* Stepper: − [number] + */}
                <button
                  type="button"
                  onClick={() => decrementEntry(index)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-lg font-bold text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                  aria-label={`Decrease ${entry.name || 'person'}`}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={entry.signUps}
                  onChange={(e) => updateEntry(index, 'signUps', parseInt(e.target.value) || 0)}
                  className="w-16 rounded-md border border-gray-300 px-2 py-2 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => incrementEntry(index)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-lg font-bold text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                  aria-label={`Increase ${entry.name || 'person'}`}
                >
                  +
                </button>

                {/* Remove row */}
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 hover:text-red-500"
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add person + total */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              + Add Person
            </button>
            <div className="text-sm font-semibold text-gray-700">
              Total: <span className="text-lg text-blue-600">{gridTotal}</span>
            </div>
          </div>
        </div>
      )}

      {/* Simple mode */}
      {mode === 'simple' && (
        <div className="mt-4">
          <label
            htmlFor="cnl-sign-ups"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Sign-Ups Achieved
          </label>
          <input
            id="cnl-sign-ups"
            type="number"
            min={0}
            max={MAX_SIGN_UPS}
            value={simpleSignUps}
            onChange={(e) => setSimpleSignUps(e.target.value)}
            placeholder="e.g. 30"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Save button */}
      <div className="mt-4">
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save CNL Data
        </button>
      </div>
    </div>
  );
}
