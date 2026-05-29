import {
  TrendingUp,
  ArrowUpRight,
  History,
  Search,
  ClipboardCheck,
  Handshake,
  Target,
  Globe,
} from "lucide-react";

/* ── Mock Data ── */
const ACTIVITIES = [
  { text: "New lead captured via Apex-Monitor", time: "12:44:02", meta: "CID_8892", active: true },
  { text: "Campaign sync completed", time: "12:30:15", meta: "Global-X", active: false },
  { text: "Module 'Sniper' re-indexed 4,200 nodes", time: "12:15:58", meta: "Core-Process", active: false },
  { text: "API Key rotation successful", time: "11:45:00", meta: "Security-Log", active: false },
  { text: "Database backup initiated", time: "11:00:00", meta: "System", active: false, dim: true },
];

const SYSTEM_NODES = [
  { name: "Scout", status: "Operational", icon: Search },
  { name: "Auditor", status: "Online", icon: ClipboardCheck },
  { name: "Closer", status: "Online", icon: Handshake },
  { name: "Sniper", status: "Active", icon: Target },
];

const CHART_BARS = [
  { day: "MON", height: 96, active: false },
  { day: "TUE", height: 128, active: false },
  { day: "WED", height: 112, active: false },
  { day: "THU", height: 160, active: false },
  { day: "FRI", height: 208, active: true, tooltip: "184 Leads", sub: "Friday Peak" },
  { day: "SAT", height: 144, active: false },
  { day: "SUN", height: 120, active: false },
];

/* ── Styles ── */
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

export function DashboardPage() {
  return (
    <section className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Leads" value="1,247" change="+12%" icon={<TrendingUp className="w-4 h-4" />} progress={72} />
        <StatCard label="Active Campaigns" value="14" change="Max Capacity" progress={58} />
        <StatCard label="Conversion Rate" value="4.2%" change="+0.8%" icon={<ArrowUpRight className="w-4 h-4" />} progress={42} />
        <StatCard label="Sites Monitored" value="86" change="98% Uptime" progress={86} />
      </div>

      {/* Middle Row: Chart + Activity */}
      <div className="grid grid-cols-12 gap-6">
        {/* Chart */}
        <div className="col-span-12 lg:col-span-8 p-5" style={surfaceCard}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <span style={labelStyle}>Leads Extraction Engine</span>
              <h2 className="text-lg font-semibold mt-1" style={{ color: "var(--sx-text)" }}>
                7-Day Performance
              </h2>
            </div>
            <span
              className="text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider"
              style={{
                background: "var(--sx-primary-soft)",
                color: "var(--sx-primary)",
                borderColor: "rgba(139, 92, 246, 0.2)",
              }}
            >
              LIVE STREAM
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 pb-4" style={{ height: 240 }}>
            {CHART_BARS.map((bar) => (
              <div key={bar.day} className="flex flex-col items-center gap-2 relative group flex-1">
                {bar.active && (
                  <div
                    className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded z-10 flex flex-col items-center"
                    style={{
                      background: "var(--sx-primary-container)",
                      color: "#fff",
                    }}
                  >
                    <span className="font-bold text-sm">{bar.tooltip}</span>
                    <span className="text-[9px] uppercase font-bold opacity-80">{bar.sub}</span>
                    <div
                      className="absolute top-full left-1/2 -translate-x-1/2"
                      style={{
                        borderWidth: 8,
                        borderStyle: "solid",
                        borderColor: "var(--sx-primary-container) transparent transparent transparent",
                      }}
                    />
                  </div>
                )}
                <div
                  className="w-8 rounded-t-sm transition-colors"
                  style={{
                    height: bar.height,
                    background: bar.active
                      ? "var(--sx-primary-container)"
                      : "rgba(139, 92, 246, 0.2)",
                    boxShadow: bar.active ? "0 0 12px rgba(139, 92, 246, 0.2)" : "none",
                  }}
                />
                <span
                  className="text-[10px] font-bold"
                  style={{ color: bar.active ? "var(--sx-primary)" : "var(--sx-text-muted)" }}
                >
                  {bar.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="col-span-12 lg:col-span-4 p-5 flex flex-col" style={surfaceCard}>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5" style={{ color: "var(--sx-primary)" }} />
            <h2 style={labelStyle}>Recent Activity</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2" style={{ maxHeight: 320 }}>
            {ACTIVITIES.map((a, i) => (
              <div
                key={i}
                className="flex gap-4 pl-4 py-1"
                style={{
                  borderLeftWidth: 2,
                  borderLeftStyle: "solid",
                  borderLeftColor: a.active ? "var(--sx-primary-container)" : "var(--sx-border)",
                  opacity: a.dim ? 0.5 : 1,
                }}
              >
                <div className="flex flex-col flex-1">
                  <span className="text-sm leading-tight" style={{ color: "var(--sx-text)" }}>
                    {a.text}
                  </span>
                  <span className="text-[10px] mt-1 uppercase" style={{ color: "var(--sx-text-muted)" }}>
                    {a.time} · {a.meta}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button
            className="mt-6 w-full py-2 border text-[10px] uppercase font-bold transition-colors"
            style={{
              borderColor: "var(--sx-border)",
              color: "var(--sx-text-muted)",
              borderRadius: "var(--radius-sm)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sx-surface-high)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            View Full System Logs
          </button>
        </div>
      </div>

      {/* System Health Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {SYSTEM_NODES.map((node) => {
          const Icon = node.icon;
          return (
            <div
              key={node.name}
              className="p-5 flex items-center justify-between group transition-colors cursor-pointer"
              style={{
                ...surfaceCard,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--sx-border)";
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded border transition-colors"
                  style={{
                    background: "var(--sx-surface-high)",
                    borderColor: "var(--sx-border)",
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: "var(--sx-text-secondary)" }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold" style={{ color: "var(--sx-text)" }}>
                    {node.name}
                  </span>
                  <span className="text-[10px] uppercase font-bold" style={{ color: "var(--sx-primary)" }}>
                    {node.status}
                  </span>
                </div>
              </div>
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: "var(--sx-primary-container)",
                  boxShadow: "0 0 12px rgba(139, 92, 246, 0.2)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom Row: Resources + Global Sync */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 flex flex-col gap-4" style={surfaceCard}>
          <div className="flex justify-between items-center">
            <span style={labelStyle}>Resource Allocation</span>
            <span className="text-[10px] font-mono" style={{ color: "var(--sx-text-muted)" }}>
              NODE_772A
            </span>
          </div>
          <div className="space-y-4">
            <ResourceBar label="CPU USAGE" value="24.2%" percent={24.2} />
            <ResourceBar label="MEMORY LOAD" value="6.8 GB / 32 GB" percent={21} />
          </div>
        </div>

        <div className="p-5 flex items-center gap-6" style={surfaceCard}>
          <div
            className="w-32 h-20 rounded border flex items-center justify-center"
            style={{ background: "var(--sx-surface-high)", borderColor: "var(--sx-border)" }}
          >
            <Globe className="w-10 h-10" style={{ color: "var(--sx-text-muted)", opacity: 0.4 }} />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <span style={labelStyle}>Global Sync Status</span>
            <p className="text-sm leading-tight" style={{ color: "var(--sx-text)" }}>
              All 14 campaign edge-nodes are currently synchronized with the primary command center in Amsterdam.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge label="Lat: 12ms" />
              <Badge label="Loss: 0.00%" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Sub-components ── */

function StatCard({
  label,
  value,
  change,
  icon,
  progress,
}: {
  label: string;
  value: string;
  change: string;
  icon?: React.ReactNode;
  progress: number;
}) {
  return (
    <div className="p-5 flex flex-col gap-1 transition-colors" style={surfaceCard}>
      <span style={labelStyle}>{label}</span>
      <div className="flex items-end justify-between">
        <span
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--sx-primary)", fontFamily: "var(--font-display)" }}
        >
          {value}
        </span>
        <span
          className="text-xs font-bold flex items-center gap-1 mb-1"
          style={{ color: icon ? "var(--sx-primary)" : "var(--sx-text-muted)" }}
        >
          {change} {icon}
        </span>
      </div>
      <div className="w-full h-1 mt-2" style={{ background: "var(--sx-surface-high)", borderRadius: 1 }}>
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: "var(--sx-primary-container)",
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
}

function ResourceBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span style={{ color: "var(--sx-text-secondary)" }}>{label}</span>
        <span className="font-bold" style={{ color: "var(--sx-primary)" }}>{value}</span>
      </div>
      <div className="w-full h-1 overflow-hidden" style={{ background: "var(--sx-surface-high)", borderRadius: 1 }}>
        <div
          className="h-full"
          style={{ width: `${percent}%`, background: "var(--sx-primary-container)", borderRadius: 1 }}
        />
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span
      className="text-[9px] px-2 py-0.5 rounded border uppercase"
      style={{
        background: "var(--sx-surface-high)",
        borderColor: "var(--sx-border)",
        color: "var(--sx-text)",
      }}
    >
      {label}
    </span>
  );
}
