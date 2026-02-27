import { useMemo } from 'react';
import { useAppData } from '../../hooks/useAppData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

// ============================================================
// Types
// ============================================================

interface EmployeeHistoryModalProps {
  employeeName: string;
  datasetType: 'digitalReceipts' | 'ois';
  onClose: () => void;
}

interface WeekMetric {
  weekNumber: number;
  value: number;
  label: string;
}

// ============================================================
// Component
// ============================================================

/**
 * Modal showing an individual employee's performance metrics across
 * all uploaded weeks, with a table and a trend mini-chart.
 */
export function EmployeeHistoryModal({ employeeName, datasetType, onClose }: EmployeeHistoryModalProps) {
  const { appData } = useAppData();

  const { metrics, unit, colour, target } = useMemo(() => {
    const sorted = [...appData.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
    const results: WeekMetric[] = [];

    if (datasetType === 'digitalReceipts') {
      for (const week of sorted) {
        const person = week.digitalReceipts.byPerson.find(
          (p) => p.name === employeeName,
        );
        if (person) {
          const pct = person.totalTransactions > 0
            ? Math.round((person.captured / person.totalTransactions) * 100)
            : 0;
          results.push({
            weekNumber: week.weekNumber,
            value: pct,
            label: `${pct}%`,
          });
        }
      }
      return {
        metrics: results,
        unit: '%',
        colour: '#8b5cf6',
        target: appData.targets.digitalReceiptPercentage,
      };
    } else {
      for (const week of sorted) {
        const person = week.ois.byPerson.find(
          (p) => p.name === employeeName,
        );
        if (person) {
          results.push({
            weekNumber: week.weekNumber,
            value: person.revenue,
            label: `£${person.revenue.toLocaleString()}`,
          });
        }
      }
      return {
        metrics: results,
        unit: '£',
        colour: '#10b981',
        target: appData.targets.oisWeekly,
      };
    }
  }, [appData.weeks, appData.targets, employeeName, datasetType]);

  // Calculate trend arrow between first and last weeks
  const trendInfo = useMemo(() => {
    if (metrics.length < 2) return null;
    const first = metrics[0].value;
    const last = metrics[metrics.length - 1].value;
    const delta = last - first;
    const direction = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    const deltaLabel = datasetType === 'ois'
      ? `${delta > 0 ? '+' : ''}£${delta.toLocaleString()}`
      : `${delta > 0 ? '+' : ''}${delta}%`;
    return { direction, deltaLabel, isPositive: delta > 0 };
  }, [metrics, datasetType]);

  const chartData = useMemo(
    () => metrics.map((m) => ({ name: `W${m.weekNumber}`, value: m.value })),
    [metrics],
  );

  const title = datasetType === 'digitalReceipts'
    ? 'Digital Receipts History'
    : 'OIS Revenue History';

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{employeeName}</h2>
            <p className="text-sm text-gray-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {metrics.length === 0 ? (
            <p className="text-sm text-gray-500">
              No data found for {employeeName} in any uploaded week.
            </p>
          ) : (
            <>
              {/* Trend summary */}
              {trendInfo && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Overall trend:</span>
                  <span
                    className={`font-semibold ${
                      trendInfo.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {trendInfo.direction} {trendInfo.deltaLabel}
                  </span>
                  <span className="text-gray-400">
                    (W{metrics[0].weekNumber} → W{metrics[metrics.length - 1].weekNumber})
                  </span>
                </div>
              )}

              {/* Mini chart */}
              {metrics.length >= 2 && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(v: number) =>
                          unit === '£' ? `£${v}` : `${v}%`
                        }
                      />
                      <Tooltip
                        formatter={(v) => {
                          const num = Number(v);
                          return unit === '£' ? [`£${num.toLocaleString()}`, 'Revenue'] : [`${num}%`, 'Capture Rate'];
                        }}
                      />
                      <ReferenceLine
                        y={target}
                        stroke="#9ca3af"
                        strokeDasharray="4 4"
                        label={{ value: 'Target', position: 'right', fontSize: 11, fill: '#9ca3af' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={colour}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: colour }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 font-semibold text-gray-500">Week</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 text-right">
                        {datasetType === 'digitalReceipts' ? 'Capture %' : 'Revenue'}
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-500 text-right">vs Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m, idx) => {
                      const diff = m.value - target;
                      const diffLabel = datasetType === 'ois'
                        ? `${diff >= 0 ? '+' : ''}£${diff.toLocaleString()}`
                        : `${diff >= 0 ? '+' : ''}${diff}%`;
                      const diffColour = diff >= 0 ? 'text-green-600' : 'text-red-600';

                      // Week-over-week change
                      const prev = idx > 0 ? metrics[idx - 1].value : null;
                      const weekTrend = prev !== null
                        ? m.value > prev ? '↑' : m.value < prev ? '↓' : '→'
                        : null;
                      const weekTrendColour = weekTrend === '↑' ? 'text-green-500' : weekTrend === '↓' ? 'text-red-500' : 'text-gray-400';

                      return (
                        <tr key={m.weekNumber} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-800">
                            Week {m.weekNumber}
                            {weekTrend && (
                              <span className={`ml-1.5 text-xs ${weekTrendColour}`}>{weekTrend}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {m.label}
                          </td>
                          <td className={`px-3 py-2 text-right text-xs font-medium ${diffColour}`}>
                            {diffLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
