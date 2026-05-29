import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Activity,
  Server,
  Shield,
  Database,
  Clock,
} from "lucide-react";

/* ── Mock Data ── */
const SERVICES = [
  { name: "Scout", status: "Online", lastCheck: "2m ago", response: "84ms", uptime: "99.99%", icon: Server },
  { name: "Auditor", status: "Online", lastCheck: "1m ago", response: "112ms", uptime: "99.97%", icon: Shield },
  { name: "Closer", status: "Online", lastCheck: "5m ago", response: "95ms", uptime: "100%", icon: Database },
  { name: "Sniper", status: "Online", lastCheck: "30s ago", response: "240ms", uptime: "99.95%", icon: Activity },
  { name: "API", status: "Online", lastCheck: "10s ago", response: "45ms", uptime: "99.99%", icon: Server },
  { name: "Email", status: "Online", lastCheck: "3m ago", response: "1.2s", uptime: "99.92%", icon: Clock },
];

const ALERTS = [
  {
    type: "error" as const,
    service: "API",
    time: "Just Now",
    message: "Latency spike detected in US-East. Peak reached 4.2s during load test synchronization.",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  {
    type: "info" as const,
    service: "Scout",
    time: "15m ago",
    message: "Re-indexing of node_772 complete. 1.2M records processed in 42 seconds.",
    icon: <RefreshCw className="w-3.5 h-3.5" />,
  },
  {
    type: "success" as const,
    service: "System",
    time: "1h ago",
    message: "Scheduled backup completed successfully. Archive: sx-backup-20231027-v1.tar.gz",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
];

const surfaceCard = {
  background: "var(--sx-surface)",
  border: "1px solid var(--sx-border)",
  borderRadius: "var(--radius-md)",
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "var(--sx-text-muted)",
};

export function MonitorPage() {
  return (
    <section className="space-y-8">
      {/* Top Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* System Status */}
        <div className="p-5" style={surfaceCard}>
          <span style={labelStyle}>System Status</span>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-3 h-3 rounded-full" style={{ background: "#10b981", boxShadow: "0 0 8px rgba(16,185,129,0.4)" }} />
            <h2 className="text-2xl font-bold" style={{ color: "var(--sx-text)" }}>All Operational</h2>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--sx-text-muted)" }}>All 6 services running normally</p>
        </div>

        {/* Avg Response Time */}
        <div className="p-5" style={surfaceCard}>
          <span style={labelStyle}>Avg Response Time</span>
          <h2 className="text-2xl font-bold mt-3" style={{ color: "var(--sx-primary)" }}>97ms</h2>
          <p className="text-xs mt-2" style={{ color: "var(--sx-text-muted)" }}>↓ 12ms from last hour</p>
        </div>

        {/* Uptime 30d */}
        <div className="p-5" style={surfaceCard}>
          <span style={labelStyle}>Uptime (30 days)</span>
          <h2 className="text-2xl font-bold mt-3" style={{ color: "var(--sx-text)" }}>99.97%</h2>
          <div className="w-full h-1 mt-3 rounded-full" style={{ background: "var(--sx-surface-high)" }}>
            <div className="h-full rounded-full" style={{ width: "99.97%", background: "var(--sx-success)" }} />
          </div>
        </div>
      </div>

      {/* Service List */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--sx-text)" }}>Services</h2>
        <div style={{ ...surfaceCard, overflow: "hidden" }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--sx-bg-lower)" }}>
                {["Service", "Status", "Last Check", "Response", "Uptime"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--sx-text-muted)", borderBottom: "1px solid var(--sx-border)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SERVICES.map((svc) => {
                const Icon = svc.icon;
                return (
                  <tr
                    key={svc.name}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--sx-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sx-surface-high)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded flex items-center justify-center border" style={{ background: "var(--sx-surface-high)", borderColor: "var(--sx-border)" }}>
                          <Icon className="w-4 h-4" style={{ color: "var(--sx-text-secondary)" }} />
                        </div>
                        <span className="text-sm font-semibold" style={{ color: "var(--sx-text)" }}>{svc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--sx-success)" }}>{svc.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono" style={{ color: "var(--sx-text-muted)" }}>{svc.lastCheck}</td>
                    <td className="px-6 py-4 text-xs font-mono" style={{ color: "var(--sx-text)" }}>{svc.response}</td>
                    <td className="px-6 py-4 text-xs font-mono" style={{ color: "var(--sx-primary)" }}>{svc.uptime}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts Timeline */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--sx-text)" }}>Recent Alerts</h2>
        <div className="space-y-4">
          {ALERTS.map((alert, i) => {
            const colors = {
              error: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
              info: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6", border: "rgba(139,92,246,0.3)" },
              success: { bg: "rgba(16,185,129,0.15)", text: "#10b981", border: "rgba(16,185,129,0.3)" },
            };
            const c = colors[alert.type];
            return (
              <div key={i} className="relative pl-8 flex gap-4 group" style={{ borderLeft: `2px solid ${c.border}` }}>
                <div
                  className="absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full flex items-center justify-center border-4 z-10"
                  style={{ background: c.bg, borderColor: "var(--sx-bg)" }}
                >
                  <span style={{ color: c.text }}>{alert.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>
                      {alert.time}
                    </span>
                    <span className="font-bold text-sm" style={{ color: "var(--sx-text)" }}>{alert.service}</span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--sx-text-muted)" }}>{alert.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
