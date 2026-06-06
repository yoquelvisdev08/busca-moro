import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { TrendIndicator, type TrendDirection } from "./TrendIndicator";
import { Sparkline } from "./Sparkline";

export interface MetricCardProps extends React.ComponentProps<"div"> {
  label: string;
  value: string | number;
  formattedValue: string;
  icon?: React.ReactNode;
  trend?: { direction: TrendDirection; value: number };
  sparklineData?: number[];
  variant?: "default" | "highlighted";
}

export function MetricCard({
  label,
  formattedValue,
  icon,
  trend,
  sparklineData,
  variant = "default",
  className,
  ...props
}: MetricCardProps) {
  const isHighlighted = variant === "highlighted";

  return (
    <Card
      className={cn(
        "min-w-[180px]",
        isHighlighted && "card-glow border-primary/30",
        className,
      )}
      {...props}
    >
      <CardHeader className="flex-row items-start justify-between gap-2 border-b-0 pb-0">
        <span className="text-xs text-text-muted font-mono uppercase tracking-wider truncate">
          {label}
        </span>
        {icon && <span className="shrink-0 text-text-muted [&>svg]:size-4">{icon}</span>}
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-end justify-between gap-2">
          <span
            className={cn(
              "text-2xl font-headline font-semibold tabular-nums text-text",
              isHighlighted && "text-primary",
            )}
          >
            {formattedValue}
          </span>
          {trend && <TrendIndicator direction={trend.direction} value={trend.value} />}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-2">
            <Sparkline data={sparklineData} width={80} height={32} areaFill strokeColor="#22d3ee" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
