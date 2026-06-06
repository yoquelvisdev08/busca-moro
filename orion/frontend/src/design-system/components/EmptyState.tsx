import React from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/design-system/components/Button";
import { colors } from "@/design-system/tokens";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "48px 32px",
        textAlign: "center",
        ...style,
      }}
    >
      <div style={{ opacity: 0.3, marginBottom: "8px" }}>
        {icon || <Inbox size={48} />}
      </div>
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: colors.text }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: 0, fontSize: "13px", color: colors.textMuted }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction} style={{ marginTop: "8px" }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
