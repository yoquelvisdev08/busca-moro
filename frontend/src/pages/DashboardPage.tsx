import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Users,
  ClipboardCheck,
  Gauge,
  History,
  BarChart3,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useLeads, useCampaigns, useReports, useMonitorStatus } from "@/lib/hooks";
import { Card } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
import { Spinner } from "@/design-system/components/Spinner";
import { colors } from "@/design-system/tokens";

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.textMuted,
  fontFamily: "var(--font-sans)",
};

const statCardStyle: React.CSSProperties = {
  padding: "16px",
  border: `1px solid ${colors.border}`,
  borderRadius: "8px",
  background: colors.surface,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ limit: 200 });
  const { data: campaigns } = useCampaigns();
  const { data: reports } = useReports({ limit: 50 });
  const { data: monitor } = useMonitorStatus();

  if (leadsLoading) return <Spinner size="lg" style={{ padding: "80px 0" }} />;

  const leads = leadsData?.items ?? [];
  const totalLeads = leadsData?.total ?? 0;
  const auditedCount = leads.filter((l) => l.lighthouse_score != null).length;
  const pendingCount = leads.filter((l) =>
    ["new", "queued", "auditing"].includes(l.status)
  ).length;
  const segmentACount = leads.filter((l) => l.segment === "A" || l.segment === "B").length;

  const recentEvents = [
    ...(reports?.items?.slice(0, 3).map((r) => ({
      text: `Report generated for ${r.lead_domain || r.lead_id}`,
      time: r.created_at ? new Date(r.created_at).toLocaleTimeString() : "",
      meta: "Report",
      active: true,
    })) ?? []),
    ...(leads.slice(0, 5).filter((l) => l.lighthouse_score).map((l) => ({
      text: `Audit completed for ${l.normalized_domain}`,
      time: l.audited_at ? new Date(l.audited_at).toLocaleTimeString() : "",
      meta: "Audit",
      active: false,
    }))),
  ].slice(0, 8);

  /* ── Bar chart data from real leads ── */
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const now = new Date();
  const dayCounts = days.map((_, i) => {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - (6 - i));
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    return leads.filter((l) => {
      const d = new Date(l.discovered_at);
      return d >= dayStart && d <= dayEnd;
    }).length;
  });
  const maxCount = Math.max(...dayCounts, 1);
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div style={statCardStyle}>
          <span style={labelStyle}>Total Leads</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.primary }}>
              {totalLeads.toLocaleString()}
            </span>
            <TrendingUp size={20} style={{ color: colors.primary, opacity: 0.4 }} />
          </div>
          <div style={{ height: "4px", marginTop: "8px", borderRadius: "2px", background: colors.surfaceHigh }}>
            <div style={{ width: `${Math.min(100, (totalLeads / 2000) * 100)}%`, height: "100%", borderRadius: "2px", background: colors.primaryContainer }} />
          </div>
        </div>

        <div style={statCardStyle}>
          <span style={labelStyle}>Audited</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.success }}>
              {auditedCount.toLocaleString()}
            </span>
            <ClipboardCheck size={20} style={{ color: colors.success, opacity: 0.4 }} />
          </div>
          <span style={{ fontSize: "11px", color: colors.textMuted }}>
            {totalLeads > 0 ? Math.round((auditedCount / totalLeads) * 100) : 0}% of total
          </span>
        </div>

        <div style={statCardStyle}>
          <span style={labelStyle}>Pending</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.warning }}>
              {pendingCount}
            </span>
            <Clock size={20} style={{ color: colors.warning, opacity: 0.4 }} />
          </div>
          <span style={{ fontSize: "11px", color: colors.textMuted }}>Awaiting processing</span>
        </div>

        <div style={statCardStyle}>
          <span style={labelStyle}>Hot Leads (A+B)</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.danger }}>
              {segmentACount}
            </span>
            <Users size={20} style={{ color: colors.danger, opacity: 0.4 }} />
          </div>
          <span style={{ fontSize: "11px", color: colors.textMuted }}>High-value prospects</span>
        </div>
      </div>

      {/* Middle Row: Chart + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", minHeight: "320px" }}>
        {/* Chart */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <span style={labelStyle}>Leads Discovered</span>
              <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "4px 0 0", color: colors.text }}>
                7-Day Discovery Activity
              </h2>
            </div>
            <Badge variant="info" dot>LIVE</Badge>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "4px", height: "200px" }}>
            {dayCounts.map((count, i) => (
              <div key={days[i]} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flex: 1 }}>
                <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: i === todayIndex ? colors.primary : colors.textMuted }}>
                  {count}
                </span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: "32px",
                    borderRadius: "4px 4px 0 0",
                    height: `${Math.max(8, (count / maxCount) * 160)}px`,
                    background: i === todayIndex ? colors.primaryContainer : "rgba(139, 92, 246, 0.2)",
                    boxShadow: i === todayIndex ? "0 0 12px rgba(139, 92, 246, 0.2)" : "none",
                    transition: "background 150ms",
                  }}
                />
                <span style={{ fontSize: "10px", fontWeight: 700, color: i === todayIndex ? colors.primary : colors.textMuted }}>
                  {days[i]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Activity Feed */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <History size={20} style={{ color: colors.primary }} />
            <span style={labelStyle}>Recent Activity</span>
          </div>
          <div style={{ overflowY: "auto", maxHeight: "280px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {recentEvents.length === 0 ? (
              <p style={{ color: colors.textMuted, fontSize: "13px", padding: "16px 0" }}>No recent activity</p>
            ) : (
              recentEvents.map((event, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "12px",
                    paddingLeft: "12px",
                    borderLeft: `2px solid ${event.active ? colors.primaryContainer : colors.border}`,
                    opacity: i > 5 ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <span style={{ fontSize: "13px", lineHeight: 1.4, color: colors.text }}>{event.text}</span>
                    <span style={{ fontSize: "10px", marginTop: "2px", textTransform: "uppercase", color: colors.textMuted }}>
                      {event.time} · {event.meta}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Row: Campaigns + Reports + System Health */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {/* Campaigns Summary */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={labelStyle}>Campaigns</span>
            <BarChart3 size={16} style={{ color: colors.textMuted }} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.text, marginBottom: "8px" }}>
            {campaigns?.length ?? 0}
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
            <span style={{ color: colors.success }}>
              ● {(campaigns?.filter((c) => c.status === "active").length ?? 0)} Active
            </span>
            <span style={{ color: colors.textMuted }}>
              ○ {(campaigns?.filter((c) => c.status === "completed").length ?? 0)} Completed
            </span>
          </div>
          <button
            onClick={() => navigate("/campaigns")}
            style={{
              marginTop: "12px",
              width: "100%",
              padding: "6px",
              background: "transparent",
              border: `1px solid ${colors.border}`,
              borderRadius: "4px",
              color: colors.textMuted,
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHigh)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            View Campaigns
          </button>
        </Card>

        {/* Reports Summary */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={labelStyle}>Reports</span>
            <CheckCircle size={16} style={{ color: colors.textMuted }} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.text, marginBottom: "8px" }}>
            {reports?.total ?? 0}
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted }}>
            {reports?.items?.filter((r) => r.status === "completed").length ?? 0} completed
          </div>
        </Card>

        {/* System Health */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={labelStyle}>System Health</span>
            <Gauge size={16} style={{ color: colors.textMuted }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: colors.success, boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Operational</span>
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {monitor?.services?.slice(0, 4).map((svc) => (
              <span
                key={svc.name}
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  background: "var(--sx-surface-high)",
                  color: colors.textMuted,
                }}
              >
                {svc.name}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
