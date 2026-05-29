import {
  Plus,
  MoreVertical,
  Mail,
  FileText,
  PlusSquare,
  Pencil,
  Trash2,
} from "lucide-react";

/* ── Mock Data ── */
const CAMPAIGNS = [
  {
    name: "Enterprise Q4 Reach",
    status: "Active" as const,
    leads: "1,240",
    emailsSent: "8,500",
    openRate: 64.2,
    clickRate: "12.8%",
  },
  {
    name: "Scale-Up SaaS Alpha",
    status: "Paused" as const,
    leads: "452",
    emailsSent: "1,120",
    openRate: 48.0,
    clickRate: "5.4%",
  },
  {
    name: "Cold Outreach - Fintech",
    status: "Completed" as const,
    leads: "2,800",
    emailsSent: "15,420",
    openRate: 72.1,
    clickRate: "21.3%",
  },
];

const TEMPLATES = [
  {
    name: "Intro - Solution Deck",
    subject: '"Hi {{first_name}}, a quick question regarding your infrastructure..."',
    modified: "Modified 2 days ago",
    active: true,
  },
  {
    name: "Follow-up: 3 Day Bump",
    subject: '"Following up on our last conversation about..."',
    modified: "Draft",
    active: false,
  },
  {
    name: "Closing: Partner Program",
    subject: '"Final call for our Q4 SIPHON-X Partner Program perks"',
    modified: "Modified 1 week ago",
    active: true,
  },
];

const surfaceCard = {
  background: "var(--sx-surface)",
  border: "1px solid var(--sx-border)",
  borderRadius: "var(--radius-md)",
};

export function CampaignsPage() {
  return (
    <section className="space-y-8">
      {/* Campaign Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {CAMPAIGNS.map((camp) => (
          <div
            key={camp.name}
            className="p-6 transition-colors group"
            style={surfaceCard}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--sx-border)")}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold mb-1" style={{ color: "var(--sx-text)" }}>
                  {camp.name}
                </h3>
                <CampaignStatusBadge status={camp.status} />
              </div>
              <button
                className="transition-colors"
                style={{ color: "var(--sx-text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sx-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sx-text-muted)")}
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--sx-text-muted)", opacity: 0.6 }}>
                  Leads
                </p>
                <p className="text-xl font-bold" style={{ color: "var(--sx-text)" }}>
                  {camp.leads}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--sx-text-muted)", opacity: 0.6 }}>
                  Emails Sent
                </p>
                <p className="text-xl font-bold" style={{ color: "var(--sx-text)" }}>
                  {camp.emailsSent}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <p className="text-[11px] font-medium" style={{ color: "var(--sx-text-muted)" }}>
                    Open Rate
                  </p>
                  <p className="text-[11px] font-bold" style={{ color: "var(--sx-primary)" }}>
                    {camp.openRate}%
                  </p>
                </div>
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "var(--sx-surface-high)" }}>
                  <div
                    className="h-full"
                    style={{ width: `${camp.openRate}%`, background: "var(--sx-primary-container)" }}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <p className="text-[11px] font-medium" style={{ color: "var(--sx-text-muted)" }}>
                  Click Rate
                </p>
                <p className="text-[11px] font-bold" style={{ color: "var(--sx-text)" }}>
                  {camp.clickRate}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Campaign Button (full width on mobile) */}
      <div className="flex justify-end">
        <button
          className="px-5 py-2.5 flex items-center gap-2 text-sm font-semibold transition-all"
          style={{
            background: "var(--sx-primary-container)",
            borderRadius: "var(--radius-sm)",
            color: "#fff",
          }}
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Email Templates Section */}
      <div style={{ ...surfaceCard, overflow: "hidden" }}>
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--sx-border)" }}>
          <h3 className="text-lg font-bold" style={{ color: "var(--sx-text)" }}>
            Email Templates
          </h3>
          <button className="text-sm font-medium flex items-center gap-2 hover:underline" style={{ color: "var(--sx-primary)" }}>
            <PlusSquare className="w-4 h-4" />
            Create Template
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "rgba(44, 40, 50, 0.3)" }}>
                {["Template Name", "Subject Line Preview", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-4 text-[10px] font-bold uppercase tracking-widest ${h === "Actions" ? "text-right" : ""}`}
                    style={{ color: "var(--sx-text-muted)", opacity: 0.6 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEMPLATES.map((t, i) => (
                <tr
                  key={i}
                  className="group transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(55, 51, 61, 0.4)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  style={{ borderBottom: "1px solid var(--sx-border)" }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {t.active ? (
                        <Mail className="w-5 h-5" style={{ color: "var(--sx-primary)" }} />
                      ) : (
                        <FileText className="w-5 h-5" style={{ color: "var(--sx-tertiary)" }} />
                      )}
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--sx-text)" }}>
                          {t.name}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--sx-text-muted)", opacity: 0.7 }}>
                          {t.modified}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm italic" style={{ color: "var(--sx-text-muted)" }}>
                    {t.subject}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-2 rounded transition-colors"
                        style={{ color: "var(--sx-text-muted)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--sx-primary)";
                          e.currentTarget.style.background = "var(--sx-primary-soft)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--sx-text-muted)";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded transition-colors"
                        style={{ color: "var(--sx-text-muted)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--sx-danger)";
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--sx-text-muted)";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-8 pb-4" style={{ color: "var(--sx-text-muted)", opacity: 0.4 }}>
        <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--sx-success)" }} />
            System Online
          </div>
          <div>Last Sync: 12:42:01 UTC</div>
        </div>
        <div className="text-[11px] font-bold uppercase tracking-widest">v2.4.0-STABLE</div>
      </div>
    </section>
  );
}

function CampaignStatusBadge({ status }: { status: "Active" | "Paused" | "Completed" }) {
  const config = {
    Active: {
      bg: "rgba(139, 92, 246, 0.1)",
      color: "var(--sx-primary)",
      border: "rgba(139, 92, 246, 0.2)",
    },
    Paused: {
      bg: "var(--sx-surface-high)",
      color: "var(--sx-text-muted)",
      border: "var(--sx-border)",
    },
    Completed: {
      bg: "rgba(202, 128, 30, 0.1)",
      color: "var(--sx-tertiary)",
      border: "rgba(202, 128, 30, 0.2)",
    },
  };

  const c = config[status];

  return (
    <span
      className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded border"
      style={{ background: c.bg, color: c.color, borderColor: c.border }}
    >
      {status}
    </span>
  );
}
