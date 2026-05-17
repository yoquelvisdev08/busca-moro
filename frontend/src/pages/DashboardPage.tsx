import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Minus, Play, X } from "lucide-react";
import toast from "react-hot-toast";

import { api, type Lead, type QueueDepths } from "@/lib/api";

interface DashboardState {
  queues: QueueDepths | null;
  leads: Lead[];
  loading: boolean;
  error: string | null;
}

interface DiscoveryForm {
  industry: string;
  location: string;
  numDorks: number;
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
  const [showModal, setShowModal] = useState(false);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [form, setForm] = useState<DiscoveryForm>({
    industry: "",
    location: "",
    numDorks: 15,
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

  const handleStartDiscovery = async () => {
    if (!form.industry.trim()) {
      toast.error("Enter a business type to search for");
      return;
    }

    setDiscoveryRunning(true);
    toast.loading("Generating AI dorks...");

    try {
      const result = await api.startDiscovery({
        industry: form.industry,
        location: form.location,
        numDorks: form.numDorks,
      });

      toast.dismiss();
      toast.success(result.message);
      setShowModal(false);

      // Refresh data
      const [queues, leads] = await Promise.all([
        api.getQueueDepths(),
        api.listLeads({ limit: 10 }),
      ]);
      setState({ queues, leads: leads.items, loading: false, error: null });
    } catch (err) {
      toast.dismiss();
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setDiscoveryRunning(false);
    }
  };

  const totalLeads = state.leads.length;
  const contactedCount = state.leads.filter((l) => l.status === "contacted").length;
  const enrichedCount = state.leads.filter(
    (l) => l.status === "enriched" || l.status === "audited"
  ).length;

  return (
    <section>
      {/* Greeting + Start Discovery */}
      <div className="dashboard-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            {getGreeting()}, Operator
          </h2>
          <p className="text-gray-400 text-sm">{formatDate()}</p>
        </div>
        <button
          className="btn primary-lg"
          onClick={() => setShowModal(true)}
          disabled={discoveryRunning}
        >
          <Play className="w-4 h-4" />
          {discoveryRunning ? "Running..." : "Start Discovery"}
        </button>
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
              No leads yet. Click <strong>"Start Discovery"</strong> to find your first leads.
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

      {/* Discovery Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Start Discovery</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">What type of business?</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="e.g. dental clinics, law firms, restaurants"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label">Location (optional)</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="e.g. Madrid, Spain"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label">Number of searches</label>
                <select
                  className="field-input field-select"
                  value={form.numDorks}
                  onChange={(e) => setForm({ ...form, numDorks: Number(e.target.value) })}
                >
                  <option value={10}>10 (quick)</option>
                  <option value={15}>15 (recommended)</option>
                  <option value={20}>20 (thorough)</option>
                  <option value={30}>30 (aggressive)</option>
                </select>
              </div>
              <p className="modal-hint">
                AI will generate targeted Google searches to find websites that need improvement.
                The Scout will start immediately.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="btn primary-lg"
                onClick={handleStartDiscovery}
                disabled={discoveryRunning || !form.industry.trim()}
              >
                <Play className="w-4 h-4" />
                {discoveryRunning ? "Generating..." : "Start"}
              </button>
            </div>
          </div>
        </div>
      )}
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
