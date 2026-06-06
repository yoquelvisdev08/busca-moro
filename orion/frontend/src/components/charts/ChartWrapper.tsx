import * as React from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export interface ChartWrapperProps extends React.ComponentProps<"div"> {
  title?: string
  description?: string
  loading?: boolean
  error?: Error | null
  actions?: React.ReactNode
}

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] p-4">
      <div className="w-full space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

interface ErrorFallbackProps {
  error: Error
}

function ErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 p-6 text-center text-text-muted min-h-[200px]"
    >
      <span className="text-danger text-sm font-mono">Chart Error</span>
      <p className="text-xs max-w-[300px]">{error.message || "Failed to render chart"}</p>
    </div>
  )
}

interface ChartErrorBoundaryProps {
  children: React.ReactNode
}

interface ChartErrorBoundaryState {
  error: Error | null
}

class ChartErrorBoundary extends React.Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}

function ChartWrapper({
  title,
  description,
  loading = false,
  error = null,
  actions,
  className,
  children,
  ...props
}: ChartWrapperProps) {
  return (
    <div
      data-slot="chart-wrapper"
      className={cn(
        "rounded-xl bg-surface border border-border-subtle overflow-hidden",
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div>
            {title && (
              <h3 className="text-sm font-headline font-medium text-text">{title}</h3>
            )}
            {description && (
              <p className="text-xs text-text-muted mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">
        {error ? (
          <ErrorFallback error={error} />
        ) : loading ? (
          <ChartSkeleton />
        ) : (
          <ChartErrorBoundary>
            {children}
          </ChartErrorBoundary>
        )}
      </div>
    </div>
  )
}

// Helper: create a lazy-loaded chart component
function createLazyChart<T extends Record<string, unknown>>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>
): React.ComponentType<T> {
  const LazyComponent = React.lazy(importFn)

  function LazyChart(props: T) {
    return (
      <React.Suspense fallback={<ChartSkeleton />}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <LazyComponent {...(props as any)} />
      </React.Suspense>
    )
  }

  LazyChart.displayName = "LazyChart"
  return LazyChart
}

export { ChartWrapper, ChartErrorBoundary, ErrorFallback, ChartSkeleton, createLazyChart }
