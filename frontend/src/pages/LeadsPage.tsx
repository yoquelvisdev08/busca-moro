import { useState } from "react";
import {
  TrendingUp,
  Zap,
  Filter,
  ArrowUpDown,
  Pencil,
  FolderInput,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ── Mock Data ── */
const STATS = [
  { label: "Total Leads", value: "1,247", sub: "+12% this week", subIcon: <TrendingUp className="w-3.5 h-3.5" />, subColor: "#4ade80" },
  { label: "Processed", value: "892", progress: 71 },
  { label: "Segment A", value: "342", sub: "Active campaigns: 03" },
  { label: "Conversion Rate", value: "4.2%", sub: "Peak performance", subIcon: <Zap className="w-3.5 h-3.5" />, subColor: "var(--sx-tertiary)" },
];

const LEADS = [
  {
    id: "1",
    domain: "stripe.com",
    company: "Stripe, Inc.",
    score: 98,
    segment: "Fintech",
    status: "active",
    statusColor: "#4ade80",
  },
  {
    id: "2",
    domain: "figma.com",
    company: "Figma",
    score: 82,
    segment: "SaaS",
    status: "pending",
    statusColor: "var(--sx-tertiary)",
  },
  {
    id: "3",
    domain: "vercel.app",
    company: "Vercel Inc.",
    score: 91,
    segment: "DevTools",
    status: "unprocessed",
    statusColor: "var(--sx-text-muted)",
  },
  {
    id: "4",
    domain: "notion.so",
    company: "Notion Labs",
    score: 76,
    segment: "SaaS",
    status: "active",
    statusColor: "#4ade80",
  },
];

const FILTER_CHIPS = ["All", "Segment A", "Segment B", "Unprocessed"];

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

export function LeadsPage() {
  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--sx-text)" }}>
            Leads
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--sx-text-muted)" }}>
            Manage and qualify prospects
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors flex items-center gap-2"
            style={{
              background: "var(--sx-surface-high)",
              borderColor: "var(--sx-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--sx-text)",
            }}
          >
            Export
          </button>
          <button
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2"
            style={{
              background: "var(--sx-primary-container)",
              borderRadius: "var(--radius-sm)",
              color: "#fff",
            }}
          >
            Import CSV
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {STATS.map((s) => (
          <div key={s.label} className="p-5 flex flex-col gap-1" style={surfaceCard}>
            <p style={labelStyle}>{s.label}</p>
            <h3 className="text-2xl font-bold tracking-tight" style={{ color: "var(--sx-text)" }}>
              {s.value}
            </h3>
            {s.sub && (
              <p className="text-[10px] font-bold mt-1 flex items-center gap-1" style={{ color: s.subColor || "var(--sx-text-muted)" }}>
                {s.subIcon}
                {s.sub}
              </p>
            )}
            {s.progress && (
              <div className="w-full h-1 mt-2 rounded-full" style={{ background: "var(--sx-surface-high)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.progress}%`, background: "var(--sx-primary-container)" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between p-2" style={surfaceCard}>
        <div className="flex gap-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className="px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                background: activeFilter === chip ? "var(--sx-secondary-container)" : "transparent",
                color: activeFilter === chip ? "var(--sx-secondary)" : "var(--sx-text-muted)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pr-2">
          <button className="p-1.5 transition-colors" style={{ color: "var(--sx-text-muted)" }}>
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-1.5 transition-colors" style={{ color: "var(--sx-text-muted)" }}>
            <ArrowUpDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ ...surfaceCard, overflow: "hidden" }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: "var(--sx-bg-lower)" }}>
              {["Domain", "Company Name", "Score", "Segment", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider ${h === "Score" ? "text-center" : ""} ${h === "Actions" ? "text-right" : ""}`}
                  style={{ color: "var(--sx-text-muted)", borderBottom: "1px solid var(--sx-border)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEADS.map((lead) => (
              <tr
                key={lead.id}
                className="group transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sx-surface-high)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                style={{ borderBottom: "1px solid var(--sx-border)" }}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center p-1 border"
                      style={{ background: "#fff", borderColor: "var(--sx-border)" }}
                    >
                      <span className="text-[10px] font-bold text-black">{lead.domain[0].toUpperCase()}</span>
                    </div>
                    <span className="font-mono text-sm" style={{ color: "var(--sx-text)" }}>
                      {lead.domain}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm" style={{ color: "var(--sx-text)" }}>
                  {lead.company}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                    style={{
                      background: lead.score >= 90 ? "var(--sx-secondary-container)" : "var(--sx-surface-high)",
                      color: lead.score >= 90 ? "var(--sx-secondary)" : "var(--sx-text-muted)",
                    }}
                  >
                    {lead.score}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className="text-[10px] border px-2 py-0.5 rounded"
                    style={{ borderColor: "var(--sx-border)", color: "var(--sx-text-muted)" }}
                  >
                    {lead.segment}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: lead.statusColor }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--sx-text)" }}>
                      {lead.status}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <ActionIcon icon={<Pencil className="w-4 h-4" />} />
                    <ActionIcon icon={<FolderInput className="w-4 h-4" />} />
                    <ActionIcon icon={<Trash2 className="w-4 h-4" />} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <footer className="flex items-center justify-between pt-4 pb-8">
        <p className="text-xs" style={{ color: "var(--sx-text-muted)" }}>
          Showing 1 to 4 of 1,247 results
        </p>
        <div className="flex items-center gap-1">
          <button
            className="p-2 border rounded transition-colors"
            style={{ borderColor: "var(--sx-border)", color: "var(--sx-text-muted)" }}
            disabled
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="px-3.5 py-1.5 rounded text-xs font-semibold"
            style={{ background: "var(--sx-primary-container)", color: "#fff" }}
          >
            1
          </button>
          <button
            className="px-3.5 py-1.5 rounded text-xs font-semibold transition-colors"
            style={{ color: "var(--sx-text-muted)" }}
          >
            2
          </button>
          <button
            className="px-3.5 py-1.5 rounded text-xs font-semibold transition-colors"
            style={{ color: "var(--sx-text-muted)" }}
          >
            3
          </button>
          <span className="px-2" style={{ color: "var(--sx-text-muted)" }}>...</span>
          <button
            className="px-3.5 py-1.5 rounded text-xs font-semibold transition-colors"
            style={{ color: "var(--sx-text-muted)" }}
          >
            125
          </button>
          <button
            className="p-2 border rounded transition-colors"
            style={{ borderColor: "var(--sx-border)", color: "var(--sx-text-muted)" }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}

function ActionIcon({ icon, danger }: { icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      className="p-1 transition-colors"
      style={{ color: "var(--sx-text-muted)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = danger ? "var(--sx-danger)" : "var(--sx-primary)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sx-text-muted)")}
    >
      {icon}
    </button>
  );
}
