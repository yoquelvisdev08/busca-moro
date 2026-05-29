import React from "react";
import { colors, radii } from "@/design-system/tokens";

export interface BadgeProps {
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  dot?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const variantConfig: Record<NonNullable<BadgeProps["variant"]>, { bg: string; color: string; border: string }> = {
  success: {
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#10b981",
    border: "rgba(16, 185, 129, 0.3)",
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#f59e0b",
    border: "rgba(245, 158, 11, 0.3)",
  },
  danger: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#ef4444",
    border: "rgba(239, 68, 68, 0.3)",
  },
  info: {
    bg: "rgba(139, 92, 246, 0.12)",
    color: colors.primaryContainer,
    border: "rgba(139, 92, 246, 0.3)",
  },
  neutral: {
    bg: "rgba(107, 114, 128, 0.1)",
    color: "#9ca3af",
    border: "rgba(107, 114, 128, 0.3)",
  },
};

export function Badge({ variant = "neutral", dot = false, children, style }: BadgeProps) {
  const cfg = variantConfig[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 10px",
        borderRadius: radii.full,
        fontSize: "12px",
        fontWeight: 500,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: cfg.color,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
