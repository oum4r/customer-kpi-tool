// ============================================================
// Core Data Types
// ============================================================

/** @deprecated Kept only for backward-compatible migration of old localStorage data. */
export interface LegacyPeriodConfig {
  name: string;
  startDate: string;
  endDate: string;
  weeks: number[];
}

export interface WeekData {
  weekNumber: number;
  cnl: {
    signUps: number;
  };
  digitalReceipts: {
    byPerson: {
      name: string;
      captured: number;
      totalTransactions: number;
    }[];
  };
  ois: {
    byPerson: {
      name: string;
      revenue: number;
    }[];
  };
}

export interface Targets {
  cnlWeekly: number;
  digitalReceiptPercentage: number;
  oisWeekly: number;
}

export type MessageTone = 'encouraging' | 'neutral' | 'coaching';

export interface Settings {
  showTrendIndicators: boolean;
  messageTone: MessageTone;
  managementNames: string[];
  /** Store number for cloud sync (e.g. "1234") */
  storeNumber?: string;
}

export interface AppData {
  weeks: WeekData[];
  targets: Targets;
  settings: Settings;
  columnMappings: Record<string, Record<string, string>>;
}

// ============================================================
// Computed / Derived Types
// ============================================================

export type RAGStatus = 'green' | 'amber' | 'red';
export type TrendDirection = '\u2191' | '\u2193' | '\u2192' | null;

export interface DigitalReceiptLeaderboardEntry {
  rank: number | null;
  name: string;
  captured: number;
  totalTransactions: number;
  percentage: number;
  isManagement: boolean;
}

export interface OISLeaderboardEntry {
  rank: number | null;
  name: string;
  revenue: number;
  isManagement: boolean;
}

export interface ComputedKPIs {
  cnl: {
    signUps: number;
    target: number;
    percentage: number;
    rag: RAGStatus;
    trend: TrendDirection;
    delta: number | null;
  };
  digitalReceipts: {
    storePercentage: number;
    target: number;
    rag: RAGStatus;
    trend: TrendDirection;
    delta: number | null;
    leaderboard: DigitalReceiptLeaderboardEntry[];
  };
  ois: {
    storeTotal: number;
    target: number;
    rag: RAGStatus;
    trend: TrendDirection;
    delta: number | null;
    leaderboard: OISLeaderboardEntry[];
  };
  topPerformers: string[];
  weekNumber: number;
  periodName: string;
}

export interface TrendData {
  cnlWeeks: number[];
  cnlValues: number[];
  digitalWeeks: number[];
  digitalValues: number[];
  oisWeeks: number[];
  oisValues: number[];
  cnlTarget: number;
  digitalTarget: number;
  oisTarget: number;
}

// ============================================================
// Column Mapping / Parsing Types
// ============================================================

export type DatasetType = 'cnl' | 'digitalReceipts' | 'ois';

export interface ColumnMapping {
  datasetType: DatasetType;
  mappings: Record<string, string>;
}

export interface ParsedRow {
  [columnName: string]: string | number;
}

// ============================================================
// Navigation
// ============================================================

export type ActiveTab = 'dashboard' | 'upload' | 'whatsapp' | 'infographic' | 'settings';
