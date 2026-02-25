export interface TopPerformerProps {
  names: string[];
}

/**
 * Celebratory banner highlighting the top performer(s) of the week.
 * Uses amber/gold tones with a gradient background to stand out.
 * Handles ties by joining names with " & ".
 */
export function TopPerformer({ names }: TopPerformerProps) {
  if (names.length === 0) {
    return null;
  }

  const displayNames = names.join(' & ');

  return (
    <div className="rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-5 text-center shadow-md">
      {/* Trophy / star icons */}
      <div className="text-4xl" role="img" aria-label="celebration">
        🏆 ⭐ 🏆
      </div>

      {/* Heading */}
      <h3 className="mt-2 text-sm font-semibold uppercase tracking-wider text-amber-900">
        KPI Hero of the Week
      </h3>

      {/* Name(s) */}
      <p className="mt-1 text-2xl font-extrabold text-amber-950">
        {displayNames}
      </p>

      {/* Subtle tagline */}
      <p className="mt-1 text-xs font-medium text-amber-800">
        Outstanding performance this week!
      </p>
    </div>
  );
}
