import React from "react";
import { colors, radii } from "@/design-system/tokens";

export interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  padding?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ children, hover = false, padding = "20px", style, className }: CardProps) {
  const baseStyle: React.CSSProperties = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    padding,
    transition: "border-color 150ms ease, background 150ms ease",
    ...style,
  };

  return (
    <div
      className={className}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (hover) e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.5)";
      }}
      onMouseLeave={(e) => {
        if (hover) e.currentTarget.style.borderColor = colors.border;
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bg,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: "16px", ...style }}>{children}</div>;
}

export function CardFooter({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: `1px solid ${colors.border}`,
        background: colors.bg,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
