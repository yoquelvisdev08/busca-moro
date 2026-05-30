import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { TrendIndicator, type TrendDirection } from "./TrendIndicator"
import { Sparkline } from "./Sparkline"

export type MetricCardVariant = "default" | "highlighted"

export interface MetricCardProps extends React.ComponentProps<"div"> {
  label: string
  value: string | number
  formattedValue: string
  icon?: React.ReactNode
  trend?: {
    direction: TrendDirection
    value: number
  }
  sparklineData?: number[]
  variant?: MetricCardVariant
}

function MetricCard({
  label,
  value: _value,
  formattedValue,
  icon,
  trend,
  sparklineData,
  variant = "default",
  className,
  ...props
}: MetricCardProps) {
  const isHighlighted = variant === "highlighted"

  return (
    <Card
      data-slot="metric-card"
      data-variant={variant}
      size="default"
      className={cn(
        "min-w-[180px]",
        isHighlighted && "card-glow border-primary-container/30",
        className
      )}
      {...props}
    >
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-xs text-text-muted font-mono uppercase tracking-wider block truncate">
            {label}
          </span>
        </div>
        {icon && (
          <span className="shrink-0 text-text-muted [&>svg]:size-4">
            {icon}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <span
            className={cn(
              "text-2xl font-headline font-semibold tabular-nums text-text",
              isHighlighted && "text-primary"
            )}
          >
            {formattedValue}
          </span>
          {trend && (
            <TrendIndicator
              direction={trend.direction}
              value={trend.value}
              size="sm"
            />
          )}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-2">
            <Sparkline
              data={sparklineData}
              width={80}
              height={32}
              areaFill
              strokeWidth={1.5}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { MetricCard }
