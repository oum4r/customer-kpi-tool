import { useState, useEffect, useCallback } from 'react';
import type { WeekData } from '../../types';
import { useAppData } from '../../hooks/useAppData';
import { getCurrentFiscalWeeks } from '../../engine/fiscalCalendar';

// ============================================================
// Feedback banner
// ============================================================

interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

// ============================================================
// Component
// ============================================================

export function CnlQuickEntry() {
  const { addWeekData } = useAppData();

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
  const [signUps, setSignUps] = useState<string>('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Auto-dismiss success banners after 3 seconds
  useEffect(() => {
    if (feedback?.type !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // ----------------------------------------------------------
  // Validation
  // ----------------------------------------------------------

  const parsedWeek = Number(weekNumber);
  const parsedSignUps = Number(signUps);

  const isWeekValid =
    weekNumber.trim() !== '' &&
    Number.isInteger(parsedWeek) &&
    parsedWeek >= 1 &&
    parsedWeek <= 52;

  const isSignUpsValid =
    signUps.trim() !== '' &&
    Number.isInteger(parsedSignUps) &&
    parsedSignUps >= 0;

  const canSave = isWeekValid && isSignUpsValid;

  // ----------------------------------------------------------
  // Save handler
  // ----------------------------------------------------------

  const handleSave = useCallback(() => {
    if (!canSave) return;

    try {
      // addWeekData handles smart merging internally — it only overwrites
      // non-empty datasets, so saving CNL won't wipe existing Digi/OIS data.
      const weekData: WeekData = {
        weekNumber: parsedWeek,
        cnl: { signUps: parsedSignUps },
        digitalReceipts: { byPerson: [] },
        ois: { byPerson: [] },
      };

      addWeekData(weekData);

      setFeedback({
        type: 'success',
        message: `CNL data saved for Week ${parsedWeek}`,
      });

      // Clear sign-ups but keep the week number
      setSignUps('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setFeedback({ type: 'error', message });
    }
  }, [canSave, parsedWeek, parsedSignUps, addWeekData]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      {/* Heading */}
      <h2 className="text-lg font-semibold text-gray-900">CNL Quick Entry</h2>
      <p className="mt-1 text-sm text-gray-500">
        Enter the store's total CNL sign-ups for the week.
      </p>

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

      {/* Form fields */}
      <div className="mt-4 space-y-4">
        {/* Week Number */}
        <div>
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

        {/* Sign-Ups */}
        <div>
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
            value={signUps}
            onChange={(e) => setSignUps(e.target.value)}
            placeholder="e.g. 30"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Save button */}
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
