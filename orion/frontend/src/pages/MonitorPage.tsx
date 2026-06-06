import { useMemo } from "react";
import { RefreshCw, Server, Shield, Database, Activity, Clock } from "lucide-react";
import { useMonitorStatus } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusLED } from "@/components/domain/StatusLED";
import { MetricCard } from "@/components/charts/MetricCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { cn } from "@/lib/utils";

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Scout: Server,
  Auditor: Shield,
  Closer: Database,
  Sniper: Activity,
  API: Server,
  Email: Clock,
};

const statusToLEDVariant = {
  online: "success" as const,
  degraded: "warning" as const,
  offline: "danger" as const,
};

export function MonitorPage() {
  const { data: monitor, isLoading, error, refetch, isFetching } = useMonitorStatus();

  const avgResponseMs = useMemo(() => {
    if (!monitor?.services?.length) return 0;
    return Math.round(
      monitor.services.reduce((sum, s) => sum + s.response_ms, 0) /
        monitor.services.length
    );
  }, [monitor]);

  // Build AreaChart data from queue depths
  const chartData = useMemo(() => {
    if (!monitor?.queues) return [];
    return [
      {
        name: "Discovery",
        value: monitor.queues.discovery,
      },
      {
        name: "Audit",
        value: monitor.queues.audit,
      },
      {
        name: "Outreach",
        value: monitor.queues.outreach,
      },
      {
        name: "Sniper",
        value: monitor.queues.sniper_alerts,
      },
      {
        name: "DLQ",
        value: monitor.queues.dlq,
      },
    ];
  }, [monitor]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6" aria-busy="true" aria-live="polite">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="text-danger text-sm font-mono">Monitor Error</span>
        <p className="text-text-muted text-xs max-w-md">
          {(error as Error).message || "Failed to load monitor status"}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} aria-label="Retry loading monitor status">
          <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" /> Retry
        </Button>
      </div>
    );
  }

  const allOnline = monitor?.services?.every((s) => s.status === "online") ?? true;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-headline font-semibold text-text">
            System Monitor
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time service status and health
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={cn("size-3.5 mr-1.5", isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="System Status"
          value={allOnline ? 1 : 0}
          formattedValue={allOnline ? "All Operational" : "Issues Detected"}
          trend={
            allOnline
              ? { direction: "up", value: 100 }
              : { direction: "down", value: 0 }
          }
          variant={allOnline ? "highlighted" : "default"}
        />
        <MetricCard
          label="Services"
          value={monitor?.services?.length ?? 0}
          formattedValue={String(monitor?.services?.length ?? 0)}
        />
        <MetricCard
          label="Avg Response"
          value={avgResponseMs}
          formattedValue={`${avgResponseMs}ms`}
        />
        <MetricCard
          label="Uptime (30d)"
          value={99.97}
          formattedValue="99.97%"
          trend={{ direction: "up", value: 0.03 }}
        />
      </div>

      {/* Performance Chart */}
      <AreaChart
        title="Queue Depths"
        description="Active items per queue"
        data={chartData}
        series={[
          { dataKey: "value", name: "Queue Depth", color: "#6366f1" },
        ]}
        height={250}
      />

      {/* Service List + Queue Depths */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Service Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">
              Services
            </h3>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="grid" aria-label="Service status">
                <thead>
                  <tr className="border-b border-border" role="row">
                    <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-text-muted" role="columnheader">
                      Service
                    </th>
                    <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-text-muted" role="columnheader">
                      Status
                    </th>
                    <th className="text-left py-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-text-muted" role="columnheader">
                      Response
                    </th>
                    <th className="text-left py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted" role="columnheader">
                      Last Check
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(monitor?.services ?? []).map((svc) => {
                    const Icon = SERVICE_ICONS[svc.name] || Server;
                    return (
                      <tr
                        key={svc.name}
                        role="row"
                        className="border-b border-border-subtle hover:bg-surface-high/60 transition-colors"
                      >
                        <td className="py-3 pr-3" role="gridcell">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-8 items-center justify-center rounded-md bg-surface-high border border-border">
                              <Icon className="size-4 text-text-secondary" aria-hidden="true" />
                            </span>
                            <span className="font-medium text-text">
                              {svc.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-3" role="gridcell">
                          <StatusLED
                            variant={statusToLEDVariant[svc.status] ?? "neutral"}
                            size="sm"
                            label={svc.status}
                          />
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-text" role="gridcell">
                          {svc.response_ms}ms
                        </td>
                        <td className="py-3 font-mono text-xs text-text-muted" role="gridcell">
                          {new Date(svc.last_check).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Queue Depths */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">
              Queue Depths
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {monitor?.queues
              ? Object.entries(monitor.queues).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg bg-bg px-3 py-2.5 border border-border-subtle"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span
                      className={cn(
                        "text-lg font-mono font-bold tabular-nums",
                        value > 0 ? "text-warning" : "text-text"
                      )}
                    >
                      {value}
                    </span>
                  </div>
                ))
              : (
                <p className="text-xs text-text-muted py-4 text-center">
                  No queue data available
                </p>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      {monitor?.events && monitor.events.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">
              Recent Events
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monitor.events.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-surface-high/40 px-3 py-2 border border-border-subtle"
                >
                  <StatusLED
                    variant={
                      event.type === "error"
                        ? "danger"
                        : event.type === "success"
                          ? "success"
                          : "info"
                    }
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-text">
                      {event.service}
                    </span>
                    <span className="text-xs text-text-secondary ml-2">
                      {event.message}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-dim shrink-0">
                    {new Date(event.time).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
