interface WeekSelectorProps {
  weeks: number[];
  currentWeek: number;
  onWeekChange: (week: number) => void;
}

/**
 * Compact week navigator with prev/next arrows and a dropdown for
 * jumping directly to any available week. Mobile-friendly touch targets.
 */
export function WeekSelector({ weeks, currentWeek, onWeekChange }: WeekSelectorProps) {
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
    </div>
  );
}
