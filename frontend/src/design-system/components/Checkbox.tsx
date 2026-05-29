import React from "react";
import { colors, radii } from "@/design-system/tokens";

export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export function Checkbox({
  label,
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  id,
  style,
}: CheckboxProps) {
  const checkboxId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <label
      htmlFor={checkboxId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: "14px",
        color: colors.text,
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "18px",
          height: "18px",
          flexShrink: 0,
          borderRadius: radii.sm,
          border: `2px solid ${checked || indeterminate ? colors.primaryContainer : colors.borderStrong}`,
          background: checked || indeterminate ? colors.primaryContainer : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 150ms",
        }}
      >
        {checked && !indeterminate && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {indeterminate && (
          <div style={{ width: "8px", height: "2px", background: "#fff", borderRadius: "1px" }} />
        )}
      </div>
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      />
      {label}
    </label>
  );
}
