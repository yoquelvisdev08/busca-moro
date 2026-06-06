import * as React from "react"
import { cn } from "@/lib/utils"
import { chartColors } from "@/styles/design-tokens"

export interface SparklineProps extends React.ComponentProps<"svg"> {
  data: number[]
  width?: number
  height?: number
  strokeColor?: string
  strokeWidth?: number
  fillOpacity?: number
  /** If true, fills the area under the line with a gradient */
  areaFill?: boolean
}

function toSvgPath(data: number[], width: number, height: number, min: number, max: number): string {
  if (data.length === 0) return ""
  if (data.length === 1) {
    const y = height - ((data[0] - min) / (max - min || 1)) * (height - 2) - 1
    return `M 0,${y} L ${width},${y}`
  }

  const range = max - min || 1
  const step = width / (data.length - 1)

  return data
    .map((value, i) => {
      const x = i * step
      const y = height - ((value - min) / range) * (height - 2) - 1
      return `${i === 0 ? "M" : "L"} ${x},${y}`
    })
    .join(" ")
}

function Sparkline({
  data,
  width = 80,
  height = 32,
  strokeColor = chartColors.primary,
  strokeWidth = 1.5,
  fillOpacity = 0.15,
  areaFill = false,
  className,
  ...props
}: SparklineProps) {
  const gradientId = React.useId()
  const min = Math.min(...data)
  const max = Math.max(...data)
  const linePath = toSvgPath(data, width, height, min, max)
  const areaPath = linePath + ` L ${width},${height} L 0,${height} Z`

  return (
    <svg
      data-slot="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("overflow-visible", className)}
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={fillOpacity * 2} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {areaFill && (
        <path d={areaPath} fill={`url(#${gradientId})`} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export { Sparkline, chartColors }
