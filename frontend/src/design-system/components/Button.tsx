import React from "react";
import { Loader2 } from "lucide-react";
import { colors, radii } from "@/design-system/tokens";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
  primary: {
    background: colors.primaryContainer,
    color: "#fff",
    border: "1px solid transparent",
  },
  secondary: {
    background: "transparent",
    color: colors.textSecondary,
    border: `1px solid ${colors.borderStrong}`,
  },
  ghost: {
    background: "transparent",
    color: colors.textMuted,
    border: "1px solid transparent",
  },
  danger: {
    background: "rgba(239, 68, 68, 0.1)",
    color: colors.danger,
    border: "1px solid rgba(239, 68, 68, 0.3)",
  },
  warning: {
    background: "rgba(245, 158, 11, 0.1)",
    color: colors.warning,
    border: "1px solid rgba(245, 158, 11, 0.3)",
  },
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, React.CSSProperties> = {
  sm: { padding: "4px 12px", fontSize: "12px", height: "28px" },
  md: { padding: "8px 16px", fontSize: "14px", height: "36px" },
  lg: { padding: "12px 24px", fontSize: "16px", height: "44px" },
};

const hoverVariant: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
  primary: { background: "#4f46e5" },
  secondary: { background: colors.surface, color: colors.text, borderColor: colors.borderStrong },
  ghost: { background: colors.surfaceHigh, color: colors.text },
  danger: { background: "rgba(239, 68, 68, 0.2)", borderColor: "rgba(239, 68, 68, 0.5)" },
  warning: { background: "rgba(245, 158, 11, 0.2)", borderColor: "rgba(245, 158, 11, 0.5)" },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    borderRadius: radii.sm,
    fontWeight: 600,
    fontFamily: "var(--font-sans)",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.5 : 1,
    transition: "all 150ms ease",
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      style={baseStyle}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, hoverVariant[variant]);
        }
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, variantStyles[variant], sizeStyles[size]);
        if (disabled || loading) e.currentTarget.style.opacity = "0.5";
      }}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
}
