import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface ChartWrapperProps extends React.ComponentProps<"div"> {
  title?: string;
  description?: string;
  loading?: boolean;
  error?: Error | null;
}

export function ChartWrapper({
  title,
  description,
  loading = false,
  error = null,
  className,
  children,
  ...props
}: ChartWrapperProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface border border-border-subtle overflow-hidden",
        className,
      )}
      {...props}
    >
      {(title || description) && (
        <div className="px-4 py-3 border-b border-border-subtle">
          {title && (
            <h3 className="text-sm font-headline font-medium text-text">{title}</h3>
          )}
          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className="p-4">
        {error ? (
          <p className="text-xs text-danger py-8 text-center">{error.message}</p>
        ) : loading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
