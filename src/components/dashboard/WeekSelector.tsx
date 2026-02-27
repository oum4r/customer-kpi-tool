interface WeekSelectorProps {
  weeks: number[];
  currentWeek: number;
  onWeekChange: (week: number) => void;
  onDeleteWeek?: (weekNumber: number) => void;
}

/**
 * Compact week navigator with prev/next arrows and a dropdown for
 * jumping directly to any available week. Mobile-friendly touch targets.
 * Optionally includes a delete button to remove the current week's data.
 */
export function WeekSelector({ weeks, currentWeek, onWeekChange, onDeleteWeek }: WeekSelectorProps) {
  if (weeks.length === 0) return null;

  const currentIdx = weeks.indexOf(currentWeek);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < weeks.length - 1;

  const handlePrev = () => {
    if (hasPrev) onWeekChange(weeks[currentIdx - 1]);
  };

  const handleNext = () => {
    if (hasNext) onWeekChange(weeks[currentIdx + 1]);
  };

  const handleDelete = () => {
    if (!onDeleteWeek) return;
    const confirmed = window.confirm(
      `Delete week ${currentWeek}?\n\nThis removes all uploaded data for this week.`,
    );
    if (confirmed) {
      onDeleteWeek(currentWeek);
    }
  };

  const btnBase =
    'flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
  const btnEnabled = 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  const btnDisabled = 'cursor-not-allowed bg-gray-50 text-gray-300';

  return (
    <div className="flex items-center gap-1">
      {/* Previous week */}
      <button
        type="button"
        onClick={handlePrev}
        disabled={!hasPrev}
        aria-label="Previous week"
        className={`${btnBase} ${hasPrev ? btnEnabled : btnDisabled}`}
      >
        ◀
      </button>

      {/* Week dropdown */}
      <select
        value={currentWeek}
        onChange={(e) => onWeekChange(Number(e.target.value))}
        className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {weeks.map((w) => (
          <option key={w} value={w}>
            Week {w}
          </option>
        ))}
      </select>

      {/* Next week */}
      <button
        type="button"
        onClick={handleNext}
        disabled={!hasNext}
        aria-label="Next week"
        className={`${btnBase} ${hasNext ? btnEnabled : btnDisabled}`}
      >
        ▶
      </button>

      {/* Delete current week */}
      {onDeleteWeek && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete current week"
          title="Delete this week's data"
          className={`${btnBase} ml-1 bg-gray-100 text-red-500 hover:bg-red-50 hover:text-red-700`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
