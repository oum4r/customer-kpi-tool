/**
 * 4-4-5 Retail Fiscal Calendar
 *
 * Rules:
 *  - Fiscal year = calendar year, starting at ISO week 1.
 *  - 12 periods following a 4-4-5 quarter pattern:
 *      Q1: P1 (4wk), P2 (4wk), P3 (5wk)
 *      Q2: P4 (4wk), P5 (4wk), P6 (5wk)
 *      Q3: P7 (4wk), P8 (4wk), P9 (5wk)
 *      Q4: P10 (4wk), P11 (4wk), P12 (5wk)
 *  - In 53-week years, P13 absorbs week 53.
 */

/** The 4-4-5 pattern: period lengths in weeks. */
const PERIOD_LENGTHS = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5] as const;

/**
 * Returns the number of ISO weeks in a given calendar year (52 or 53).
 */
function isoWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1).getDay(); // 0=Sun … 4=Thu
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  // 53-week year if Jan 1 is Thursday, or leap year with Jan 1 on Wednesday
  if (jan1 === 4) return 53;
  if (isLeap && jan1 === 3) return 53;
  return 52;
}

/**
 * Builds the full fiscal calendar for a given year.
 *
 * @param calendarYear — the calendar year (fiscal year = calendar year)
 * @returns Array of 12 (or 13) entries: `{ periodNumber, weeks[] }`
 */
export function buildFiscalYear(calendarYear: number): { periodNumber: number; weeks: number[] }[] {
  const periods: { periodNumber: number; weeks: number[] }[] = [];
  let currentWeek = 1;

  for (let p = 0; p < 12; p++) {
    const len = PERIOD_LENGTHS[p];
    const weeks: number[] = [];
    for (let w = 0; w < len; w++) {
      weeks.push(currentWeek);
      currentWeek++;
    }
    periods.push({ periodNumber: p + 1, weeks });
  }

  // In 53-week years, P13 absorbs week 53
  if (isoWeeksInYear(calendarYear) === 53) {
    periods.push({ periodNumber: 13, weeks: [53] });
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
 * @param weekNumber — ISO week number (1-53)
 * @param calendarYear — defaults to current calendar year
 */
export function getPeriodForWeek(weekNumber: number, calendarYear?: number): FiscalPeriodInfo {
  const year = calendarYear ?? new Date().getFullYear();
  const periods = buildFiscalYear(year);

  for (const period of periods) {
    if (period.weeks.includes(weekNumber)) {
      return {
        periodNumber: period.periodNumber,
        periodName: `Period ${period.periodNumber}`,
        weeksInPeriod: period.weeks,
      };
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
