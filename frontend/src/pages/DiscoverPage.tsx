import { useState } from "react";
import {
  Search,
  Tag,
  Rocket,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Cpu,
  Users,
  ArrowRight,
} from "lucide-react";

/* ── Mock Data ── */
const DISCOVERIES = [
  {
    domain: "fintech-nexus.io",
    company: "Nexus Financial Solutions",
    status: "running" as const,
    time: "2 mins ago",
  },
  {
    domain: "cloud-flow.tech",
    company: "CloudFlow Automation",
    status: "completed" as const,
    time: "45 mins ago",
  },
  {
    domain: "secure-node.net",
    company: "SecureNode Cyber",
    status: "failed" as const,
    time: "1 hour ago",
  },
  {
    domain: "atlas-ventures.co",
    company: "Atlas Venture Capital",
    status: "completed" as const,
    time: "3 hours ago",
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

export function DiscoverPage() {
  const [maxResults, setMaxResults] = useState(2500);

  return (
    <section className="space-y-6 max-w-6xl mx-auto">
      {/* Target Configuration Panel */}
      <div className="p-6" style={surfaceCard}>
        <div className="flex items-center gap-2 mb-6">
          <Search className="w-5 h-5" style={{ color: "var(--sx-primary)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--sx-text)" }}>
            Target Configuration
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          {/* Keywords */}
          <div>
            <label style={labelStyle} className="block mb-2">
              Keywords
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--sx-text-muted)" }} />
              <input
                type="text"
                placeholder="e.g., SaaS, Fintech"
                className="w-full py-2 pl-10 pr-3 text-sm outline-none transition-colors"
                style={{
                  background: "var(--sx-bg)",
                  border: "1px solid var(--sx-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--sx-text)",
                }}
              />
            </div>
          </div>

          {/* Industry */}
          <div>
            <label style={labelStyle} className="block mb-2">
              Industry
            </label>
            <select
              className="w-full py-2 px-3 text-sm outline-none appearance-none cursor-pointer"
              style={{
                background: "var(--sx-bg)",
                border: "1px solid var(--sx-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--sx-text)",
              }}
            >
              <option>Software Development</option>
              <option>Financial Services</option>
              <option>Healthcare Tech</option>
              <option>Logistics</option>
            </select>
          </div>

          {/* Geography */}
          <div>
            <label style={labelStyle} className="block mb-2">
              Geography
            </label>
            <select
              className="w-full py-2 px-3 text-sm outline-none appearance-none cursor-pointer"
              style={{
                background: "var(--sx-bg)",
                border: "1px solid var(--sx-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--sx-text)",
              }}
            >
              <option>North America</option>
              <option>Europe</option>
              <option>Asia-Pacific</option>
              <option>Global</option>
            </select>
          </div>

          {/* Start Button */}
          <button
            className="h-[42px] flex items-center justify-center gap-2 text-white text-sm font-semibold transition-all"
            style={{
              background: "var(--sx-primary-container)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <Rocket className="w-4 h-4" />
            Start Discovery
          </button>
        </div>

        {/* Max Results Slider */}
        <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--sx-border)" }}>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label style={labelStyle}>Max Results Limit</label>
              <span className="text-sm font-semibold" style={{ color: "var(--sx-primary)" }}>
                {maxResults.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={10000}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: "var(--sx-surface-high)",
                accentColor: "var(--sx-primary-container)",
              }}
            />
            <div className="flex justify-between text-[10px] uppercase tracking-widest mt-1" style={{ color: "var(--sx-text-muted)" }}>
              <span>100 leads</span>
              <span>10,000 leads</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Discoveries Table */}
      <div style={{ ...surfaceCard, overflow: "hidden" }}>
        <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: "1px solid var(--sx-border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--sx-text)" }}>
            Recent Discoveries
          </h2>
          <button className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: "var(--sx-primary)" }}>
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--sx-surface-high)" }}>
                {["Domain", "Company", "Status", "Timestamp"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--sx-text-muted)", borderBottom: "1px solid var(--sx-border)" }}
                  >
                    {h}
                  </th>
                ))}
                <th
                  className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right"
                  style={{ color: "var(--sx-text-muted)", borderBottom: "1px solid var(--sx-border)" }}
                >
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {DISCOVERIES.map((d, i) => (
                <tr
                  key={i}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid var(--sx-border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sx-surface-high)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-6 py-4 font-mono text-sm" style={{ color: "var(--sx-primary)" }}>
                    {d.domain}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: "var(--sx-text)" }}>
                    {d.company}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-6 py-4 text-right text-sm" style={{ color: "var(--sx-text-muted)" }}>
                    {d.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BentoCard label="Success Rate" value="94.2%" icon={<TrendingUp className="w-5 h-5" />} accent />
        <BentoCard label="Active Crawlers" value="12" icon={<Cpu className="w-5 h-5" />} />
        <BentoCard label="Leads Found (24h)" value="1.8k" icon={<Users className="w-5 h-5" />} />
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: "running" | "completed" | "failed" }) {
  const config = {
    running: {
      bg: "rgba(139, 92, 246, 0.1)",
      color: "var(--sx-primary)",
      border: "rgba(139, 92, 246, 0.2)",
      icon: <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--sx-primary)" }} />,
      text: "Running",
    },
    completed: {
      bg: "rgba(16, 185, 129, 0.1)",
      color: "#4ade80",
      border: "rgba(16, 185, 129, 0.2)",
      icon: <CheckCircle className="w-3 h-3" />,
      text: "Completed",
    },
    failed: {
      bg: "rgba(239, 68, 68, 0.1)",
      color: "#f87171",
      border: "rgba(239, 68, 68, 0.2)",
      icon: <AlertCircle className="w-3 h-3" />,
      text: "Failed",
    },
  };

  const c = config[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border"
      style={{ background: c.bg, color: c.color, borderColor: c.border }}
    >
      {c.icon}
      {c.text}
    </span>
  );
}

function BentoCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="p-6 flex items-center justify-between relative overflow-hidden group"
      style={{
        background: "var(--sx-bg-lower)",
        border: "1px solid var(--sx-border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div className="z-10">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--sx-text-muted)" }}>
          {label}
        </p>
        <h4
          className="text-4xl font-bold tracking-tight"
          style={{ color: accent ? "var(--sx-primary)" : "var(--sx-text)" }}
        >
          {value}
        </h4>
      </div>
      <div
        className="absolute -right-4 bottom-0 select-none"
        style={{
          color: accent ? "rgba(139, 92, 246, 0.1)" : "rgba(231, 224, 237, 0.05)",
          transform: "scale(3)",
        }}
      >
        {icon}
      </div>
    </div>
  );
}
