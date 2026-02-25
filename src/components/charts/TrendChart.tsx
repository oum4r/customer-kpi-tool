import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

export interface TrendChartProps {
  title: string;
  weeks: number[];
  values: number[];
  target: number;
  unit: string;
  colour?: string;
  height?: number;
  compact?: boolean;
}

interface ChartDatum {
  week: string;
  value: number;
}

/**
 * Formats a numeric value with the appropriate unit prefix/suffix.
 * '' -> plain number, '%' -> number%, '£' -> £number
 */
function formatValue(value: number, unit: string): string {
  if (unit === '£') return `£${value}`;
  if (unit === '%') return `${value}%`;
  return String(value);
}

/**
 * Custom label renderer used by LabelList to display data values above each dot.
 */
function renderDataLabel(props: {
  x?: number;
  y?: number;
  value?: number;
  index?: number;
  unit: string;
  compact: boolean;
}) {
  const { x, y, value, unit, compact } = props;
  if (x == null || y == null || value == null) return null;

  return (
    <text
      x={x}
      y={y - (compact ? 8 : 12)}
      textAnchor="middle"
      fill="#374151"
      fontSize={compact ? 9 : 12}
      fontWeight={500}
    >
      {formatValue(value, unit)}
    </text>
  );
}

export function TrendChart({
  title,
  weeks,
  values,
  target,
  unit,
  colour = '#3b82f6',
  height,
  compact = false,
}: TrendChartProps) {
  const chartData: ChartDatum[] = weeks.map((week, i) => ({
    week: `Wk ${week}`,
    value: values[i],
  }));

  const manyWeeks = weeks.length > 8;

  // --- Compact mode: fixed-size chart for infographic / html2canvas capture ---
  if (compact) {
    const w = 320;
    const h = height ?? 180;

    return (
      <div style={{ width: w, height: h }}>
        <LineChart
          width={w}
          height={h}
          data={chartData}
          margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
        >
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={false}
            angle={manyWeeks ? -35 : 0}
            textAnchor={manyWeeks ? 'end' : 'middle'}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatValue(v, unit)}
          />
          <ReferenceLine
            y={target}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            label={{
              value: 'Target',
              position: 'right',
              fill: '#9ca3af',
              fontSize: 9,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colour}
            strokeWidth={2}
            dot={{ r: 4, fill: colour, stroke: colour }}
            activeDot={false}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              content={(labelProps) =>
                renderDataLabel({
                  ...labelProps,
                  unit,
                  compact: true,
                } as Parameters<typeof renderDataLabel>[0])
              }
            />
          </Line>
        </LineChart>
      </div>
    );
  }

  // --- Normal mode: responsive chart wrapped in a card ---
  const chartHeight = height ?? 300;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 40, bottom: 20, left: 20 }}
        >
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="#f3f4f6"
          />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={false}
            label={{
              value: 'Week',
              position: 'insideBottomRight',
              offset: -10,
              fill: '#9ca3af',
              fontSize: 11,
            }}
            angle={manyWeeks ? -35 : 0}
            textAnchor={manyWeeks ? 'end' : 'middle'}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatValue(v, unit)}
          />
          <Tooltip
            formatter={(value: number) => [formatValue(value, unit), 'Value'] as [string, string]}
            labelFormatter={(label: string) => `${label}`}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
          />
          <ReferenceLine
            y={target}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            label={{
              value: 'Target',
              position: 'right',
              fill: '#9ca3af',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colour}
            strokeWidth={2}
            dot={{ r: 6, fill: colour, stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 8, fill: colour, stroke: '#fff', strokeWidth: 2 }}
          >
            <LabelList
              dataKey="value"
              content={(labelProps) =>
                renderDataLabel({
                  ...labelProps,
                  unit,
                  compact: false,
                } as Parameters<typeof renderDataLabel>[0])
              }
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
