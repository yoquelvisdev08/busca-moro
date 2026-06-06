import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusLEDVariant = "success" | "warning" | "danger" | "info" | "neutral";
export type StatusLEDSize = "sm" | "md" | "lg";

const sizeMap: Record<StatusLEDSize, string> = {
  sm: "size-[6px]",
  md: "size-2",
  lg: "size-[10px]",
};

const variantColorMap: Record<StatusLEDVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-text-dim",
};

export interface StatusLEDProps extends React.ComponentProps<"span"> {
  variant?: StatusLEDVariant;
  size?: StatusLEDSize;
  pulse?: boolean;
}

export function StatusLED({
  variant = "success",
  size = "md",
  pulse = false,
  className,
  ...props
}: StatusLEDProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-block shrink-0 rounded-full",
        sizeMap[size],
        variantColorMap[variant],
        pulse && "animate-pulse-glow",
        className,
      )}
      {...props}
    />
  );
}
