import React from "react";
import { colors, radii } from "@/design-system/tokens";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function Select({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "Select...",
  style,
  id,
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label
          htmlFor={selectId}
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
      <div style={{ position: "relative" }}>
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          style={{
            width: "100%",
            background: colors.bg,
            border: `1px solid ${error ? colors.danger : colors.borderStrong}`,
            borderRadius: radii.sm,
            padding: "8px 32px 8px 12px",
            fontSize: "14px",
            color: colors.text,
            fontFamily: "var(--font-sans)",
            cursor: "pointer",
            outline: "none",
            appearance: "none",
            transition: "border-color 150ms",
            ...style,
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: colors.textMuted,
            pointerEvents: "none",
          }}
        />
      </div>
      {error && (
        <span style={{ fontSize: "12px", color: colors.danger, fontWeight: 500 }}>{error}</span>
      )}
    </div>
  );
}
