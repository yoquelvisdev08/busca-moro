import { useEffect, useState } from "react";

import { api, type SniperTarget } from "@/lib/api";

export function SniperPage() {
  const [targets, setTargets] = useState<SniperTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const items = await api.listSniperTargets();
        if (!cancelled) {
          setTargets(items);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section>
      <h2 className="page-title">UPTIME SNIPER</h2>

      <div className="panel">
        <div className="panel-header">
          <h3>TARGETS ACTIVOS</h3>
          <span className="badge purple">refresh 10s</span>
        </div>
        <div className="panel-body">
          {error ? (
            <div className="empty">{error}</div>
          ) : loading ? (
            <div className="empty">scanning…</div>
          ) : targets.length === 0 ? (
            <div className="empty">Sin targets registrados</div>
          ) : (
            <table className="console">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Label</th>
                  <th>Intervalo</th>
                  <th>Threshold</th>
                  <th>Fails</th>
                  <th>Último code</th>
                  <th>Último check</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <a href={t.url} target="_blank" rel="noreferrer noopener">
                        {t.url}
                      </a>
                    </td>
                    <td>{t.label ?? "—"}</td>
                    <td>{t.interval_seconds}s</td>
                    <td>{t.failure_threshold}</td>
                    <td>
                      <span className={`badge ${t.consecutive_failures > 0 ? "danger" : "success"}`}>
                        {t.consecutive_failures}
                      </span>
                    </td>
                    <td>{t.last_status_code ?? "—"}</td>
                    <td>{t.last_checked_at ?? "—"}</td>
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
