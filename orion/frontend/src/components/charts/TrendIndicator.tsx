import * as React from "react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export type TrendDirection = "up" | "down" | "neutral"
export type TrendIndicatorSize = "sm" | "md" | "lg"

export interface TrendIndicatorProps extends React.ComponentProps<"span"> {
  direction: TrendDirection
  value: number
  size?: TrendIndicatorSize
  /** Whether to show the percentage text */
  showValue?: boolean
}

const directionConfig: Record<TrendDirection, {
  icon: React.ElementType
  colorClass: string
  label: string
}> = {
  up: { icon: TrendingUp, colorClass: "text-success", label: "increasing" },
  down: { icon: TrendingDown, colorClass: "text-danger", label: "decreasing" },
  neutral: { icon: Minus, colorClass: "text-text-dim", label: "neutral" },
}

const sizeConfig: Record<TrendIndicatorSize, { iconSize: string; textSize: string; gap: string }> = {
  sm: { iconSize: "size-3", textSize: "text-[10px]", gap: "gap-0.5" },
  md: { iconSize: "size-3.5", textSize: "text-xs", gap: "gap-1" },
  lg: { iconSize: "size-4", textSize: "text-sm", gap: "gap-1" },
}

function TrendIndicator({
  direction,
  value,
  size = "md",
  showValue = true,
  className,
  ...props
}: TrendIndicatorProps) {
  const { icon: Icon, colorClass, label } = directionConfig[direction]
  const sizes = sizeConfig[size]

  return (
    <span
      data-slot="trend-indicator"
      data-direction={direction}
      data-size={size}
      role="status"
      aria-label={`${label} by ${value}%`}
      className={cn(
        "inline-flex items-center font-mono font-medium",
        sizes.gap,
        sizes.textSize,
        colorClass,
        className
      )}
      {...props}
    >
      <Icon className={cn("shrink-0", sizes.iconSize)} aria-hidden="true" />
      {showValue && <span>{value.toFixed(1)}%</span>}
    </span>
  )
}

export { TrendIndicator }
