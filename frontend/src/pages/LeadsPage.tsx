import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Mail,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { useLeads, useTriggerAuditMutation } from "@/lib/hooks";
import type { LeadStatus } from "@/lib/api";
import { Card } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { Select } from "@/design-system/components/Select";
import { Checkbox } from "@/design-system/components/Checkbox";
import { EmptyState } from "@/design-system/components/EmptyState";
import { Spinner } from "@/design-system/components/Spinner";
import { colors } from "@/design-system/tokens";

const SEGMENT_FILTERS = [
  { value: "", label: "All Segments" },
  { value: "A", label: "Segment A" },
  { value: "B", label: "Segment B" },
  { value: "C", label: "Segment C" },
  { value: "D", label: "Segment D" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "queued", label: "Queued" },
  { value: "auditing", label: "Auditing" },
  { value: "audited", label: "Audited" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "error", label: "Error" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "20", label: "20 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

function getStatusBadge(status: LeadStatus): { variant: "success" | "warning" | "info" | "danger" | "neutral"; label: string } {
  const map: Record<string, { variant: "success" | "warning" | "info" | "danger" | "neutral"; label: string }> = {
    new: { variant: "info", label: "New" },
    queued: { variant: "info", label: "Queued" },
    auditing: { variant: "warning", label: "Auditing" },
    audited: { variant: "success", label: "Audited" },
    enriched: { variant: "success", label: "Enriched" },
    contacted: { variant: "success", label: "Contacted" },
    replied: { variant: "success", label: "Replied" },
    interested: { variant: "success", label: "Interested" },
    negotiation: { variant: "warning", label: "Negotiation" },
    closed_won: { variant: "success", label: "Won" },
    closed_lost: { variant: "danger", label: "Lost" },
    won: { variant: "success", label: "Won" },
    rejected: { variant: "danger", label: "Rejected" },
    error: { variant: "danger", label: "Error" },
  };
  return map[status] ?? { variant: "neutral", label: status };
}

function getScoreColor(score: number | null): string {
  if (score == null) return colors.textMuted;
  if (score >= 90) return colors.success;
  if (score >= 50) return colors.warning;
  return colors.danger;
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<"score" | "normalized_domain" | "discovered_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useLeads({
    limit: pageSize,
    offset: page * pageSize,
    ...(statusFilter ? { status: statusFilter as LeadStatus } : {}),
  });

  const triggerAudit = useTriggerAuditMutation();

  /* ── Client-side filtering and sorting ── */
  const filteredLeads = useMemo(() => {
    let items = data?.items ?? [];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (l) =>
          l.normalized_domain?.toLowerCase().includes(q) ||
          l.company_name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q),
      );
    }

    if (segmentFilter) {
      items = items.filter((l) => l.segment === segmentFilter);
    }

    if (sortKey) {
      items = [...items].sort((a, b) => {
        const aVal = a[sortKey] ?? "";
        const bVal = b[sortKey] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return items;
  }, [data?.items, search, segmentFilter, sortKey, sortDir]);

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);
  const allSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAudit = () => {
    if (selectedIds.size === 0) return;
    toast.promise(
      Promise.all([...selectedIds].map((id) => triggerAudit.mutateAsync(id))),
      {
        loading: `Enqueuing ${selectedIds.size} audits...`,
        success: `${selectedIds.size} audits enqueued`,
        error: "Failed to enqueue audits",
      },
    );
  };

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (error) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <p style={{ color: colors.danger }}>Error loading leads: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: "280px", position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: colors.textMuted,
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search by domain, company, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                background: colors.surface,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: "8px",
                fontSize: "13px",
                color: colors.text,
                outline: "none",
                transition: "border-color 150ms",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryContainer; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderStrong; }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: colors.textMuted,
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: "8px" }}>
            <Select
              options={SEGMENT_FILTERS}
              value={segmentFilter}
              onChange={setSegmentFilter}
              placeholder="Segment"
              style={{ minWidth: "140px" }}
            />
            <Select
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as LeadStatus | "")}
              placeholder="Status"
              style={{ minWidth: "140px" }}
            />
          </div>
        </div>

        {/* Quick filter chips */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {["A", "B", "C", "D"].map((seg) => (
            <button
              key={seg}
              onClick={() => setSegmentFilter(segmentFilter === seg ? "" : seg)}
              style={{
                padding: "6px 16px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                cursor: "pointer",
                transition: "all 150ms",
                border: `1px solid ${segmentFilter === seg ? colors.primaryContainer : colors.borderStrong}`,
                background: segmentFilter === seg ? colors.primaryContainer : colors.surfaceHigh,
                color: segmentFilter === seg ? "#fff" : colors.textMuted,
              }}
            >
              Segment {seg}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card padding="0" style={{ overflow: "hidden" }}>
        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(139, 92, 246, 0.08)",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "13px",
              color: colors.text,
            }}
          >
            <span>{selectedIds.size} selected</span>
            <Button size="sm" variant="primary" onClick={handleBulkAudit}>
              Audit Selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {isLoading ? (
          <Spinner style={{ padding: "60px" }} />
        ) : filteredLeads.length === 0 ? (
          <EmptyState
            title="No leads found"
            description={search || segmentFilter || statusFilter ? "Try adjusting your filters" : "Start discovering leads to populate this list"}
          />
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                <thead>
                  <tr style={{ background: colors.bg }}>
                    <th style={thStyle}>
                      <Checkbox checked={allSelected} onChange={toggleSelectAll} />
                    </th>
                    <th style={{ ...thStyle, textAlign: "left", cursor: "pointer" }} onClick={() => handleSort("normalized_domain")}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Domain <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={thStyle}>Segment</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "center", cursor: "pointer" }} onClick={() => handleSort("score")}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                        Score <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={thStyle}>Contact</th>
                    <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => handleSort("discovered_at")}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Discovered <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const sb = getStatusBadge(lead.status);
                    const isSelected = selectedIds.has(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        style={{
                          borderBottom: `1px solid ${colors.border}`,
                          cursor: "pointer",
                          transition: "background 100ms",
                          borderLeft: isSelected ? `3px solid ${colors.primaryContainer}` : "3px solid transparent",
                          ...(isSelected ? { background: "rgba(139, 92, 246, 0.06)" } : {}),
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = colors.surfaceHigh;
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td style={tdStyle} onClick={(e) => { e.stopPropagation(); toggleSelect(lead.id); }}>
                          <Checkbox checked={isSelected} />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <a
                              href={lead.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: colors.primaryContainer,
                                fontWeight: 600,
                                fontSize: "13px",
                                cursor: "pointer",
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                            >
                              {lead.normalized_domain}
                            </a>
                            {lead.company_name && (
                              <span style={{ fontSize: "11px", color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                                {lead.company_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {lead.segment ? (
                            <Badge
                              variant={lead.segment === "A" ? "danger" : lead.segment === "B" ? "warning" : lead.segment === "C" ? "info" : "neutral"}
                            >
                              {lead.segment}
                            </Badge>
                          ) : (
                            <span style={{ color: colors.textMuted, fontSize: "12px" }}>—</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <Badge variant={sb.variant} dot>{sb.label}</Badge>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "14px",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              background: lead.lighthouse_score != null ? "rgba(16, 185, 129, 0.12)" : "transparent",
                              color: getScoreColor(lead.lighthouse_score),
                              border: lead.lighthouse_score != null ? "1px solid rgba(16, 185, 129, 0.3)" : "none",
                            }}
                          >
                            {lead.lighthouse_score ?? "—"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {lead.email ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                color: colors.textMuted,
                                fontFamily: "var(--font-mono)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "160px",
                              }}
                            >
                              <Mail size={12} /> {lead.email}
                            </span>
                          ) : (
                            <span style={{ color: colors.textMuted, fontSize: "12px" }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted }}>
                          {lead.discovered_at ? new Date(lead.discovered_at).toLocaleDateString() : "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`); }}
                              title="View details"
                            >
                              <FileText size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderTop: `1px solid ${colors.border}`,
                background: colors.bg,
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "11px", color: colors.textMuted, fontFamily: "var(--font-mono)" }}>
                  {data?.total ?? 0} total leads
                </span>
                <Select
                  options={PAGE_SIZE_OPTIONS}
                  value={String(pageSize)}
                  onChange={(v) => { setPageSize(Number(v)); setPage(0); }}
                  style={{ minWidth: "110px" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.primaryContainer }}>
                  {page + 1} / {Math.max(1, totalPages)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  borderBottom: `1px solid ${colors.border}`,
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.textMuted,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: colors.text,
};
