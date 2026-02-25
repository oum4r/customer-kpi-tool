import type {
  ComputedKPIs,
  TrendData,
  WeekData,
  Targets,
  TrendDirection,
  DigitalReceiptLeaderboardEntry,
  OISLeaderboardEntry,
} from '../types';
import { calculateRAG } from './ragStatus';
import { stripEmployeeNumber, firstName } from './nameUtils';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Calculate the delta between the current value and a previous value.
 * Returns null if there is no previous value.
 */
export function calculateDelta(current: number, previous: number | null): number | null {
  if (previous === null) return null;
  return current - previous;
}

/**
 * Determine trend direction based on the delta between current and previous values.
 * Returns null if there is no previous value.
 * @param threshold - The minimum absolute delta to register as an upward or downward trend.
 */
export function calculateTrend(
  current: number,
  previous: number | null,
  threshold: number,
): TrendDirection {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta > threshold) return '↑';
  if (delta < -threshold) return '↓';
  return '→';
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Compute the store-level digital receipt percentage from a week's byPerson data.
 * Guards against division by zero (returns 0 if no transactions).
 */
function computeDigitalReceiptPercentage(
  byPerson: WeekData['digitalReceipts']['byPerson'],
): number {
  const totalCaptured = byPerson.reduce((sum, p) => sum + p.captured, 0);
  const totalTransactions = byPerson.reduce((sum, p) => sum + p.totalTransactions, 0);
  if (totalTransactions === 0) return 0;
  return Math.round((totalCaptured / totalTransactions) * 100);
}

/**
 * Compute OIS store total from a week's byPerson data.
 */
function computeOISStoreTotal(byPerson: WeekData['ois']['byPerson']): number {
  return byPerson.reduce((sum, p) => sum + p.revenue, 0);
}

/**
 * Build the digital receipts leaderboard, sorted by percentage descending.
 * Management names are appended at the bottom, unranked and flagged.
 * Handles zero-transaction edge case per person.
 */
function buildDigitalReceiptLeaderboard(
  byPerson: WeekData['digitalReceipts']['byPerson'],
  managementNames: string[],
): DigitalReceiptLeaderboardEntry[] {
  const mgmtSet = new Set(managementNames.map((n) => n.toLowerCase()));

  const entries = byPerson.map((p) => {
    const displayName = stripEmployeeNumber(p.name);
    return {
      name: displayName,
      captured: p.captured,
      totalTransactions: p.totalTransactions,
      percentage:
        p.totalTransactions === 0 ? 0 : Math.round((p.captured / p.totalTransactions) * 100),
      isManagement: mgmtSet.has(displayName.toLowerCase()),
    };
  });

  entries.sort((a, b) => b.percentage - a.percentage);

  // Split into advisors and management
  const advisors = entries.filter((e) => !e.isManagement);
  const management = entries.filter((e) => e.isManagement);

  // Rank only advisors
  const rankedAdvisors: DigitalReceiptLeaderboardEntry[] = advisors.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  // Management entries are unranked (null)
  const unrankedMgmt: DigitalReceiptLeaderboardEntry[] = management.map((entry) => ({
    rank: null,
    ...entry,
  }));

  return [...rankedAdvisors, ...unrankedMgmt];
}

/**
 * Build the OIS leaderboard, sorted by revenue descending.
 * Management names are appended at the bottom, unranked and flagged.
 */
function buildOISLeaderboard(
  byPerson: WeekData['ois']['byPerson'],
  managementNames: string[],
): OISLeaderboardEntry[] {
  const mgmtSet = new Set(managementNames.map((n) => n.toLowerCase()));

  const entries = [...byPerson]
    .sort((a, b) => b.revenue - a.revenue)
    .map((p) => {
      const displayName = stripEmployeeNumber(p.name);
      return {
        name: displayName,
        revenue: p.revenue,
        isManagement: mgmtSet.has(displayName.toLowerCase()),
      };
    });

  // Split into advisors and management
  const advisors = entries.filter((e) => !e.isManagement);
  const management = entries.filter((e) => e.isManagement);

  const rankedAdvisors: OISLeaderboardEntry[] = advisors.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  const unrankedMgmt: OISLeaderboardEntry[] = management.map((entry) => ({
    rank: null,
    ...entry,
  }));

  return [...rankedAdvisors, ...unrankedMgmt];
}

/**
 * Find the previous week relative to the given weekNumber from the full dataset.
 * "Previous" means the week with the largest weekNumber that is still less than the given one.
 */
function findPreviousWeek(
  weekNumber: number,
  allWeeks: WeekData[],
): WeekData | null {
  const earlier = allWeeks
    .filter((w) => w.weekNumber < weekNumber)
    .sort((a, b) => b.weekNumber - a.weekNumber);
  return earlier.length > 0 ? earlier[0] : null;
}

/**
 * Determine the top performer(s) across digital receipts and OIS leaderboards.
 * A top performer is any person who holds rank 1 in the most leaderboards.
 */
function computeTopPerformers(
  drLeaderboard: DigitalReceiptLeaderboardEntry[],
  oisLeaderboard: OISLeaderboardEntry[],
): string[] {
  if (drLeaderboard.length === 0 && oisLeaderboard.length === 0) {
    return [];
  }

  const rank1Counts = new Map<string, number>();

  // Count rank-1 appearances in digital receipts
  for (const entry of drLeaderboard) {
    if (entry.rank === 1) {
      rank1Counts.set(entry.name, (rank1Counts.get(entry.name) ?? 0) + 1);
    }
  }

  // Count rank-1 appearances in OIS
  for (const entry of oisLeaderboard) {
    if (entry.rank === 1) {
      rank1Counts.set(entry.name, (rank1Counts.get(entry.name) ?? 0) + 1);
    }
  }

  if (rank1Counts.size === 0) return [];

  const maxCount = Math.max(...rank1Counts.values());
  const topPerformers: string[] = [];
  for (const [name, count] of rank1Counts) {
    if (count === maxCount) {
      topPerformers.push(firstName(name));
    }
  }

  return topPerformers;
}

// ============================================================
// Main Exported Functions
// ============================================================

/**
 * Compute all KPIs for a given week, including trends relative to the previous week.
 */
export function computeKPIs(
  weekData: WeekData,
  allWeeks: WeekData[],
  targets: Targets,
  periodName: string,
  managementNames: string[] = [],
): ComputedKPIs {
  const previousWeek = findPreviousWeek(weekData.weekNumber, allWeeks);

  // --- CNL ---
  const cnlSignUps = weekData.cnl.signUps;
  const cnlTarget = targets.cnlWeekly;
  const cnlPercentage = cnlTarget === 0 ? 0 : Math.round((cnlSignUps / cnlTarget) * 100);
  const cnlRag = calculateRAG(cnlSignUps, cnlTarget);
  const previousCnlSignUps = previousWeek ? previousWeek.cnl.signUps : null;
  const cnlTrend = calculateTrend(cnlSignUps, previousCnlSignUps, 1);
  const cnlDelta = calculateDelta(cnlSignUps, previousCnlSignUps);

  // --- Digital Receipts ---
  const drStorePercentage = computeDigitalReceiptPercentage(weekData.digitalReceipts.byPerson);
  const drTarget = targets.digitalReceiptPercentage;
  const drRag = calculateRAG(drStorePercentage, drTarget);
  const drLeaderboard = buildDigitalReceiptLeaderboard(weekData.digitalReceipts.byPerson, managementNames);

  const previousDrPercentage = previousWeek
    ? computeDigitalReceiptPercentage(previousWeek.digitalReceipts.byPerson)
    : null;
  const drTrend = calculateTrend(drStorePercentage, previousDrPercentage, 1);
  const drDelta = calculateDelta(drStorePercentage, previousDrPercentage);

  // --- OIS ---
  const oisStoreTotal = computeOISStoreTotal(weekData.ois.byPerson);
  const oisTarget = targets.oisWeekly;
  const oisRag = calculateRAG(oisStoreTotal, oisTarget);
  const oisLeaderboard = buildOISLeaderboard(weekData.ois.byPerson, managementNames);

  const previousOisTotal = previousWeek
    ? computeOISStoreTotal(previousWeek.ois.byPerson)
    : null;
  const oisTrend = calculateTrend(oisStoreTotal, previousOisTotal, 5);
  const oisDelta = calculateDelta(oisStoreTotal, previousOisTotal);

  // --- Top Performers ---
  const topPerformers = computeTopPerformers(drLeaderboard, oisLeaderboard);

  return {
    cnl: {
      signUps: cnlSignUps,
      target: cnlTarget,
      percentage: cnlPercentage,
      rag: cnlRag,
      trend: cnlTrend,
      delta: cnlDelta,
    },
    digitalReceipts: {
      storePercentage: drStorePercentage,
      target: drTarget,
      rag: drRag,
      trend: drTrend,
      delta: drDelta,
      leaderboard: drLeaderboard,
    },
    ois: {
      storeTotal: oisStoreTotal,
      target: oisTarget,
      rag: oisRag,
      trend: oisTrend,
      delta: oisDelta,
      leaderboard: oisLeaderboard,
    },
    topPerformers,
    weekNumber: weekData.weekNumber,
    periodName,
  };
}

/**
 * Compute trend data across all available weeks for charting.
 * Weeks are sorted ascending by weekNumber.
 */
export function computeTrendData(weeks: WeekData[], targets: Targets): TrendData {
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);

  const weekNumbers: number[] = [];
  const cnlValues: number[] = [];
  const digitalValues: number[] = [];
  const oisValues: number[] = [];

  for (const week of sorted) {
    weekNumbers.push(week.weekNumber);
    cnlValues.push(week.cnl.signUps);
    digitalValues.push(computeDigitalReceiptPercentage(week.digitalReceipts.byPerson));
    oisValues.push(computeOISStoreTotal(week.ois.byPerson));
  }

  return {
    weeks: weekNumbers,
    cnlValues,
    digitalValues,
    oisValues,
    cnlTarget: targets.cnlWeekly,
    digitalTarget: targets.digitalReceiptPercentage,
    oisTarget: targets.oisWeekly,
  };
}
