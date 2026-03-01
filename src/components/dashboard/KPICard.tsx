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

  const isCurrency = unit === '£';
  const isPercent = unit === '%';

  /** Attach the unit to a number: £200, 78%, 33 */
  const withUnit = (n: number) => {
    if (isCurrency) return `£${n}`;
    if (isPercent) return `${n}%`;
    return String(n);
  };

  // Format: "value / target" — unit always attached to each number
  const formatValue = () => `${withUnit(value)} / ${withUnit(target)}`;

  // Format remaining — consistent phrasing for all units
  const formatRemaining = () => `${withUnit(remaining)} more needed`;

  // Determine trend arrow colour
  const trendColourClass = (() => {
    if (trend === '\u2191') return 'text-green-600';
    if (trend === '\u2193') return 'text-red-600';
    return 'text-gray-500';
  })();

  // Format delta with unit so it's meaningful (e.g. +15, +1%, -£34.86)
  const formatDelta = () => {
    if (delta === null) return '';
    const sign = delta > 0 ? '+' : '';
    if (isCurrency) return `${sign}£${Math.abs(delta)}`;
    if (isPercent) return `${sign}${delta}%`;
    return `${sign}${delta}`;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header row: title + trend */}
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-gray-700">{title}</h3>
        {showTrend && trend && (
          <span className={`flex items-center gap-1 text-sm font-medium ${trendColourClass}`}>
            <span className="text-lg">{trend}</span>
            <span>{formatDelta()}</span>
          </span>
        )}
      </div>

      {/* Value display */}
      <p className="mt-2 text-2xl font-bold text-gray-900">{formatValue()}</p>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${ragToBgTailwindClass(rag)}`}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className={`text-sm font-medium ${ragToTailwindClass(rag)}`}>
            {percentage}%
          </span>
          <span className="text-sm text-gray-400">Target: 100%</span>
        </div>
      </div>

      {/* Remaining-to-target callout */}
      {isBelow && (
        <p className="mt-2 text-sm text-gray-500 italic">
          {formatRemaining()}
        </p>
      )}
    </div>
  );
}
