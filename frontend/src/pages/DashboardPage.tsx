import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Users,
  ClipboardCheck,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useLeads, useCampaigns, useReports, useMonitorStatus } from "@/lib/hooks";
import { MetricCard } from "@/components/charts/MetricCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { DataTable } from "@/components/tables/DataTable";
import { StatusLED } from "@/components/domain/StatusLED";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ColumnDef } from "@tanstack/react-table";


export function DashboardPage() {
  const navigate = useNavigate();
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ limit: 200 });
  const { data: campaigns } = useCampaigns();
  const { data: reports } = useReports({ limit: 50 });
  const { data: monitor } = useMonitorStatus();

  const leads = leadsData?.items ?? [];
  const totalLeads = leadsData?.total ?? 0;
  const auditedCount = leads.filter((l) => l.lighthouse_score != null).length;
  const pendingCount = leads.filter((l) =>
    ["new", "queued", "auditing"].includes(l.status)
  ).length;
  const segmentACount = leads.filter(
    (l) => l.segment === "A" || l.segment === "B"
  ).length;
  const reportsCompleted =
    reports?.items?.filter((r) => r.status === "completed").length ?? 0;

  // Chart data: leads discovered by day (last 7 days)
  const chartData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const now = new Date();
    return days.map((day, i) => {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - (6 - i));
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = leads.filter((l) => {
        const d = new Date(l.discovered_at);
        return d >= dayStart && d <= dayEnd;
      }).length;
      return { name: day, leads: count };
    });
  }, [leads]);

  // Recent activity for mini table
  const recentActivity = useMemo(() => {
    const activity: {
      id: string;
      domain: string;
      event: string;
      time: string;
      status: "success" | "info" | "warning";
    }[] = [];

    reports?.items?.slice(0, 4).forEach((r) => {
      activity.push({
        id: `r-${r.id}`,
        domain: r.lead_domain ?? r.lead_id.slice(0, 8),
        event: "Report generated",
        time: r.created_at ? new Date(r.created_at).toLocaleTimeString() : "",
        status: "info",
      });
    });

    leads
      .filter((l) => l.lighthouse_score)
      .slice(0, 4)
      .forEach((l) => {
        activity.push({
          id: `a-${l.id}`,
          domain: l.normalized_domain,
          event: "Audit completed",
          time: l.audited_at
            ? new Date(l.audited_at).toLocaleTimeString()
            : "",
          status: "success",
        });
      });

    return activity.slice(0, 8);
  }, [leads, reports]);

  const activityColumns = useMemo<ColumnDef<(typeof recentActivity)[0], unknown>[]>(
    () => [
      {
        id: "domain",
        header: "Domain",
        accessorFn: (row) => row.domain,
        cell: ({ row }) => (
          <span className="text-xs font-mono text-text">{row.original.domain}</span>
        ),
      },
      {
        id: "event",
        header: "Event",
        accessorFn: (row) => row.event,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <StatusLED
              variant={row.original.status}
              size="sm"
            />
            <span className="text-xs text-text-secondary">{row.original.event}</span>
          </div>
        ),
      },
      {
        id: "time",
        header: "Time",
        accessorFn: (row) => row.time,
        cell: ({ row }) => (
          <span className="text-[10px] font-mono text-text-dim">
            {row.original.time}
          </span>
        ),
      },
    ],
    []
  );

  const allOnline = monitor?.services?.every((s) => s.status === "online") ?? true;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-headline font-semibold text-text">
          Dashboard
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Overview of your lead generation pipeline
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Leads"
          value={totalLeads}
          formattedValue={totalLeads.toLocaleString()}
          trend={{ direction: "up", value: 12.5 }}
          variant="highlighted"
          icon={<Users className="size-4" aria-hidden="true" />}
          sparklineData={chartData.map((d) => d.leads)}
        />
        <MetricCard
          label="Audited"
          value={auditedCount}
          formattedValue={auditedCount.toLocaleString()}
          icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Pending"
          value={pendingCount}
          formattedValue={String(pendingCount)}
          trend={
            pendingCount > 0
              ? { direction: "down", value: 0 }
              : { direction: "neutral", value: 0 }
          }
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Hot Leads (A+B)"
          value={segmentACount}
          formattedValue={String(segmentACount)}
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
        />
      </div>

      {/* Middle Row: Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leads Growth Chart */}
        <div className="lg:col-span-2">
          <AreaChart
            title="Leads Discovered"
            description="7-Day Discovery Activity"
            data={chartData}
            series={[
              {
                dataKey: "leads",
                name: "Leads",
                color: "#6366f1",
              },
            ]}
            height={280}
            loading={leadsLoading}
          />
        </div>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">
              Recent Activity
            </h3>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-text-muted py-8 text-center">
                No recent activity
              </p>
            ) : (
              <DataTable
                data={recentActivity}
                columns={activityColumns}
                density="compact"
                getRowId={(row) => row.id}
                stickyFirstColumn={false}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Campaigns */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">
              Campaigns
            </h3>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-text">
              {campaigns?.length ?? 0}
            </div>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-success">
                ● {campaigns?.filter((c) => c.status === "active").length ?? 0} Active
              </span>
              <span className="text-text-dim">
                ○ {campaigns?.filter((c) => c.status === "completed").length ?? 0} Completed
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs"
              onClick={() => navigate("/campaigns")}
            >
              View Campaigns
            </Button>
          </CardContent>
        </Card>

        {/* Reports */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">
              Reports
            </h3>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-text">
              {reports?.total ?? 0}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-text-muted">
              <CheckCircle className="size-3 text-success" aria-hidden="true" />
              {reportsCompleted} completed
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs"
              onClick={() => navigate("/reports")}
            >
              View Reports
            </Button>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">
              System Health
            </h3>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StatusLED
                variant={allOnline ? "success" : "warning"}
                size="md"
                pulse={allOnline}
              />
              <span className="text-sm font-medium text-text">
                {allOnline ? "Operational" : "Issues detected"}
              </span>
            </div>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {monitor?.services?.slice(0, 4).map((svc) => (
                <span
                  key={svc.name}
                  className="inline-flex items-center rounded px-2 py-1 text-[10px] font-semibold bg-surface-high text-text-muted"
                >
                  {svc.name}
                </span>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs"
              onClick={() => navigate("/monitor")}
            >
              System Monitor
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
