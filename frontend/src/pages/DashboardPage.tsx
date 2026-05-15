import { useEffect, useState } from "react";

import { api, type Lead, type QueueDepths } from "@/lib/api";

interface DashboardState {
  queues: QueueDepths | null;
  leads: Lead[];
  loading: boolean;
  error: string | null;
}

export function DashboardPage() {
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

  return (
    <section>
      <h2 className="page-title">CONTROL DECK</h2>

      <div className="cards">
        <Stat label="Cola Discovery" value={state.queues?.discovery ?? "—"} variant="cyan" />
        <Stat label="Cola Audit" value={state.queues?.audit ?? "—"} variant="purple" />
        <Stat label="Cola Outreach" value={state.queues?.outreach ?? "—"} />
        <Stat label="Alertas Sniper" value={state.queues?.sniper_alerts ?? "—"} variant="warning" />
        <Stat label="Dead Letter" value={state.queues?.dlq ?? "—"} variant="danger" />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>LEADS RECIENTES</h3>
          <span className="badge cyan">{state.loading ? "scanning" : "live"}</span>
        </div>
        <div className="panel-body">
          {state.error ? (
            <div className="empty">{state.error}</div>
          ) : state.leads.length === 0 ? (
            <div className="empty">
              Sin leads aún. Inicia el Scout o publica un lead vía <code>POST /v1/leads</code>.
            </div>
          ) : (
            <table className="console">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Lighthouse</th>
                  <th>Load</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {state.leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <a href={lead.url} target="_blank" rel="noreferrer noopener">
                        {lead.normalized_domain}
                      </a>
                    </td>
                    <td>
                      <span className={`badge ${badgeForStatus(lead.status)}`}>{lead.status}</span>
                    </td>
                    <td>{lead.lighthouse_score ?? "—"}</td>
                    <td>{lead.load_time_ms ? `${lead.load_time_ms} ms` : "—"}</td>
                    <td>{lead.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>STATUS STREAM</h3>
          <span className="badge purple">auto-refresh 8s</span>
        </div>
        <div className="panel-body" style={{ padding: 18 }}>
          <pre className="terminal-box">
            <span className="prompt">{`> `}</span>queues sync :: discovery={state.queues?.discovery ?? 0} audit={state.queues?.audit ?? 0} outreach={state.queues?.outreach ?? 0}
            {`\n`}<span className="prompt">{`> `}</span>leads_in_window :: {state.leads.length}
            {`\n`}<span className="prompt">{`> `}</span>operator :: ready
          </pre>
        </div>
      </div>
    </section>
  );
}

function badgeForStatus(status: Lead["status"]) {
  switch (status) {
    case "audited":
    case "enriched":
      return "cyan";
    case "contacted":
    case "replied":
    case "won":
      return "success";
    case "rejected":
    case "error":
      return "danger";
    case "queued":
    case "auditing":
      return "purple";
    default:
      return "";
  }
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string;
  value: string | number;
  variant?: "cyan" | "purple" | "danger" | "warning";
}) {
  const className = ["card", variant].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
