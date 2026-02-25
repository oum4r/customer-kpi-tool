import { useMemo } from 'react';
import type { TrendData } from '../types';
import { useAppData } from './useAppData';
import { computeTrendData } from '../engine/calculations';

export function useTrendData(): TrendData | null {
  const { appData } = useAppData();

  return useMemo(() => {
    if (appData.weeks.length === 0) return null;
    return computeTrendData(appData.weeks, appData.targets);
  }, [appData.weeks, appData.targets]);
}
