import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { chartColors } from "@/styles/design-tokens"
import { ChartWrapper } from "./ChartWrapper"

export interface AreaChartSeries {
  dataKey: string
  name?: string
  color?: string
  gradient?: boolean
}

export interface AreaChartProps {
  data: Record<string, unknown>[]
  series: AreaChartSeries[]
  xAxisKey?: string
  title?: string
  description?: string
  loading?: boolean
  error?: Error | null
  height?: number
  className?: string
  showGrid?: boolean
  showTooltip?: boolean
  /** Custom label formatter for Y axis */
  yAxisFormatter?: (value: number) => string
  /** Custom formatter for tooltip values */
  valueFormatter?: (value: number) => string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
  valueFormatter?: (value: number) => string
}

function CustomTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-surface-high px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1 font-mono">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="text-text font-mono tabular-nums">
            {valueFormatter ? valueFormatter(Number(entry.value)) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function defaultYFormatter(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function AreaChart({
  data,
  series,
  xAxisKey = "name",
  title,
  description,
  loading = false,
  error = null,
  height = 300,
  className,
  showGrid = true,
  showTooltip = true,
  yAxisFormatter = defaultYFormatter,
  valueFormatter = defaultYFormatter,
}: AreaChartProps) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      loading={loading}
      error={error}
      className={className}
    >
      <div style={{ width: "100%", height }} data-slot="area-chart">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsAreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <defs>
              {series.map((s, i) => {
                const color = s.color ?? chartColors.primary
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
                )
              })}
            </defs>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                strokeOpacity={0.4}
                vertical={false}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', fill: "#958ea0" }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', fill: "#958ea0" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={yAxisFormatter}
            />
            {showTooltip && (
              <Tooltip
                content={({ active, payload, label }) => (
                  <CustomTooltip
                    active={active}
                    payload={payload as unknown as CustomTooltipProps["payload"]}
                    label={String(label ?? "")}
                    valueFormatter={valueFormatter}
                  />
                )}
                wrapperStyle={{ outline: "none" }}
                cursor={{
                  stroke: "#334155",
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.6,
                }}
              />
            )}
            {series.map((s, i) => {
              const color = s.color ?? chartColors.primary
              return (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name ?? s.dataKey}
                  stroke={color}
                  strokeWidth={2}
                  fill={
                    s.gradient !== false
                      ? `url(#areaGradient-${s.dataKey}-${i})`
                      : "none"
                  }
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: color,
                    stroke: "#0b1326",
                    strokeWidth: 2,
                  }}
                />
              )
            })}
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  )
}

export { AreaChart }
