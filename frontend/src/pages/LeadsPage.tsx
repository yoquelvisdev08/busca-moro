import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Sparkles, CheckSquare, Square, Filter, X } from "lucide-react";

import { api, type Lead, type LeadStatus } from "@/lib/api";

const STATUSES: LeadStatus[] = [
  "new", "queued", "auditing", "audited", "enriched",
  "contacted", "replied", "won", "rejected", "error",
];

const SEGMENTS = ["A", "B", "C", "D"] as const;

type SortField = "score" | "lighthouse_score" | "load_time_ms" | "discovered_at" | "normalized_domain";
type SortDirection = "asc" | "desc";

interface Filters {
  status: LeadStatus | "all";
  segment: string | "all";
  minScore: number;
  search: string;
}

export function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({
    status: "all",
    segment: "all",
    minScore: 0,
    search: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["leads", page, pageSize, sortField, sortDir, filters],
    queryFn: () => api.listLeads({
      limit: pageSize,
      offset: page * pageSize,
      status: filters.status === "all" ? undefined : filters.status,
    }),
  });

  const triggerAudit = useMutation({
    mutationFn: (leadId: string) => api.triggerAudit(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Auditoría encolada correctamente");
    },
    onError: (err) => toast.error(`Error: ${(err as Error).message}`),
  });

  const triggerCloser = useMutation({
    mutationFn: (leadId: string) => api.triggerCloser(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Closer activado — inteligencia en proceso");
    },
    onError: (err) => toast.error(`Error: ${(err as Error).message}`),
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const leads = data?.items ?? [];
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map(l => l.id)));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredLeads = useMemo(() => {
    let items = data?.items ?? [];
    
    // Search filter (client-side for now)
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(l =>
        l.normalized_domain.toLowerCase().includes(q) ||
        (l.company_name?.toLowerCase().includes(q)) ||
        (l.email?.toLowerCase().includes(q))
      );
    }
    
    // Segment filter
    if (filters.segment !== "all") {
      items = items.filter(l => l.segment === filters.segment);
    }
    
    // Min score filter
    if (filters.minScore > 0) {
      items = items.filter(l => (l.score ?? 0) >= filters.minScore);
    }
    
    // Sort
    items.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "score": aVal = a.score ?? 0; bVal = b.score ?? 0; break;
        case "lighthouse_score": aVal = a.lighthouse_score ?? 0; bVal = b.lighthouse_score ?? 0; break;
        case "load_time_ms": aVal = a.load_time_ms ?? 0; bVal = b.load_time_ms ?? 0; break;
        case "discovered_at": aVal = a.discovered_at ?? ""; bVal = b.discovered_at ?? ""; break;
        case "normalized_domain": aVal = a.normalized_domain ?? ""; bVal = b.normalized_domain ?? ""; break;
        default: aVal = 0; bVal = 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    
    return items;
  }, [data?.items, filters, sortField, sortDir]);

  const isRecent = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    return (now.getTime() - date.getTime()) < 24 * 60 * 60 * 1000;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="opacity-30 ml-1">↕</span>;
    return sortDir === "asc" ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />;
  };

  const SegmentBadge = ({ segment }: { segment: string | null }) => {
    const colors: Record<string, string> = {
      A: "bg-red-500-20 text-red-400 border-red-500-30",
      B: "bg-orange-500-20 text-orange-400 border-orange-500-30",
      C: "bg-yellow-500-20 text-yellow-400 border-yellow-500-30",
      D: "bg-gray-500-20 text-gray-400 border-gray-500-30",
    };
    if (!segment) return <span className="text-gray-500">—</span>;
    return <span className={`px-1_5 py-0_5 text-xs font-mono border rounded ${colors[segment] ?? colors.D}`}>{segment}</span>;
  };

  return (
    <section>
      <h2 className="page-title">LEADS GRID</h2>

      {/* Toolbar */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-1_2 -translate-y-1_2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por dominio, empresa o email..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-8 pr-3 py-1.5 bg-void-panel-deep border border-void-border-strong rounded-md text-sm text-void-text placeholder-gray-500 focus-outline-none focus-border-cyan"
              />
            </div>
            {/* Filter toggle */}
            <button
              className={`btn ghost flex items-center gap-1 ${showFilters ? "active" : ""}`}
              onClick={() => setShowFilters(prev => !prev)}
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            <button className="btn ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}>
              Refresh
            </button>
          </div>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="px-4 py-3 border-t border-void-border flex gap-4 items-center flex-wrap">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as LeadStatus | "all" }))}
                className="bg-void-panel-deep border border-void-border-strong rounded px-2 py-1 text-xs text-void-text"
              >
                <option value="all">todos</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Segmento</label>
              <select
                value={filters.segment}
                onChange={(e) => setFilters(prev => ({ ...prev, segment: e.target.value }))}
                className="bg-void-panel-deep border border-void-border-strong rounded px-2 py-1 text-xs text-void-text"
              >
                <option value="all">todos</option>
                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Score mínimo</label>
              <input
                type="number"
                min={0}
                max={100}
                value={filters.minScore}
                onChange={(e) => setFilters(prev => ({ ...prev, minScore: parseInt(e.target.value) || 0 }))}
                className="w-20 bg-void-panel-deep border border-void-border-strong rounded px-2 py-1 text-xs text-void-text"
              />
            </div>
            <button
              className="btn ghost text-xs mt-4"
              onClick={() => setFilters({ status: "all", segment: "all", minScore: 0, search: "" })}
            >
              <X className="w-3 h-3 inline mr-1" />
              Limpiar
            </button>
          </div>
        )}

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="px-4 py-2 bg-void-cyan-10 border-t border-void-cyan-30 flex items-center gap-3">
            <span className="text-xs text-void-cyan font-mono">{selected.size} seleccionado(s)</span>
            <button
              className="btn ghost text-xs"
              onClick={() => {
                toast.error("Bulk actions require API endpoint /v1/leads/bulk — implement in Phase 4");
              }}
            >
              Marcar contactados
            </button>
            <button
              className="btn ghost text-xs"
              onClick={() => {
                setSelected(new Set());
                toast.success("Selección limpiada");
              }}
            >
              Deseleccionar
            </button>
          </div>
        )}

        {/* Table */}
        <div className="panel-body">
          {error ? (
            <div className="empty">{(error as Error).message}</div>
          ) : isLoading ? (
            <div className="empty">scanning…</div>
          ) : filteredLeads.length === 0 ? (
            <div className="empty">Sin resultados</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="console w-full">
                  <thead>
                    <tr>
                      <th className="w-8">
                        <button onClick={toggleSelectAll}>
                          {selected.size === (data?.items?.length ?? 0) && selected.size > 0
                            ? <CheckSquare className="w-4 h-4" />
                            : <Square className="w-4 h-4" />
                          }
                        </button>
                      </th>
                      <th className="w-12">Shot</th>
                      <th onClick={() => handleSort("normalized_domain")} className="cursor-pointer select-none">
                        Dominio <SortIcon field="normalized_domain" />
                      </th>
                      <th>Empresa</th>
                      <th>Segmento</th>
                      <th>Status</th>
                      <th onClick={() => handleSort("score")} className="cursor-pointer select-none">
                        Score <SortIcon field="score" />
                      </th>
                      <th onClick={() => handleSort("lighthouse_score")} className="cursor-pointer select-none">
                        LH <SortIcon field="lighthouse_score" />
                      </th>
                      <th>SSL</th>
                      <th>Mobile</th>
                      <th onClick={() => handleSort("load_time_ms")} className="cursor-pointer select-none">
                        Load <SortIcon field="load_time_ms" />
                      </th>
                      <th>Email</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className={`${selected.has(lead.id) ? "bg-void-cyan-5" : ""} cursor-pointer`}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleSelect(lead.id)}>
                            {selected.has(lead.id)
                              ? <CheckSquare className="w-4 h-4 text-void-cyan" />
                              : <Square className="w-4 h-4" />
                            }
                          </button>
                        </td>
                        <td>
                          {lead.url ? (
                            <div className="w-10 h-7 rounded overflow-hidden border border-void-border bg-void-bg flex items-center justify-center text-8px text-gray-500">
                              <ExternalLink className="w-3 h-3" />
                            </div>
                          ) : (
                            <div className="w-10 h-7 rounded border border-void-border bg-void-bg" />
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <a
                              href={lead.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              onClick={(e) => e.stopPropagation()}
                              className="text-void-cyan hover-underline"
                            >
                              {lead.normalized_domain}
                            </a>
                            {isRecent(lead.discovered_at) && (
                              <Sparkles className="w-3 h-3 text-yellow-400" />
                            )}
                          </div>
                        </td>
                        <td>{lead.company_name ?? "—"}</td>
                        <td><SegmentBadge segment={lead.segment} /></td>
                        <td>
                          <span className={`badge ${badgeForStatus(lead.status)}`}>{lead.status}</span>
                        </td>
                        <td className="font-mono">{lead.score}</td>
                        <td className="font-mono">{lead.lighthouse_score ?? "—"}</td>
                        <td>{lead.has_ssl === null ? "—" : lead.has_ssl ? "yes" : "no"}</td>
                        <td>{lead.mobile_friendly === null ? "—" : lead.mobile_friendly ? "yes" : "no"}</td>
                        <td className="font-mono">{lead.load_time_ms ? `${lead.load_time_ms} ms` : "—"}</td>
                        <td className="text-xs">{lead.email ?? "—"}</td>
                        <td onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn ghost"
                            disabled={triggerAudit.isPending}
                            onClick={() => triggerAudit.mutate(lead.id)}
                          >
                            audit
                          </button>
                          <button
                            className="btn"
                            disabled={triggerCloser.isPending}
                            onClick={() => triggerCloser.mutate(lead.id)}
                          >
                            closer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-void-border">
                <span className="text-xs text-gray-400 font-mono">
                  Mostrando {filteredLeads.length} de {data?.total ?? 0} leads
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="btn ghost text-xs"
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-gray-400">
                    Página {page + 1}
                  </span>
                  <button
                    className="btn ghost text-xs"
                    disabled={!data || (data.items.length < pageSize)}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function badgeForStatus(status: Lead["status"]) {
  switch (status) {
    case "audited": case "enriched": return "cyan";
    case "contacted": case "replied": case "won": return "success";
    case "rejected": case "error": return "danger";
    case "queued": case "auditing": return "purple";
    default: return "";
  }
}
