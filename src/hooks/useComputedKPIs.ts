import { useMemo } from 'react';
import type { ComputedKPIs } from '../types';
import { useAppData } from './useAppData';
import { computeKPIs } from '../engine/calculations';

export function useComputedKPIs(weekNumber?: number): ComputedKPIs | null {
  const { appData, currentWeek } = useAppData();

  const managementNames = appData.settings.managementNames ?? [];

  return useMemo(() => {
    const targetWeekNum = weekNumber ?? currentWeek;
    if (targetWeekNum === null || appData.weeks.length === 0) return null;

    const weekData = appData.weeks.find((w) => w.weekNumber === targetWeekNum);
    if (!weekData) return null;

    return computeKPIs(weekData, appData.weeks, appData.targets, appData.period.name, managementNames);
  }, [appData.weeks, appData.targets, appData.period.name, weekNumber, currentWeek, managementNames]);
}
