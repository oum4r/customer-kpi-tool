import { useRef, useState, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { useComputedKPIs } from '../../hooks/useComputedKPIs';
import { useTrendData } from '../../hooks/useTrendData';
import { TrendChart } from '../charts/TrendChart';
import { ragToColour } from '../../engine/ragStatus';
import type { ComputedKPIs, TrendData, RAGStatus } from '../../types';

// ============================================================
// Constants
// ============================================================

const PORTRAIT_W = 1080;
const PORTRAIT_H = 1920;
const LANDSCAPE_W = 1920;
const LANDSCAPE_H = 1080;
const FONT_FAMILY = "'Segoe UI', Arial, sans-serif";

type InfographicFormat = 'portrait' | 'landscape';

// ============================================================
// Helper Components (inline-styled for html2canvas reliability)
// ============================================================

function ProgressBar({ percentage, colour }: { percentage: number; colour: string }) {
  return (
    <div style={{ width: '100%', height: 12, backgroundColor: '#e5e7eb', borderRadius: 6 }}>
      <div
        style={{
          width: `${Math.min(percentage, 100)}%`,
          height: '100%',
          backgroundColor: colour,
          borderRadius: 6,
        }}
      />
    </div>
  );
}

function TrendArrow({ trend, delta }: { trend: string | null; delta: number | null }) {
  if (!trend) return null;

  const colour =
    trend === '\u2191' ? '#22c55e' : trend === '\u2193' ? '#ef4444' : '#6b7280';

  return (
    <span style={{ fontSize: 16, fontWeight: 600, color: colour, marginLeft: 6 }}>
      {trend}
      {delta != null && (
        <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
    </span>
  );
}

// ============================================================
// Section builders (pure inline styles)
// ============================================================

function HeaderSection({ weekNumber, periodName, slim }: { weekNumber: number; periodName: string; slim?: boolean }) {
  return (
    <div
      style={{
        backgroundColor: '#1e3a5f',
        color: '#ffffff',
        padding: slim ? '18px 32px 14px' : '40px 48px 32px',
        textAlign: 'center',
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ fontSize: slim ? 28 : 38, fontWeight: 700, letterSpacing: 0.5 }}>
        Customer KPI Update
      </div>
      <div style={{ fontSize: slim ? 17 : 22, fontWeight: 400, marginTop: slim ? 4 : 8, opacity: 0.9 }}>
        Week {weekNumber} | {periodName}
      </div>
    </div>
  );
}

function KPICard({
  title,
  valueLabel,
  percentage,
  rag,
  trend,
  delta,
}: {
  title: string;
  valueLabel: string;
  percentage: number;
  rag: RAGStatus;
  trend: string | null;
  delta: number | null;
}) {
  const colour = ragToColour(rag);

  return (
    <div
      style={{
        flex: '1 1 0',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '20px 16px',
        textAlign: 'center',
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: colour, marginBottom: 4 }}>
        {valueLabel}
        <TrendArrow trend={trend} delta={delta} />
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
        {Math.round(percentage)}% of target
      </div>
      <ProgressBar percentage={percentage} colour={colour} />
    </div>
  );
}

function KPICardsSection({ kpis }: { kpis: ComputedKPIs }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '24px 32px',
        fontFamily: FONT_FAMILY,
      }}
    >
      <KPICard
        title="CNL Sign-Ups"
        valueLabel={`${kpis.cnl.signUps}/${kpis.cnl.target}`}
        percentage={kpis.cnl.percentage}
        rag={kpis.cnl.rag}
        trend={kpis.cnl.trend}
        delta={kpis.cnl.delta}
      />
      <KPICard
        title="Digital Receipts"
        valueLabel={`${Math.round(kpis.digitalReceipts.storePercentage)}%`}
        percentage={
          kpis.digitalReceipts.target > 0
            ? (kpis.digitalReceipts.storePercentage / kpis.digitalReceipts.target) * 100
            : 0
        }
        rag={kpis.digitalReceipts.rag}
        trend={kpis.digitalReceipts.trend}
        delta={kpis.digitalReceipts.delta}
      />
      <KPICard
        title="OIS Revenue"
        valueLabel={`£${kpis.ois.storeTotal}/£${kpis.ois.target}`}
        percentage={
          kpis.ois.target > 0 ? (kpis.ois.storeTotal / kpis.ois.target) * 100 : 0
        }
        rag={kpis.ois.rag}
        trend={kpis.ois.trend}
        delta={kpis.ois.delta}
      />
    </div>
  );
}

function SectionTitle({ children, fontSize }: { children: React.ReactNode; fontSize?: number }) {
  return (
    <div
      style={{
        fontSize: fontSize ?? 18,
        fontWeight: 700,
        color: '#1e3a5f',
        padding: '0 32px',
        marginBottom: 8,
        fontFamily: FONT_FAMILY,
      }}
    >
      {children}
    </div>
  );
}

function DigitalReceiptsLeaderboard({ kpis }: { kpis: ComputedKPIs }) {
  const entries = kpis.digitalReceipts.leaderboard;
  if (entries.length === 0) return null;

  const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    borderBottom: '2px solid #d1d5db',
    fontFamily: FONT_FAMILY,
  };

  const tdStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 13,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
    fontFamily: FONT_FAMILY,
  };

  return (
    <div style={{ padding: '0 32px 16px' }}>
      <SectionTitle>Digital Receipts Leaderboard</SectionTitle>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          fontFamily: FONT_FAMILY,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Rank</th>
            <th style={thStyle}>Name</th>
            <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>Captured</th>
            <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>Total</th>
            <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isMgmt = entry.isManagement;
            const isTop = !isMgmt && entry.rank === 1;
            const rowBg = isMgmt ? '#f3f4f6' : isTop ? '#fef3c7' : 'transparent';
            const textColour = isMgmt ? '#9ca3af' : '#374151';
            return (
              <tr key={entry.name} style={{ backgroundColor: rowBg }}>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: isTop ? 700 : 400, color: textColour, fontStyle: isMgmt ? 'italic' : 'normal' }}>
                  {isMgmt ? 'Mgmt' : (<>{isTop ? '\u2b50 ' : ''}{entry.rank}</>)}
                </td>
                <td style={{ ...tdStyle, fontWeight: isTop ? 600 : 400, color: textColour, fontStyle: isMgmt ? 'italic' : 'normal' }}>
                  {entry.name}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: textColour }}>{entry.captured}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: textColour }}>{entry.totalTransactions}</td>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: textColour }}>
                  {Math.round(entry.percentage)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OISLeaderboard({ kpis }: { kpis: ComputedKPIs }) {
  const entries = kpis.ois.leaderboard;
  if (entries.length === 0) return null;

  const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    borderBottom: '2px solid #d1d5db',
    fontFamily: FONT_FAMILY,
  };

  const tdStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 13,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
    fontFamily: FONT_FAMILY,
  };

  return (
    <div style={{ padding: '0 32px 16px' }}>
      <SectionTitle>OIS Leaderboard</SectionTitle>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          fontFamily: FONT_FAMILY,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Rank</th>
            <th style={thStyle}>Name</th>
            <th style={{ ...thStyle, width: 110, textAlign: 'right' }}>Revenue (£)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isMgmt = entry.isManagement;
            const isTop = !isMgmt && entry.rank === 1;
            const rowBg = isMgmt ? '#f3f4f6' : isTop ? '#fef3c7' : 'transparent';
            const textColour = isMgmt ? '#9ca3af' : '#374151';
            return (
              <tr key={entry.name} style={{ backgroundColor: rowBg }}>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: isTop ? 700 : 400, color: textColour, fontStyle: isMgmt ? 'italic' : 'normal' }}>
                  {isMgmt ? 'Mgmt' : (<>{isTop ? '\u2b50 ' : ''}{entry.rank}</>)}
                </td>
                <td style={{ ...tdStyle, fontWeight: isTop ? 600 : 400, color: textColour, fontStyle: isMgmt ? 'italic' : 'normal' }}>
                  {entry.name}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: textColour }}>
                  £{entry.revenue.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TrendChartsSection({ trendData }: { trendData: TrendData }) {
  return (
    <div style={{ padding: '8px 32px 16px' }}>
      <SectionTitle>Trends</SectionTitle>
      <div
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#3b82f6',
              marginBottom: 4,
              textAlign: 'center',
              fontFamily: FONT_FAMILY,
            }}
          >
            CNL Sign-Ups
          </div>
          <TrendChart
            title="CNL"
            weeks={trendData.weeks}
            values={trendData.cnlValues}
            target={trendData.cnlTarget}
            colour="#3b82f6"
            unit=""
            compact
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#8b5cf6',
              marginBottom: 4,
              textAlign: 'center',
              fontFamily: FONT_FAMILY,
            }}
          >
            Digital Receipts
          </div>
          <TrendChart
            title="Digital Receipts"
            weeks={trendData.weeks}
            values={trendData.digitalValues}
            target={trendData.digitalTarget}
            colour="#8b5cf6"
            unit="%"
            compact
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#10b981',
              marginBottom: 4,
              textAlign: 'center',
              fontFamily: FONT_FAMILY,
            }}
          >
            OIS Revenue
          </div>
          <TrendChart
            title="OIS"
            weeks={trendData.weeks}
            values={trendData.oisValues}
            target={trendData.oisTarget}
            colour="#10b981"
            unit="£"
            compact
          />
        </div>
      </div>
    </div>
  );
}

/** Landscape variant: 3 trend charts stacked vertically */
function TrendChartsSectionVertical({ trendData }: { trendData: TrendData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 0' }}>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#3b82f6',
            marginBottom: 2,
            textAlign: 'center',
            fontFamily: FONT_FAMILY,
          }}
        >
          CNL Sign-Ups
        </div>
        <TrendChart
          title="CNL"
          weeks={trendData.weeks}
          values={trendData.cnlValues}
          target={trendData.cnlTarget}
          colour="#3b82f6"
          unit=""
          compact
        />
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#8b5cf6',
            marginBottom: 2,
            textAlign: 'center',
            fontFamily: FONT_FAMILY,
          }}
        >
          Digital Receipts
        </div>
        <TrendChart
          title="Digital Receipts"
          weeks={trendData.weeks}
          values={trendData.digitalValues}
          target={trendData.digitalTarget}
          colour="#8b5cf6"
          unit="%"
          compact
        />
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#10b981',
            marginBottom: 2,
            textAlign: 'center',
            fontFamily: FONT_FAMILY,
          }}
        >
          OIS Revenue
        </div>
        <TrendChart
          title="OIS"
          weeks={trendData.weeks}
          values={trendData.oisValues}
          target={trendData.oisTarget}
          colour="#10b981"
          unit="£"
          compact
        />
      </div>
    </div>
  );
}

function TopPerformerSection({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  return (
    <div style={{ padding: '0 32px 16px' }}>
      <div
        style={{
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: 12,
          padding: '20px 24px',
          textAlign: 'center',
          fontFamily: FONT_FAMILY,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 4 }}>{'\u2b50'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
          KPI Hero of the Week
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#78350f' }}>
          {names.join(' & ')}
        </div>
      </div>
    </div>
  );
}

/** Compact KPI Hero for landscape right column */
function TopPerformerSectionCompact({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  return (
    <div style={{ padding: '8px 0 0' }}>
      <div
        style={{
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: 10,
          padding: '12px 16px',
          textAlign: 'center',
          fontFamily: FONT_FAMILY,
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 2 }}>{'\u2b50'}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>
          KPI Hero of the Week
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#78350f' }}>
          {names.join(' & ')}
        </div>
      </div>
    </div>
  );
}

function FooterSection() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      style={{
        padding: '16px 32px 24px',
        textAlign: 'center',
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        Generated with Customer KPI Tool &middot; {dateStr}
      </div>
    </div>
  );
}

// ============================================================
// Portrait Canvas (original layout at 1080x1920)
// ============================================================

function PortraitCanvas({
  kpis,
  trendData,
}: {
  kpis: ComputedKPIs;
  trendData: TrendData | null;
}) {
  return (
    <div
      style={{
        width: PORTRAIT_W,
        height: PORTRAIT_H,
        backgroundColor: '#f9fafb',
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Section 1 — Header */}
      <HeaderSection weekNumber={kpis.weekNumber} periodName={kpis.periodName} />

      {/* Section 2 — KPI Cards */}
      <KPICardsSection kpis={kpis} />

      {/* Section 3 — Digital Receipts Leaderboard */}
      <DigitalReceiptsLeaderboard kpis={kpis} />

      {/* Section 4 — OIS Leaderboard */}
      <OISLeaderboard kpis={kpis} />

      {/* Section 5 — Trend Mini-Charts */}
      {trendData && <TrendChartsSection trendData={trendData} />}

      {/* Section 6 — Top Performer */}
      <TopPerformerSection names={kpis.topPerformers} />

      {/* Spacer to push footer down */}
      <div style={{ flex: 1 }} />

      {/* Section 7 — Footer */}
      <FooterSection />
    </div>
  );
}

// ============================================================
// Landscape Canvas (new layout at 1920x1080)
// ============================================================

function LandscapeCanvas({
  kpis,
  trendData,
}: {
  kpis: ComputedKPIs;
  trendData: TrendData | null;
}) {
  return (
    <div
      style={{
        width: LANDSCAPE_W,
        height: LANDSCAPE_H,
        backgroundColor: '#f9fafb',
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header — slim variant */}
      <HeaderSection weekNumber={kpis.weekNumber} periodName={kpis.periodName} slim />

      {/* Row 1: KPI Cards (left) + Trend Charts (right) */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '16px 32px 8px',
          alignItems: 'stretch',
        }}
      >
        {/* Left: KPI Cards stacked in a column within a row */}
        <div style={{ flex: '1 1 0', display: 'flex', gap: 12 }}>
          <KPICard
            title="CNL Sign-Ups"
            valueLabel={`${kpis.cnl.signUps}/${kpis.cnl.target}`}
            percentage={kpis.cnl.percentage}
            rag={kpis.cnl.rag}
            trend={kpis.cnl.trend}
            delta={kpis.cnl.delta}
          />
          <KPICard
            title="Digital Receipts"
            valueLabel={`${Math.round(kpis.digitalReceipts.storePercentage)}%`}
            percentage={
              kpis.digitalReceipts.target > 0
                ? (kpis.digitalReceipts.storePercentage / kpis.digitalReceipts.target) * 100
                : 0
            }
            rag={kpis.digitalReceipts.rag}
            trend={kpis.digitalReceipts.trend}
            delta={kpis.digitalReceipts.delta}
          />
          <KPICard
            title="OIS Revenue"
            valueLabel={`£${kpis.ois.storeTotal}/£${kpis.ois.target}`}
            percentage={
              kpis.ois.target > 0 ? (kpis.ois.storeTotal / kpis.ois.target) * 100 : 0
            }
            rag={kpis.ois.rag}
            trend={kpis.ois.trend}
            delta={kpis.ois.delta}
          />
        </div>

        {/* Right: Trend charts stacked vertically */}
        {trendData && <TrendChartsSectionVertical trendData={trendData} />}
      </div>

      {/* Row 2: Leaderboards side-by-side */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '8px 0 0',
          flex: 1,
          minHeight: 0,
          alignItems: 'flex-start',
        }}
      >
        {/* Left column: Digital Receipts Leaderboard */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <DigitalReceiptsLeaderboard kpis={kpis} />
        </div>

        {/* Right column: OIS Leaderboard + KPI Hero below */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <OISLeaderboard kpis={kpis} />
          <div style={{ padding: '0 32px' }}>
            <TopPerformerSectionCompact names={kpis.topPerformers} />
          </div>
        </div>
      </div>

      {/* Spacer to push footer down */}
      <div style={{ flex: '0 0 auto' }} />

      {/* Footer */}
      <FooterSection />
    </div>
  );
}

// ============================================================
// Main Export Component
// ============================================================

export function InfographicExport() {
  const kpis = useComputedKPIs();
  const trendData = useTrendData();

  const containerRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.35);
  const [format, setFormat] = useState<InfographicFormat>('portrait');

  const canvasW = format === 'portrait' ? PORTRAIT_W : LANDSCAPE_W;
  const canvasH = format === 'portrait' ? PORTRAIT_H : LANDSCAPE_H;

  // ---- Responsive preview scale ----
  const updateScale = useCallback(() => {
    const wrapper = previewWrapperRef.current;
    if (!wrapper) return;
    const availableW = wrapper.clientWidth;
    const w = format === 'portrait' ? PORTRAIT_W : LANDSCAPE_W;
    const scale = Math.min(0.65, Math.max(0.25, availableW / w));
    setPreviewScale(scale);
  }, [format]);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // ---- Download handler ----
  const handleDownload = async () => {
    const container = containerRef.current;
    if (!container) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: canvasW,
        height: canvasH,
      });

      const link = document.createElement('a');
      link.download = `kpi-update-week-${kpis?.weekNumber ?? 'unknown'}-${format}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Infographic generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---- No data state ----
  if (!kpis) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-bold text-gray-900">Infographic</h1>
        <p className="text-sm text-gray-500">No data &mdash; upload to generate</p>
      </div>
    );
  }

  const previewW = canvasW * previewScale;
  const previewH = canvasH * previewScale;

  const CanvasComponent = format === 'portrait' ? PortraitCanvas : LandscapeCanvas;

  return (
    <div className="space-y-6 p-4" ref={previewWrapperRef}>
      <h1 className="text-xl font-bold text-gray-900">Infographic</h1>

      {/* Format toggle */}
      <div className="flex items-center justify-center gap-1 rounded-lg bg-gray-100 p-1 mx-auto max-w-xs">
        <button
          type="button"
          onClick={() => setFormat('portrait')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            format === 'portrait'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {'\ud83d\udcf1'} Mobile
        </button>
        <button
          type="button"
          onClick={() => setFormat('landscape')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            format === 'landscape'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {'\ud83d\udda5\ufe0f'} Desktop
        </button>
      </div>

      {/* On-screen preview (responsively scaled) */}
      <div
        className="mx-auto rounded-lg border border-gray-200 bg-gray-100"
        style={{
          width: previewW,
          height: previewH,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `scale(${previewScale})`,
            transformOrigin: 'top left',
            width: canvasW,
            height: canvasH,
          }}
        >
          <CanvasComponent kpis={kpis} trendData={trendData} />
        </div>
      </div>

      {/* Download button */}
      <div className="mx-auto" style={{ maxWidth: previewW }}>
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating&hellip;
            </span>
          ) : (
            'Download Infographic'
          )}
        </button>
      </div>

      {/* Hidden capture container (off-screen, full resolution) */}
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          width: canvasW,
          height: canvasH,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <CanvasComponent kpis={kpis} trendData={trendData} />
      </div>
    </div>
  );
}
