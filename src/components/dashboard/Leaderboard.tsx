export interface LeaderboardColumn {
  key: string;
  label: string;
  format?: (value: number | string) => string;
}

export interface LeaderboardProps {
  title: string;
  columns: LeaderboardColumn[];
  data: Record<string, string | number | boolean | null>[];
  highlightTopPerformer?: boolean;
}

/**
 * Generic ranked leaderboard table with trophy highlight for rank 1,
 * zebra striping, and horizontal scroll on mobile for many columns.
 * Management rows are greyed out, unranked, and pushed to the bottom.
 */
export function Leaderboard({ title, columns, data, highlightTopPerformer = true }: LeaderboardProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <p className="mt-2 text-sm text-gray-400">No data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              const isManagement = row.isManagement === true;
              const isTopPerformer = highlightTopPerformer && !isManagement && row.rank === 1;
              const isEvenRow = rowIndex % 2 === 0;

              // Row background: gold for top performer, grey for management, zebra stripe otherwise
              const rowBg = isManagement
                ? 'bg-gray-100'
                : isTopPerformer
                  ? 'bg-amber-50'
                  : isEvenRow
                    ? 'bg-white'
                    : 'bg-gray-50';

              return (
                <tr
                  key={rowIndex}
                  className={`${rowBg} ${isTopPerformer ? 'font-semibold' : ''} ${isManagement ? 'text-gray-400 italic' : ''}`}
                >
                  {columns.map((col) => {
                    const rawValue = row[col.key];

                    // For management rows, show "Mgmt" instead of rank
                    if (col.key === 'rank' && isManagement) {
                      return (
                        <td
                          key={col.key}
                          className="whitespace-nowrap px-3 py-2 text-xs font-normal text-gray-400"
                        >
                          Mgmt
                        </td>
                      );
                    }

                    const displayValue = col.format && rawValue !== undefined && rawValue !== null
                      ? col.format(rawValue as number | string)
                      : rawValue;

                    // Add trophy emoji for the first column of the top performer row
                    const showTrophy = isTopPerformer && col === columns[0];

                    return (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap px-3 py-2 ${isManagement ? 'text-gray-400' : 'text-gray-800'}`}
                      >
                        {showTrophy && (
                          <span className="mr-1" role="img" aria-label="trophy">
                            🏆
                          </span>
                        )}
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
