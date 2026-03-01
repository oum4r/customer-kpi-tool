/**
 * New Look 4-4-5 Retail Fiscal Calendar
 *
 * Rules:
 *  - Fiscal year starts on the last Sunday of March each year.
 *  - 13 periods per year following a 4-4-5 quarter pattern:
 *      Q1: P1 (4wk), P2 (4wk), P3 (5wk)
 *      Q2: P4 (4wk), P5 (4wk), P6 (5wk)
 *      Q3: P7 (4wk), P8 (4wk), P9 (5wk)
 *      Q4: P10 (4wk), P11 (4wk), P12 (5wk)
 *    + P13 absorbs any remaining week (53-week years).
 *  - Week numbers map to ISO weeks (Mon-Sun, 1-53).
 */

/** The 4-4-5 pattern: period lengths in weeks. */
const PERIOD_LENGTHS = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5] as const;

/**
 * Returns the last Sunday of March for the given calendar year.
 */
export function getFiscalYearStart(year: number): Date {
  // Start from March 31 and walk backwards to find Sunday (day === 0)
  const d = new Date(year, 2, 31); // March 31
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/**
 * Returns the ISO week number (1-53) for a given Date.
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Builds the full fiscal calendar for a given fiscal year, mapping each period
 * to its list of ISO week numbers.
 *
 * @param calendarYear — the calendar year whose last-Sunday-of-March starts the fiscal year.
 * @returns Array of 13 entries: `{ periodNumber, weeks[] }`
 */
export function buildFiscalYear(calendarYear: number): { periodNumber: number; weeks: number[] }[] {
  const start = getFiscalYearStart(calendarYear);
  const startWeek = getISOWeek(start);

  // How many ISO weeks in the calendar year that contains most of the fiscal year?
  // The fiscal year spans calendarYear (Apr–Dec) and calendarYear+1 (Jan–Mar).
  // We need to handle week wrapping (e.g. week 52 → week 1).

  const periods: { periodNumber: number; weeks: number[] }[] = [];
  let currentWeek = startWeek;

  for (let p = 0; p < 12; p++) {
    const len = PERIOD_LENGTHS[p];
    const weeks: number[] = [];
    for (let w = 0; w < len; w++) {
      weeks.push(currentWeek);
      currentWeek = currentWeek >= 53 ? 1 : currentWeek + 1;
    }
    periods.push({ periodNumber: p + 1, weeks });
  }

  // Period 13: absorb any remaining weeks until the next fiscal year starts
  const nextStart = getFiscalYearStart(calendarYear + 1);
  const nextStartWeek = getISOWeek(nextStart);

  const p13Weeks: number[] = [];
  while (currentWeek !== nextStartWeek) {
    p13Weeks.push(currentWeek);
    currentWeek = currentWeek >= 53 ? 1 : currentWeek + 1;
    // Safety: break if we've gone past 6 weeks (should never happen in a valid calendar)
    if (p13Weeks.length > 6) break;
  }

  if (p13Weeks.length > 0) {
    periods.push({ periodNumber: 13, weeks: p13Weeks });
  }

  return periods;
}

export interface FiscalPeriodInfo {
  periodNumber: number;
  periodName: string;
  weeksInPeriod: number[];
}

/**
 * Given an ISO week number, returns the fiscal period it belongs to.
 *
 * Tries the fiscal year starting in the given `calendarYear` first,
 * then falls back to the previous year (for weeks in Jan–Mar that
 * belong to the prior fiscal year).
 *
 * @param weekNumber — ISO week number (1-53)
 * @param calendarYear — defaults to current calendar year
 */
export function getPeriodForWeek(weekNumber: number, calendarYear?: number): FiscalPeriodInfo {
  const year = calendarYear ?? new Date().getFullYear();

  // Try current year's fiscal calendar first, then previous year
  for (const y of [year, year - 1]) {
    const periods = buildFiscalYear(y);
    for (const period of periods) {
      if (period.weeks.includes(weekNumber)) {
        return {
          periodNumber: period.periodNumber,
          periodName: `Period ${period.periodNumber}`,
          weeksInPeriod: period.weeks,
        };
      }
    }
  }

  // Fallback: shouldn't happen, but return a sensible default
  return {
    periodNumber: 0,
    periodName: `Week ${weekNumber}`,
    weeksInPeriod: [weekNumber],
  };
}

/**
 * Returns all ISO week numbers in the same fiscal period as the given week.
 * Convenience wrapper used by CnlQuickEntry for default week suggestion.
 */
export function getCurrentFiscalWeeks(weekNumber: number, calendarYear?: number): number[] {
  return getPeriodForWeek(weekNumber, calendarYear).weeksInPeriod;
}
