import { useEffect, useState } from "react";

import { api, type Lead, type LeadStatus } from "@/lib/api";

const STATUSES: LeadStatus[] = [
  "new",
  "queued",
  "auditing",
  "audited",
  "enriched",
  "contacted",
  "replied",
  "won",
  "rejected",
  "error",
];

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = status === "all" ? {} : { status };
      const response = await api.listLeads({ ...params, limit: 100 });
      setLeads(response.items);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function triggerAudit(lead: Lead) {
    setBusy(lead.id);
    try {
      await api.triggerAudit(lead.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function triggerCloser(lead: Lead) {
    setBusy(lead.id);
    try {
      await api.triggerCloser(lead.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="page-title">LEADS GRID</h2>

      <div className="panel">
        <div className="panel-header">
          <h3>FILTROS</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus | "all")}
              style={selectStyle}
            >
              <option value="all">todos</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn ghost" onClick={() => load()}>
              refresh
            </button>
          </div>
        </div>
        <div className="panel-body">
          {error ? (
            <div className="empty">{error}</div>
          ) : loading ? (
            <div className="empty">scanning…</div>
          ) : leads.length === 0 ? (
            <div className="empty">Sin resultados</div>
          ) : (
            <table className="console">
              <thead>
                <tr>
                  <th>Dominio</th>
                  <th>Empresa</th>
                  <th>Status</th>
                  <th>LH</th>
                  <th>SSL</th>
                  <th>Mobile</th>
                  <th>Load</th>
                  <th>Email</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <a href={lead.url} target="_blank" rel="noreferrer noopener">
                        {lead.normalized_domain}
                      </a>
                    </td>
                    <td>{lead.company_name ?? "—"}</td>
                    <td>
                      <span className="badge">{lead.status}</span>
                    </td>
                    <td>{lead.lighthouse_score ?? "—"}</td>
                    <td>{lead.has_ssl === null ? "—" : lead.has_ssl ? "yes" : "no"}</td>
                    <td>{lead.mobile_friendly === null ? "—" : lead.mobile_friendly ? "yes" : "no"}</td>
                    <td>{lead.load_time_ms ? `${lead.load_time_ms} ms` : "—"}</td>
                    <td>{lead.email ?? "—"}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn ghost"
                        disabled={busy === lead.id}
                        onClick={() => triggerAudit(lead)}
                      >
                        audit
                      </button>
                      <button
                        className="btn"
                        disabled={busy === lead.id}
                        onClick={() => triggerCloser(lead)}
                      >
                        closer
                      </button>
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

const selectStyle: React.CSSProperties = {
  background: "rgba(7, 9, 26, 0.85)",
  color: "var(--void-text)",
  border: "1px solid var(--void-border-strong)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 12px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 11,
};
