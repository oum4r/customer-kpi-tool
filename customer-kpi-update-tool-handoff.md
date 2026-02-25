# Customer KPI Update Tool — Build Handoff

## Project Summary

A browser-based web app for retail store managers to generate weekly customer KPI updates. It takes PowerBI export data, calculates performance against targets, and produces:

1. A **copy-paste WhatsApp message** with KPIs, leaderboards, and encouragement
2. A **downloadable infographic image** (PNG) for sharing alongside the message

No backend. No login. No install. All data in browser local storage.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React (Vite) |
| Styling | Tailwind CSS |
| File parsing | PapaParse (CSV), SheetJS/xlsx (Excel) |
| Charts | Recharts |
| Image export | html2canvas or dom-to-image |
| Clipboard | navigator.clipboard API |
| Storage | Browser localStorage |
| Hosting target | Static (Vercel/Netlify/GitHub Pages) |

---

## KPI Definitions

### 1. Club New Look (CNL)
- **What:** New loyalty programme sign-ups
- **Target:** 25 per week (store-wide)
- **Tracking:** Store-level only — **cannot** be attributed to individuals
- **No leaderboard** for this KPI

### 2. Digital Receipts
- **What:** % of transactions where an email receipt was captured
- **Formula:** `(email receipts captured / total transactions) × 100`
- **Target:** 80%
- **Tracking:** Individual (based on till login)
- **Leaderboard:** Yes — ranked by capture %

### 3. Order in Store (OIS)
- **What:** Revenue from in-store ordering of online stock
- **Target:** £200 per week (store-wide)
- **Tracking:** Individual
- **Leaderboard:** Yes — ranked by £ revenue

### RAG Status Thresholds
- 🟢 Green: ≥ 100% of target
- 🟠 Amber: ≥ 80% but < 100% of target
- 🔴 Red: < 80% of target

---

## Retail Period Structure

The business uses a custom retail calendar, NOT standard calendar months. Each period = 4–5 weeks.

Example:
- **Period 11:** Weeks 44–47, 25/01/2026 → 21/02/2026
- **Period 12:** Weeks 48–52, 22/02/2026 → 28/03/2026

The manager manually configures each period with: period name, start date, end date, and week numbers.

---

## Data Input

### Upload format
Manager exports from PowerBI as CSV or Excel. Three data sets:

**CNL (store-level):**
| Field | Description |
|-------|------------|
| Week number or date | Which week the data belongs to |
| CNL sign-ups | Total store sign-ups for that week |

**Digital Receipts (individual):**
| Field | Description |
|-------|------------|
| Team member name | Person who served the customer |
| Digital receipts captured | Count of email receipts |
| Total transactions | Count of all transactions served |
| Week number or date | Which week |

**OIS (individual):**
| Field | Description |
|-------|------------|
| Team member name | Person who made the OIS |
| OIS revenue (£) | Revenue generated |
| Week number or date | Which week |

### Column Mapping
PowerBI exports may have different column headers. On first upload, the user maps columns to required fields via dropdowns. This mapping is saved in localStorage for future uploads.

### Data may come as separate files or a single file with multiple sheets/sections.

---

## Workstreams

### Stream 1 — Data Layer & File Parsing

**Purpose:** Handle all data ingestion, storage, and period management.

**Tasks:**
- File upload component accepting .csv, .xlsx, .xls
- CSV parsing via PapaParse, Excel parsing via SheetJS
- Column mapping UI: show detected columns as dropdowns, user maps to required fields
- Save column mapping to localStorage
- localStorage manager:
  - Save/load period configuration
  - Save/load weekly KPI data (accumulated across weeks in a period)
  - Reset period (clear all data for fresh start)
  - Export all stored data as JSON file download
  - Import JSON file to restore data
- Period configuration form: period name, start date, end date, list of week numbers
- Data validation: flag missing fields, duplicate weeks, type mismatches

**Exports (interface for other streams):**
```typescript
interface PeriodConfig {
  name: string;           // e.g. "Period 11"
  startDate: string;      // ISO date
  endDate: string;        // ISO date
  weeks: number[];        // e.g. [44, 45, 46, 47]
}

interface WeekData {
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

interface AppData {
  period: PeriodConfig;
  weeks: WeekData[];
  targets: Targets;
  settings: Settings;
  columnMappings: Record<string, Record<string, string>>;
}
```

---

### Stream 2 — KPI Calculation Engine

**Purpose:** Pure calculation logic, no UI. Takes raw data, returns computed KPIs.

**Tasks:**
- CNL: compare store sign-ups to target (default 25)
- Digital Receipts: per-person capture %, store-wide aggregate %
- OIS: per-person revenue, store-wide total vs target (default £200)
- Leaderboard sorting: Digital by %, OIS by £, descending
- Top performer logic: person who tops the most leaderboards; if tie, return all tied
- Week-on-week deltas: calculate change from previous week for each KPI
- Trend indicators: ↑ (improved), ↓ (declined), → (unchanged, within ±1% / ±£5 / ±1 signup)
- RAG status per KPI: green (≥100%), amber (≥80%), red (<80%)

**Exports:**
```typescript
interface ComputedKPIs {
  cnl: {
    signUps: number;
    target: number;
    percentage: number;
    rag: 'green' | 'amber' | 'red';
    trend: '↑' | '↓' | '→' | null;  // null if no previous week
    delta: number | null;
  };
  digitalReceipts: {
    storePercentage: number;
    target: number;
    rag: 'green' | 'amber' | 'red';
    trend: '↑' | '↓' | '→' | null;
    delta: number | null;
    leaderboard: {
      rank: number;
      name: string;
      captured: number;
      totalTransactions: number;
      percentage: number;
    }[];
  };
  ois: {
    storeTotal: number;
    target: number;
    rag: 'green' | 'amber' | 'red';
    trend: '↑' | '↓' | '→' | null;
    delta: number | null;
    leaderboard: {
      rank: number;
      name: string;
      revenue: number;
    }[];
  };
  topPerformers: string[];  // name(s)
  weekNumber: number;
  periodName: string;
}

interface TrendData {
  weeks: number[];
  cnlValues: number[];
  digitalValues: number[];
  oisValues: number[];
  cnlTarget: number;
  digitalTarget: number;
  oisTarget: number;
}
```

---

### Stream 3 — Dashboard & Leaderboard UI

**Purpose:** Main app layout and all visible screens.

**Tasks:**
- Responsive layout (mobile-first, works on phone and desktop)
- Navigation: Dashboard / Upload / Settings
- Dashboard page:
  - 3 KPI summary cards with progress bars or circular gauges
  - Colour-coded by RAG status (green/amber/red)
  - Trend arrow next to each value (when enabled)
  - Remaining-to-target callout (e.g. "7 more to hit target")
- Digital Receipts leaderboard table:
  - Columns: Rank, Name, Captured, Total Transactions, Capture %
  - Top performer row highlighted (gold/trophy icon)
- OIS leaderboard table:
  - Columns: Rank, Name, Revenue (£)
  - Top performer row highlighted
- Top Performer of the Week section (prominent, celebratory)
- Settings page:
  - Period configuration form
  - Target overrides (CNL, Digital %, OIS £)
  - Trend indicators toggle (on/off)
  - Reset period button (with confirmation)
  - Export/Import JSON buttons

**Use mock data during development.** Example mock:
```json
{
  "weekNumber": 46,
  "periodName": "Period 11",
  "cnl": { "signUps": 18, "target": 25, "percentage": 72, "rag": "red", "trend": "↑", "delta": 4 },
  "digitalReceipts": {
    "storePercentage": 74,
    "target": 80,
    "rag": "amber",
    "trend": "↓",
    "delta": -3,
    "leaderboard": [
      { "rank": 1, "name": "Sarah", "captured": 45, "totalTransactions": 49, "percentage": 92 },
      { "rank": 2, "name": "James", "captured": 38, "totalTransactions": 44, "percentage": 86 },
      { "rank": 3, "name": "Priya", "captured": 30, "totalTransactions": 42, "percentage": 71 },
      { "rank": 4, "name": "Tom", "captured": 22, "totalTransactions": 40, "percentage": 55 }
    ]
  },
  "ois": {
    "storeTotal": 156,
    "target": 200,
    "rag": "amber",
    "trend": "↑",
    "delta": 28,
    "leaderboard": [
      { "rank": 1, "name": "James", "captured": 0, "totalTransactions": 0, "percentage": 0, "revenue": 68 },
      { "rank": 2, "name": "Sarah", "captured": 0, "totalTransactions": 0, "percentage": 0, "revenue": 45 },
      { "rank": 3, "name": "Tom", "captured": 0, "totalTransactions": 0, "percentage": 0, "revenue": 28 },
      { "rank": 4, "name": "Priya", "captured": 0, "totalTransactions": 0, "percentage": 0, "revenue": 15 }
    ]
  },
  "topPerformers": ["Sarah"]
}
```

---

### Stream 4 — Week-on-Week Trend Charts

**Purpose:** Chart components showing performance across all weeks in the period.

**Tasks:**
- Recharts-based line or bar chart component
- One chart per KPI (3 total), or a combined view with tabs
- X-axis: week numbers in the period
- Y-axis: KPI value (count for CNL, % for Digital, £ for OIS)
- Target reference line (horizontal dashed line)
- Data points labelled with actual values
- Responsive: readable on mobile (consider horizontal scroll or simplified mobile view)
- Consistent colour theming
- These chart components will be reused by Stream 6 (infographic), so design them to be renderable both on-screen and inside a capturable container

**Mock trend data:**
```json
{
  "weeks": [44, 45, 46],
  "cnlValues": [12, 14, 18],
  "digitalValues": [68, 77, 74],
  "oisValues": [95, 128, 156],
  "cnlTarget": 25,
  "digitalTarget": 80,
  "oisTarget": 200
}
```

---

### Stream 5 — WhatsApp Message Generator

**Purpose:** Generate, preview, edit, and copy a formatted WhatsApp message.

**Tasks:**
- Template engine that takes ComputedKPIs and produces a WhatsApp-formatted string
- WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```monospace```
- Message structure:

```
📊 *Customer KPI Update — Week {weekNumber}*

🆕 *Club New Look:* {signUps}/{target} sign-ups {trend}
{encouragement based on performance}

📧 *Digital Receipts:* {storePercentage}% (target {target}%) {trend}
{encouragement}
🏆 Top: {topName} — {topPercentage}%

🛒 *Order in Store:* £{storeTotal}/£{target} {trend}
{encouragement}
🏆 Top: {topName} — £{topRevenue}

⭐ *Player of the Week:* {topPerformer}

{closing encouragement} 🔥
```

- Auto-generated encouragement logic:
  - At/above target → positive reinforcement ("Smashed it!", "Amazing work!")
  - 80–99% of target → motivational ("Almost there!", "Just {n} more to go!")
  - Below 80% → coaching nudge ("Let's focus on asking every customer", "Remember to offer OIS")
- Editable textarea showing the generated message (manager can tweak before copying)
- "Copy to Clipboard" button using navigator.clipboard.writeText()
- Visual confirmation on copy (e.g. button text changes to "Copied ✓" for 2 seconds)
- Trend indicators should be omittable based on settings toggle

---

### Stream 6 — Infographic / Image Generator

**Purpose:** Generate a downloadable PNG infographic for WhatsApp sharing.

**Tasks:**
- Build a hidden or visible HTML container styled as the infographic
- Portrait orientation optimised for mobile viewing (roughly 1080×1920 or similar aspect ratio)
- Content sections:
  1. Header: "Customer KPI Update — Week {n} | {periodName}"
  2. Three KPI cards (CNL, Digital, OIS) with progress indicators and RAG colours
  3. Digital Receipts leaderboard (table)
  4. OIS leaderboard (table)
  5. Week-on-week trend mini-charts (reuse Stream 4 chart components)
  6. Top Performer highlight
- High contrast, readable at small sizes (WhatsApp compresses images)
- Use html2canvas or dom-to-image to convert the HTML container to PNG
- "Download Infographic" button triggers the PNG download
- Ensure fonts render correctly in the canvas capture

---

## Integration Points

```
Stream 1 (Data Layer) ──→ Stream 2 (Calc Engine) ──→ Streams 3, 4, 5, 6
                                                          ↑
                                                     Mock data interface
                                                     (use during parallel dev)
```

- Streams 3–6 should all consume a shared `ComputedKPIs` and `TrendData` interface
- During development, each stream can import mock data directly
- Stream 1 exposes a React context or hook: `useAppData()` → returns raw `WeekData[]`
- Stream 2 exposes a hook: `useComputedKPIs(weekNumber?)` → returns `ComputedKPIs`
- Stream 2 exposes: `useTrendData()` → returns `TrendData`
- Stream 4's chart components are imported by Stream 6 for the infographic

---

## Settings & Defaults

| Setting | Default | Stored in |
|---------|---------|-----------|
| CNL weekly target | 25 | localStorage |
| Digital Receipt target | 80% | localStorage |
| OIS weekly target | £200 | localStorage |
| Trend indicators | On | localStorage |
| Period config | Must be set by user | localStorage |
| Column mappings | Set on first upload | localStorage |

---

## File Structure (suggested)

```
src/
├── components/
│   ├── dashboard/
│   │   ├── KPICard.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── TopPerformer.tsx
│   │   └── Dashboard.tsx
│   ├── charts/
│   │   └── TrendChart.tsx
│   ├── upload/
│   │   ├── FileUpload.tsx
│   │   └── ColumnMapper.tsx
│   ├── whatsapp/
│   │   └── MessageGenerator.tsx
│   ├── infographic/
│   │   └── InfographicExport.tsx
│   ├── settings/
│   │   └── Settings.tsx
│   └── layout/
│       ├── Navigation.tsx
│       └── AppLayout.tsx
├── hooks/
│   ├── useAppData.ts
│   ├── useComputedKPIs.ts
│   ├── useTrendData.ts
│   └── useLocalStorage.ts
├── engine/
│   ├── calculations.ts
│   ├── messageTemplate.ts
│   └── ragStatus.ts
├── parsers/
│   ├── csvParser.ts
│   └── excelParser.ts
├── types/
│   └── index.ts
├── mock/
│   └── mockData.ts
├── App.tsx
└── main.tsx
```

---

## Key Design Decisions

1. **No backend** — everything runs client-side. Static hosting only.
2. **No auth** — no sensitive data stored. Future PowerBI integration would add OAuth.
3. **Local storage only** — period data accumulates in browser. JSON export/import for backup.
4. **Mobile-first** — primary use case is manager on phone generating update before/during shift.
5. **British English throughout** — "colour" not "color" in UI copy, £ not $, etc.
6. **WhatsApp-compatible formatting** — use WhatsApp markdown (*bold*, _italic_), no HTML.
