import type {
  ComputedKPIs,
  TrendData,
  WeekData,
  AppData,
  PeriodConfig,
  Targets,
  Settings,
} from '../types';

export const DEFAULT_TARGETS: Targets = {
  cnlWeekly: 25,
  digitalReceiptPercentage: 80,
  oisWeekly: 200,
};

export const DEFAULT_SETTINGS: Settings = {
  showTrendIndicators: true,
  messageTone: 'encouraging',
  managementNames: [],
};

export const DEFAULT_PERIOD_CONFIG: PeriodConfig = {
  name: 'Period 11',
  startDate: '2026-01-25',
  endDate: '2026-02-21',
  weeks: [44, 45, 46, 47],
};

export const MOCK_WEEK_DATA: WeekData[] = [
  {
    weekNumber: 44,
    cnl: { signUps: 12 },
    digitalReceipts: {
      byPerson: [
        { name: 'Sarah', captured: 35, totalTransactions: 50 },
        { name: 'James', captured: 30, totalTransactions: 45 },
        { name: 'Priya', captured: 25, totalTransactions: 40 },
        { name: 'Tom', captured: 18, totalTransactions: 38 },
      ],
    },
    ois: {
      byPerson: [
        { name: 'James', revenue: 42 },
        { name: 'Sarah', revenue: 30 },
        { name: 'Tom', revenue: 15 },
        { name: 'Priya', revenue: 8 },
      ],
    },
  },
  {
    weekNumber: 45,
    cnl: { signUps: 14 },
    digitalReceipts: {
      byPerson: [
        { name: 'Sarah', captured: 40, totalTransactions: 48 },
        { name: 'James', captured: 34, totalTransactions: 42 },
        { name: 'Priya', captured: 28, totalTransactions: 41 },
        { name: 'Tom', captured: 20, totalTransactions: 39 },
      ],
    },
    ois: {
      byPerson: [
        { name: 'James', revenue: 55 },
        { name: 'Sarah', revenue: 38 },
        { name: 'Tom', revenue: 22 },
        { name: 'Priya', revenue: 13 },
      ],
    },
  },
  {
    weekNumber: 46,
    cnl: { signUps: 18 },
    digitalReceipts: {
      byPerson: [
        { name: 'Sarah', captured: 45, totalTransactions: 49 },
        { name: 'James', captured: 38, totalTransactions: 44 },
        { name: 'Priya', captured: 30, totalTransactions: 42 },
        { name: 'Tom', captured: 22, totalTransactions: 40 },
      ],
    },
    ois: {
      byPerson: [
        { name: 'James', revenue: 68 },
        { name: 'Sarah', revenue: 45 },
        { name: 'Tom', revenue: 28 },
        { name: 'Priya', revenue: 15 },
      ],
    },
  },
];

export const MOCK_COMPUTED_KPIS: ComputedKPIs = {
  weekNumber: 46,
  periodName: 'Period 11',
  cnl: {
    signUps: 18,
    target: 25,
    percentage: 72,
    rag: 'red',
    trend: '\u2191',
    delta: 4,
  },
  digitalReceipts: {
    storePercentage: 74,
    target: 80,
    rag: 'amber',
    trend: '\u2193',
    delta: -3,
    leaderboard: [
      { rank: 1, name: 'Sarah', captured: 45, totalTransactions: 49, percentage: 92, isManagement: false },
      { rank: 2, name: 'James', captured: 38, totalTransactions: 44, percentage: 86, isManagement: false },
      { rank: 3, name: 'Priya', captured: 30, totalTransactions: 42, percentage: 71, isManagement: false },
      { rank: 4, name: 'Tom', captured: 22, totalTransactions: 40, percentage: 55, isManagement: false },
    ],
  },
  ois: {
    storeTotal: 156,
    target: 200,
    rag: 'amber',
    trend: '\u2191',
    delta: 28,
    leaderboard: [
      { rank: 1, name: 'James', revenue: 68, isManagement: false },
      { rank: 2, name: 'Sarah', revenue: 45, isManagement: false },
      { rank: 3, name: 'Tom', revenue: 28, isManagement: false },
      { rank: 4, name: 'Priya', revenue: 15, isManagement: false },
    ],
  },
  topPerformers: ['Sarah'],
};

export const MOCK_TREND_DATA: TrendData = {
  weeks: [44, 45, 46],
  cnlValues: [12, 14, 18],
  digitalValues: [68, 77, 74],
  oisValues: [95, 128, 156],
  cnlTarget: 25,
  digitalTarget: 80,
  oisTarget: 200,
};

export const MOCK_APP_DATA: AppData = {
  period: DEFAULT_PERIOD_CONFIG,
  weeks: MOCK_WEEK_DATA,
  targets: DEFAULT_TARGETS,
  settings: DEFAULT_SETTINGS,
  columnMappings: {},
};
