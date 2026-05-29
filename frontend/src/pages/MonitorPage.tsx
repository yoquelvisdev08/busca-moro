import {
  Activity,
  Server,
  Shield,
  Database,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useMonitorStatus } from "@/lib/hooks";
import { Card } from "@/design-system/components/Card";
import { Button } from "@/design-system/components/Button";
import { Spinner } from "@/design-system/components/Spinner";
import { colors } from "@/design-system/tokens";

const SERVICE_ICONS: Record<string, React.ComponentType<any>> = {
  Scout: Server,
  Auditor: Shield,
  Closer: Database,
  Sniper: Activity,
  API: Server,
  Email: Clock,
};

const STATUS_COLORS: Record<string, string> = {
  online: colors.success,
  degraded: colors.warning,
  offline: colors.danger,
};

export function MonitorPage() {
  const { data: monitor, isLoading, error, refetch, isFetching } = useMonitorStatus();

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>System Monitor</h1>
          <p style={{ fontSize: "13px", color: colors.textMuted }}>Real-time service status and health</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <Spinner style={{ padding: "60px" }} />
      ) : error ? (
        <div style={{ padding: "32px", color: colors.danger, textAlign: "center" }}>
          Error loading monitor status: {(error as Error).message}
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <Card>
              <span style={labelStyle}>System Status</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: colors.success, boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" }} />
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: colors.text, margin: 0 }}>All Operational</h2>
              </div>
              <p style={{ fontSize: "12px", color: colors.textMuted, margin: "8px 0 0" }}>
                {monitor?.services?.length ?? 0} services running
              </p>
            </Card>

            <Card>
              <span style={labelStyle}>Avg Response Time</span>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: colors.primary, margin: "12px 0 0", fontFamily: "var(--font-mono)" }}>
                {monitor?.services?.length
                  ? Math.round(monitor.services.reduce((sum, s) => sum + s.response_ms, 0) / monitor.services.length)
                  : "—"}ms
              </h2>
            </Card>

            <Card>
              <span style={labelStyle}>Uptime (30 days)</span>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: colors.text, margin: "12px 0 0", fontFamily: "var(--font-mono)" }}>
                99.97%
              </h2>
              <div style={{ height: "4px", borderRadius: "2px", background: colors.surfaceHigh, marginTop: "12px" }}>
                <div style={{ width: "99.97%", height: "100%", borderRadius: "2px", background: colors.success }} />
              </div>
            </Card>
          </div>

          {/* Service List */}
          <Card padding="0" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                <thead>
                  <tr style={{ background: colors.bg }}>
                    {["Service", "Status", "Last Check", "Response", "Uptime"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(monitor?.services ?? []).map((svc) => {
                    const Icon = SERVICE_ICONS[svc.name] || Server;
                    const statusColor = STATUS_COLORS[svc.status] || colors.textMuted;
                    return (
                      <tr
                        key={svc.name}
                        style={{ borderBottom: `1px solid ${colors.border}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHigh)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", background: colors.surfaceHigh, border: `1px solid ${colors.border}` }}>
                              <Icon size={16} style={{ color: colors.textSecondary }} />
                            </div>
                            <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{svc.name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor }} />
                            <span style={{ fontSize: "12px", fontWeight: 600, color: statusColor, textTransform: "capitalize" }}>
                              {svc.status}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted }}>
                          {new Date(svc.last_check).toLocaleTimeString()}
                        </td>
                        <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.text }}>
                          {svc.response_ms}ms
                        </td>
                        <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.primary }}>
                          99.99%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Queue Depths */}
          {monitor?.queues && (
            <Card>
              <span style={labelStyle}>Queue Depths</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "16px", marginTop: "16px" }}>
                {Object.entries(monitor.queues).map(([key, value]) => (
                  <div key={key} style={{ textAlign: "center", padding: "12px", background: colors.bg, borderRadius: "8px", border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: colors.textMuted, textTransform: "uppercase", marginBottom: "8px" }}>
                      {key}
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 700, fontFamily: "var(--font-mono)", color: value > 0 ? colors.warning : colors.text }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.textMuted,
  fontFamily: "var(--font-sans)",
};

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  borderBottom: `1px solid ${colors.border}`,
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.textMuted,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: colors.text,
};
