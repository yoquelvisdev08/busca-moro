import React from "react";
import { Loader2 } from "lucide-react";
import { colors } from "@/design-system/tokens";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

const sizeMap = { sm: 16, md: 24, lg: 36 } as const;

export function Spinner({ size = "md", style }: SpinnerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        ...style,
      }}
    >
      <Loader2
        className="animate-spin"
        size={sizeMap[size]}
        style={{ color: colors.primaryContainer }}
      />
    </div>
  );
}
