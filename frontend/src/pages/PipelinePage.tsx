import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LayoutGrid, ChevronDown } from "lucide-react";

import { api, type Lead, type LeadStatus } from "@/lib/api";

const COLUMNS: { id: PipelineColumn; label: string; statuses: LeadStatus[] }[] = [
  { id: "discovery", label: "Discovery", statuses: ["queued", "enriched", "new"] },
  { id: "contacted", label: "Contacted", statuses: ["contacted"] },
  { id: "interested", label: "Interested", statuses: ["interested"] },
  { id: "negotiation", label: "Negotiation", statuses: ["negotiation"] },
  { id: "closed", label: "Closed", statuses: ["closed_won", "closed_lost"] },
];

type PipelineColumn = "discovery" | "contacted" | "interested" | "negotiation" | "closed";

const SEGMENTS = ["all", "A", "B", "C", "D"] as const;

function statusDot(status: LeadStatus) {
  if (status === "closed_won") return "active";
  if (status === "closed_lost" || status === "error") return "error";
  if (status === "interested" || status === "negotiation") return "warning";
  if (status === "contacted") return "warning";
  return "active";
}

function segmentClass(segment: string | null) {
  switch (segment) {
    case "A": return "segment-a";
    case "B": return "segment-b";
    case "C": return "segment-c";
    case "D": return "segment-d";
    default: return "segment-d";
  }
}

function formatActivity(lead: Lead) {
  if (lead.contacted_at) {
    const date = new Date(lead.contacted_at);
    const ago = timeAgo(date);
    return `Contacted ${ago}`;
  }
  if (lead.audited_at) {
    const date = new Date(lead.audited_at);
    const ago = timeAgo(date);
    return `Audited ${ago}`;
  }
  const date = new Date(lead.discovered_at);
  const ago = timeAgo(date);
  return `Discovered ${ago}`;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pipeline-leads"],
    queryFn: () => api.listLeads({ limit: 500 }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: LeadStatus }) =>
      api.updateLead(leadId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
      toast.success("Lead moved");
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });

  const leads = data?.items ?? [];

  const filteredLeads = segmentFilter === "all"
    ? leads
    : leads.filter((l) => l.segment === segmentFilter);

  const columnLeads = (column: PipelineColumn) => {
    const statuses = COLUMNS.find((c) => c.id === column)?.statuses ?? [];
    return filteredLeads.filter((l) => statuses.includes(l.status));
  };

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, columnId: PipelineColumn) => {
    e.preventDefault();
    if (!draggedLead) return;

    const targetStatuses = COLUMNS.find((c) => c.id === columnId)?.statuses ?? [];
    if (targetStatuses.length > 0 && !targetStatuses.includes(draggedLead.status)) {
      // Move to the first status of the target column
      updateStatus.mutate({
        leadId: draggedLead.id,
        status: targetStatuses[0],
      });
    }
    setDraggedLead(null);
  };

  if (isLoading) {
    return (
      <section>
        <h2 className="page-title">Pipeline</h2>
        <div className="empty">Loading pipeline...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 className="page-title">Pipeline</h2>
        <div className="empty">Error: {(error as Error).message}</div>
      </section>
    );
  }

  return (
    <section>
      <div className="pipeline-toolbar">
        <h2 className="page-title" style={{ marginBottom: 0 }}>
          <LayoutGrid className="w-5 h-5" />
          Pipeline
        </h2>
        <div className="pipeline-filter">
          <label>Segment</label>
          <div style={{ position: "relative" }}>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
            >
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All segments" : `Segment ${s}`}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-3 h-3"
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "var(--void-text-dim)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const items = columnLeads(column.id);
          return (
            <div
              key={column.id}
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="kanban-column-header">
                <span>{column.label}</span>
                <span className="kanban-column-count">{items.length}</span>
              </div>
              <div className="kanban-cards">
                {items.map((lead) => (
                  <div
                    key={lead.id}
                    className={`kanban-card ${draggedLead?.id === lead.id ? "dragging" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(lead)}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <div className="kanban-card-domain">{lead.normalized_domain}</div>
                    <div className="kanban-card-company">
                      {lead.company_name ?? "—"}
                    </div>
                    <div className="kanban-card-meta">
                      <span className={`badge ${segmentClass(lead.segment)}`}>
                        {lead.segment ?? "D"}
                      </span>
                      <span className="badge" style={{ fontFamily: "var(--font-mono)" }}>
                        {lead.score}
                      </span>
                      <span
                        className={`status-dot ${statusDot(lead.status)}`}
                        title={lead.status}
                      />
                    </div>
                    <div className="kanban-card-activity">{formatActivity(lead)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
