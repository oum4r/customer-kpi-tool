import type { RAGStatus, TrendDirection } from '../../types';
import { ragToBgTailwindClass, ragToTailwindClass } from '../../engine/ragStatus';

export interface KPICardProps {
  title: string;
  value: number;
  target: number;
  unit: string;
  percentage: number;
  rag: RAGStatus;
  trend: TrendDirection;
  delta: number | null;
  showTrend: boolean;
}

/**
 * KPI summary card with progress bar, RAG colour coding,
 * remaining-to-target callout, and optional trend indicator.
 */
export function KPICard({
  title,
  value,
  target,
  unit,
  percentage,
  rag,
  trend,
  delta,
  showTrend,
}: KPICardProps) {
  const clampedPercentage = Math.min(percentage, 100);
  const remaining = target - value;
  const isBelow = remaining > 0;

  // Format the value display based on the unit type
  const formatValue = () => {
    if (unit === '%') {
      return `${value}% / ${target}%`;
    }
    if (unit.startsWith('\u00a3') || unit.startsWith('£')) {
      return `£${value} / £${target}`;
    }
    return `${value} / ${target} ${unit}`;
  };

  // Format the remaining callout message
  const formatRemaining = () => {
    if (unit === '%') {
      return `${remaining}% more needed`;
    }
    if (unit.startsWith('\u00a3') || unit.startsWith('£')) {
      return `£${remaining} more needed`;
    }
    return `${remaining} more ${unit} to hit target`;
  };

  // Determine trend arrow colour
  const trendColourClass = (() => {
    if (trend === '\u2191') return 'text-green-600';
    if (trend === '\u2193') return 'text-red-600';
    return 'text-gray-500';
  })();

  // Format delta display
  const formatDelta = () => {
    if (delta === null) return '';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}`;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header row: title + trend */}
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {showTrend && trend && (
          <span className={`flex items-center gap-1 text-sm font-medium ${trendColourClass}`}>
            <span className="text-base">{trend}</span>
            <span>{formatDelta()}</span>
          </span>
        )}
      </div>

      {/* Value display */}
      <p className="mt-2 text-lg font-bold text-gray-900">{formatValue()}</p>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${ragToBgTailwindClass(rag)}`}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className={`text-xs font-medium ${ragToTailwindClass(rag)}`}>
            {percentage}%
          </span>
          <span className="text-xs text-gray-400">Target: 100%</span>
        </div>
      </div>

      {/* Remaining-to-target callout */}
      {isBelow && (
        <p className="mt-2 text-xs text-gray-500 italic">
          {formatRemaining()}
        </p>
      )}
    </div>
  );
}
