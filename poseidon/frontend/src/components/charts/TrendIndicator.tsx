import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrendDirection = "up" | "down" | "neutral";

export interface TrendIndicatorProps extends React.ComponentProps<"span"> {
  direction: TrendDirection;
  value: number;
  size?: "sm" | "md";
}

const directionConfig = {
  up: { icon: TrendingUp, colorClass: "text-success" },
  down: { icon: TrendingDown, colorClass: "text-danger" },
  neutral: { icon: Minus, colorClass: "text-text-dim" },
} as const;

export function TrendIndicator({
  direction,
  value,
  size = "sm",
  className,
  ...props
}: TrendIndicatorProps) {
  const { icon: Icon, colorClass } = directionConfig[direction];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono font-medium text-[10px]",
        colorClass,
        className,
      )}
      {...props}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "size-3" : "size-3.5")} aria-hidden />
      <span>{value.toFixed(1)}%</span>
    </span>
  );
}
