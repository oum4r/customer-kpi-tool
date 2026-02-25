import { useMemo } from 'react';
import { useComputedKPIs } from '../../hooks/useComputedKPIs';
import { useAppData } from '../../hooks/useAppData';
import { useTrendData } from '../../hooks/useTrendData';
import { KPICard } from './KPICard';
import { Leaderboard } from './Leaderboard';
import type { LeaderboardColumn } from './Leaderboard';
import { TopPerformer } from './TopPerformer';
import { TrendChart } from '../charts/TrendChart';
import { WeekSelector } from './WeekSelector';

/**
 * Column definitions for the Digital Receipts leaderboard.
 */
const digitalReceiptsColumns: LeaderboardColumn[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'name', label: 'Name' },
  { key: 'captured', label: 'Captured' },
  { key: 'totalTransactions', label: 'Total Txn' },
  {
    key: 'percentage',
    label: 'Capture %',
    format: (v) => `${v}%`,
  },
];

/**
 * Column definitions for the Order in Store leaderboard.
 */
const oisColumns: LeaderboardColumn[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'name', label: 'Name' },
  {
    key: 'revenue',
    label: 'Revenue (\u00a3)',
    format: (v) => `\u00a3${v}`,
  },
];

/**
 * Main dashboard page composing KPI cards, leaderboards,
 * the top performer banner, and trend charts.
 */
export function Dashboard() {
  const { appData, currentWeek, setCurrentWeek } = useAppData();
  const kpis = useComputedKPIs(currentWeek ?? undefined);
  const trendData = useTrendData();
  const showTrend = appData.settings.showTrendIndicators;

  const availableWeeks = useMemo(
    () => appData.weeks.map((w) => w.weekNumber).sort((a, b) => a - b),
    [appData.weeks],
  );

  // Handle null / no-data state
  if (!kpis) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
        <div className="text-5xl">📊</div>
        <h2 className="text-xl font-bold text-gray-800">No data yet</h2>
        <p className="max-w-sm text-sm text-gray-500">
          Upload your first week of data to start tracking KPIs. Head over to
          the <span className="font-semibold text-blue-600">Upload</span> tab to
          get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Period / week header */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          {kpis.periodName}
        </h1>
        {availableWeeks.length > 0 && currentWeek != null && (
          <WeekSelector
            weeks={availableWeeks}
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
          />
        )}
      </header>

      {/* KPI summary cards in a responsive grid */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPICard
          title="Club New Look"
          value={kpis.cnl.signUps}
          target={kpis.cnl.target}
          unit="sign-ups"
          percentage={kpis.cnl.percentage}
          rag={kpis.cnl.rag}
          trend={kpis.cnl.trend}
          delta={kpis.cnl.delta}
          showTrend={showTrend}
        />
        <KPICard
          title="Digital Receipts"
          value={kpis.digitalReceipts.storePercentage}
          target={kpis.digitalReceipts.target}
          unit="%"
          percentage={Math.round(
            (kpis.digitalReceipts.storePercentage / kpis.digitalReceipts.target) * 100,
          )}
          rag={kpis.digitalReceipts.rag}
          trend={kpis.digitalReceipts.trend}
          delta={kpis.digitalReceipts.delta}
          showTrend={showTrend}
        />
        <KPICard
          title="Order in Store"
          value={kpis.ois.storeTotal}
          target={kpis.ois.target}
          unit="\u00a3"
          percentage={Math.round((kpis.ois.storeTotal / kpis.ois.target) * 100)}
          rag={kpis.ois.rag}
          trend={kpis.ois.trend}
          delta={kpis.ois.delta}
          showTrend={showTrend}
        />
      </section>

      {/* Leaderboards */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Leaderboard
          title="Digital Receipts Leaderboard"
          columns={digitalReceiptsColumns}
          data={kpis.digitalReceipts.leaderboard}
          highlightTopPerformer
        />
        <Leaderboard
          title="Order in Store Leaderboard"
          columns={oisColumns}
          data={kpis.ois.leaderboard}
          highlightTopPerformer
        />
      </section>

      {/* Top performer banner */}
      <section>
        <TopPerformer names={kpis.topPerformers} />
      </section>

      {/* Trend charts (stub, will be replaced by Stream 4) */}
      {trendData && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Trends</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <TrendChart
              title="Club New Look"
              weeks={trendData.weeks}
              values={trendData.cnlValues}
              target={trendData.cnlTarget}
              unit="sign-ups"
              colour="#3b82f6"
              compact
            />
            <TrendChart
              title="Digital Receipts"
              weeks={trendData.weeks}
              values={trendData.digitalValues}
              target={trendData.digitalTarget}
              unit="%"
              colour="#8b5cf6"
              compact
            />
            <TrendChart
              title="Order in Store"
              weeks={trendData.weeks}
              values={trendData.oisValues}
              target={trendData.oisTarget}
              unit="\u00a3"
              colour="#10b981"
              compact
            />
          </div>
        </section>
      )}
    </div>
  );
}
