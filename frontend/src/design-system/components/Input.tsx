import React from "react";
import { colors, radii } from "@/design-system/tokens";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  wrapperStyle?: React.CSSProperties;
}

export function Input({
  label,
  error,
  helperText,
  wrapperStyle,
  style,
  id,
  ...rest
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...wrapperStyle }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: colors.textMuted,
            fontFamily: "var(--font-sans)",
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={{
          width: "100%",
          background: colors.bg,
          border: `1px solid ${error ? colors.danger : colors.borderStrong}`,
          borderRadius: radii.sm,
          padding: "8px 12px",
          fontSize: "14px",
          color: colors.text,
          fontFamily: "var(--font-sans)",
          transition: "border-color 150ms, box-shadow 150ms",
          outline: "none",
          ...(error ? { boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.15)" } : {}),
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? colors.danger : colors.primaryContainer;
          if (!error) e.currentTarget.style.boxShadow = "0 0 0 2px rgba(139, 92, 246, 0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? colors.danger : colors.borderStrong;
          e.currentTarget.style.boxShadow = error ? "0 0 0 2px rgba(239, 68, 68, 0.15)" : "none";
        }}
        {...rest}
      />
      {error && (
        <span style={{ fontSize: "12px", color: colors.danger, fontWeight: 500 }}>{error}</span>
      )}
      {helperText && !error && (
        <span style={{ fontSize: "12px", color: colors.textMuted }}>{helperText}</span>
      )}
    </div>
  );
}
