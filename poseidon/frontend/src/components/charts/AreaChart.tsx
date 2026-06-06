import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartWrapper } from "./ChartWrapper";

export interface AreaChartSeries {
  dataKey: string;
  name?: string;
  color?: string;
}

export interface AreaChartProps {
  data: Record<string, unknown>[];
  series: AreaChartSeries[];
  xAxisKey?: string;
  title?: string;
  description?: string;
  loading?: boolean;
  height?: number;
  className?: string;
}

export function AreaChart({
  data,
  series,
  xAxisKey = "name",
  title,
  description,
  loading = false,
  height = 280,
  className,
}: AreaChartProps) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      loading={loading}
      className={className}
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsAreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              {series.map((s, i) => {
                const color = s.color ?? "#22d3ee";
                return (
                  <linearGradient
                    key={`gradient-${s.dataKey}-${i}`}
                    id={`areaGradient-${s.dataKey}-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} vertical={false} />
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 12, fill: "#958ea0" }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#958ea0" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--sx-surface-high)",
                border: "1px solid var(--sx-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {series.map((s, i) => {
              const color = s.color ?? "#22d3ee";
              return (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name ?? s.dataKey}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#areaGradient-${s.dataKey}-${i})`}
                  dot={false}
                />
              );
            })}
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}
