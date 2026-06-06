import * as React from "react"
import { cn } from "@/lib/utils"

export type StatusLEDVariant = "success" | "warning" | "danger" | "info" | "neutral"
export type StatusLEDSize = "sm" | "md" | "lg"

const sizeMap: Record<StatusLEDSize, string> = {
  sm: "size-[6px]",
  md: "size-2",
  lg: "size-[10px]",
}

const variantColorMap: Record<StatusLEDVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-text-dim",
}

const variantGlowMap: Record<StatusLEDVariant, string> = {
  success: "shadow-[0_0_4px_var(--sx-success)]",
  warning: "shadow-[0_0_4px_var(--sx-warning)]",
  danger: "shadow-[0_0_4px_var(--sx-danger)]",
  info: "shadow-[0_0_4px_var(--sx-info)]",
  neutral: "",
}

export interface StatusLEDProps extends React.ComponentProps<"span"> {
  variant?: StatusLEDVariant
  size?: StatusLEDSize
  pulse?: boolean
  label?: string
}

function StatusLED({
  variant = "success",
  size = "md",
  pulse = false,
  label,
  className,
  ...props
}: StatusLEDProps) {
  const dot = (
    <span
      role="status"
      aria-label={label ?? `${variant} status`}
      data-slot="status-led"
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-block shrink-0 rounded-full",
        sizeMap[size],
        variantColorMap[variant],
        variantGlowMap[variant],
        pulse && "animate-pulse-glow",
        className
      )}
      {...props}
    />
  )

  if (label) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {dot}
        <span className="text-xs text-text-secondary font-medium">{label}</span>
      </span>
    )
  }

  return dot
}

export { StatusLED }
