import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ChipVariant = "default" | "outline" | "solid"
export type ChipColor = "primary" | "secondary" | "success" | "warning" | "danger"

const variantColorMap: Record<ChipVariant, Record<ChipColor, string>> = {
  solid: {
    primary: "bg-primary-container text-white",
    secondary: "bg-secondary-container text-white",
    success: "bg-success text-white",
    warning: "bg-warning text-sx-bg",
    danger: "bg-danger text-white",
  },
  default: {
    primary: "bg-primary-soft text-primary border border-primary/20",
    secondary: "bg-secondary/10 text-secondary border border-secondary/20",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    danger: "bg-danger/10 text-danger border border-danger/20",
  },
  outline: {
    primary: "border border-primary text-primary bg-transparent",
    secondary: "border border-secondary text-secondary bg-transparent",
    success: "border border-success text-success bg-transparent",
    warning: "border border-warning text-warning bg-transparent",
    danger: "border border-danger text-danger bg-transparent",
  },
}

export interface ChipProps extends React.ComponentProps<"span"> {
  variant?: ChipVariant
  color?: ChipColor
  removable?: boolean
  onRemove?: () => void
  icon?: React.ReactNode
}

function Chip({
  variant = "default",
  color = "primary",
  removable = false,
  onRemove,
  icon,
  className,
  children,
  ...props
}: ChipProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && removable && onRemove) {
      e.preventDefault()
      onRemove()
    }
  }

  return (
    <span
      data-slot="chip"
      data-variant={variant}
      data-color={color}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap transition-all",
        variantColorMap[variant][color],
        className
      )}
      {...props}
    >
      {icon && <span className="flex shrink-0 items-center justify-center [&>svg]:size-3">{icon}</span>}
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          onKeyDown={handleKeyDown}
          aria-label={`Remove ${typeof children === "string" ? children : "item"}`}
          className={cn(
            "ml-0.5 flex shrink-0 items-center justify-center rounded-full p-px transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </span>
  )
}

export { Chip }
