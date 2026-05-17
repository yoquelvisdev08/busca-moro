import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

import { api, type Lead, type QueueDepths } from "@/lib/api";

interface DashboardState {
  queues: QueueDepths | null;
  leads: Lead[];
  loading: boolean;
  error: string | null;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<DashboardState>({
    queues: null,
    leads: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [queues, leads] = await Promise.all([
          api.getQueueDepths(),
          api.listLeads({ limit: 10 }),
        ]);
        if (cancelled) return;
        setState({ queues, leads: leads.items, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: (err as Error).message }));
      }
    }

    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const totalLeads = state.leads.length;
  const contactedCount = state.leads.filter((l) => l.status === "contacted").length;
  const enrichedCount = state.leads.filter(
    (l) => l.status === "enriched" || l.status === "audited"
  ).length;

  return (
    <section>
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="page-title" style={{ marginBottom: 4 }}>
          {getGreeting()}, Operator
        </h2>
        <p className="text-gray-400 text-sm">{formatDate()}</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          label="Discovery Queue"
          value={state.queues?.discovery ?? 0}
          trend={state.queues?.discovery ?? 0 > 0 ? "up" : "flat"}
          color="var(--primary)"
        />
        <StatCard
          label="Audit Queue"
          value={state.queues?.audit ?? 0}
          trend={state.queues?.audit ?? 0 > 5 ? "up" : "down"}
          color="var(--void-purple)"
        />
        <StatCard
          label="Outreach Sent"
          value={contactedCount}
          trend="up"
          color="var(--void-success)"
        />
        <StatCard
          label="Active Leads"
          value={enrichedCount}
          trend="flat"
          color="var(--void-warning)"
        />
      </div>

      {/* Recent Leads */}
      <div className="panel">
        <div className="panel-header">
          <h3>Recent Leads</h3>
          <span className="badge success">
            {state.loading ? "Refreshing..." : `Live · ${totalLeads}`}
          </span>
        </div>
        <div className="panel-body">
          {state.error ? (
            <div className="empty">{state.error}</div>
          ) : state.leads.length === 0 ? (
            <div className="empty">
              No leads yet. Start the Scout or add a lead via{" "}
              <code>POST /v1/leads</code>.
            </div>
          ) : (
            <table className="console">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Score</th>
                  <th>Segment</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {state.leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td>
                      <span className="domain-link">{lead.normalized_domain}</span>
                    </td>
                    <td>
                      <span className="score-badge">{lead.score}</span>
                    </td>
                    <td>
                      <span className={`segment-pill segment-${lead.segment ?? "D"}`}>
                        {lead.segment ?? "D"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${statusBadgeClass(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="text-gray-400 text-xs">
                      {timeAgo(lead.audited_at ?? lead.discovered_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  trend,
  color,
}: {
  label: string;
  value: number | string;
  trend: "up" | "down" | "flat";
  color: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up" ? "var(--void-success)" : trend === "down" ? "var(--void-danger)" : "var(--void-text-dim)";

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
      </div>
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function statusBadgeClass(status: Lead["status"]) {
  switch (status) {
    case "enriched":
    case "audited":
      return "status-info";
    case "contacted":
    case "replied":
    case "won":
    case "interested":
    case "negotiation":
      return "status-success";
    case "rejected":
    case "error":
    case "closed_lost":
      return "status-danger";
    case "queued":
    case "auditing":
      return "status-warning";
    case "closed_won":
      return "status-success";
    default:
      return "status-default";
  }
}
