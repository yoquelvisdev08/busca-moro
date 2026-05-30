import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, FileText, Users, Trash2, Send, Inbox } from "lucide-react";
import { notify } from "@/lib/notify";
import { useLeads, useTriggerAuditMutation, useDeleteLeadMutation } from "@/lib/hooks";
import type { Lead, LeadStatus } from "@/lib/api";
import { DataTable, type BulkAction, type FilterConfig } from "@/components/tables/DataTable";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LEAD_DELETE_REASONS,
  suggestDeleteReason,
  type LeadDeleteReasonCode,
} from "@/lib/delete-lead-reasons";
import { StatusLED, type StatusLEDVariant } from "@/components/domain/StatusLED";
import { Chip, type ChipColor } from "@/components/domain/Chip";
import { cn } from "@/lib/utils";

const statusToLED: Record<string, StatusLEDVariant> = {
  new: "info",
  queued: "info",
  auditing: "info",
  audited: "success",
  enriched: "success",
  contacted: "success",
  interested: "success",
  negotiation: "warning",
  closed_won: "success",
  closed_lost: "danger",
  replied: "success",
  won: "success",
  rejected: "danger",
  error: "danger",
};

const segmentToChipColor: Record<string, ChipColor> = {
  A: "success",
  B: "primary",
  C: "warning",
  D: "danger",
};

function formatScore(score: number | null): string {
  if (score == null) return "—";
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}K`;
  return String(Math.round(score));
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<string>("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const { data, isLoading, error } = useLeads({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    ...(statusFilter ? { status: statusFilter as LeadStatus } : {}),
  });

  const triggerAudit = useTriggerAuditMutation();
  const deleteLead = useDeleteLeadMutation();
  const [deleteTarget, setDeleteTarget] = useState<Lead | Lead[] | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState<LeadDeleteReasonCode | "">("");
  const [deleteDetail, setDeleteDetail] = useState("");

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  const openDeleteDialog = (target: Lead | Lead[]) => {
    setDeleteTarget(target);
    if (!Array.isArray(target)) {
      setDeleteReason(suggestDeleteReason(target));
    } else {
      setDeleteReason("");
    }
    setDeleteDetail("");
    setDeleteDialogOpen(true);
  };

  const canConfirmDelete =
    Boolean(deleteReason) &&
    (deleteReason !== "other" || deleteDetail.trim().length >= 3);

  const handleDeleteConfirm = () => {
    if (!deleteTarget || !deleteReason || !canConfirmDelete) return;
    const targets = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
    const payload = {
      reason: deleteReason,
      detail: deleteDetail.trim() || undefined,
    };
    notify.promise(
      Promise.all(
        targets.map((lead) =>
          deleteLead.mutateAsync({ id: lead.id, ...payload }),
        ),
      ).then(() => undefined),
      {
        loading:
          targets.length === 1
            ? "Eliminando lead..."
            : `Eliminando ${targets.length} leads...`,
        success:
          targets.length === 1
            ? "Lead eliminado"
            : `${targets.length} leads eliminados`,
        error: (err) =>
          err instanceof Error ? err.message : "No se pudo eliminar",
      },
    );
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    setDeleteReason("");
    setDeleteDetail("");
  };

  const deleteDialogLabel = (() => {
    if (!deleteTarget) return "";
    if (Array.isArray(deleteTarget)) {
      return `${deleteTarget.length} leads seleccionados`;
    }
    return deleteTarget.normalized_domain;
  })();

  const bulkActions: BulkAction<Lead>[] = [
    {
      label: "Trigger Audit",
      icon: <FileText className="size-3" />,
      action: (rows) => {
        const ids = rows.map((r) => r.id);
        notify.promise(
          Promise.all(ids.map((id) => triggerAudit.mutateAsync(id))),
          {
            loading: `Auditando ${ids.length} leads...`,
            success: `${ids.length} leads en cola de auditoría`,
            error: "Error al auditar algunos leads",
          },
        );
      },
      variant: "default",
    },
    {
      label: "Eliminar",
      icon: <Trash2 className="size-3" />,
      action: (rows) => openDeleteDialog(rows),
      variant: "destructive",
    },
  ];

  const filterConfigs: FilterConfig[] = [
    {
      id: "status",
      label: "Status",
      type: "select",
      value: statusFilter,
      onChange: (v) => setStatusFilter(v === "all" ? "" : v),
      options: [
        { value: "all", label: "All Statuses" },
        { value: "new", label: "New" },
        { value: "queued", label: "Queued" },
        { value: "auditing", label: "Auditing" },
        { value: "audited", label: "Audited" },
        { value: "contacted", label: "Contacted" },
        { value: "replied", label: "Replied" },
        { value: "error", label: "Error" },
      ],
    },
    {
      id: "segment",
      label: "Segment",
      type: "select",
      value: segmentFilter,
      onChange: (v) => setSegmentFilter(v === "all" ? "" : v),
      options: [
        { value: "all", label: "All Segments" },
        { value: "A", label: "Segment A" },
        { value: "B", label: "Segment B" },
        { value: "C", label: "Segment C" },
        { value: "D", label: "Segment D" },
      ],
    },
  ];

  const columns = useMemo<ColumnDef<Lead, unknown>[]>(
    () => [
      {
        id: "domain",
        header: "Domain",
        accessorFn: (row) => row.normalized_domain,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <button
              type="button"
              className="text-left cursor-pointer hover:text-primary transition-colors"
              onClick={() => navigate(`/leads/${lead.id}`)}
            >
              <span className="text-sm font-mono text-primary font-medium">
                {lead.normalized_domain}
              </span>
              {lead.company_name && (
                <span className="block text-[11px] text-text-muted">
                  {lead.company_name}
                </span>
              )}
            </button>
          );
        },
      },
      {
        id: "segment",
        header: "Segment",
        accessorFn: (row) => row.segment ?? "",
        filterFn: (row, id, filterValue: string) => {
          if (!filterValue) return true;
          return (row.getValue(id) as string) === filterValue;
        },
        cell: ({ getValue }) => {
          const seg = getValue() as string;
          if (!seg) return <span className="text-text-dim text-xs">—</span>;
          return (
            <Chip
              color={segmentToChipColor[seg] ?? "primary"}
              variant="default"
            >
              {seg}
            </Chip>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <StatusLED
              variant={statusToLED[status] ?? "neutral"}
              size="sm"
              label={status.replace(/_/g, " ")}
              pulse={status === "auditing"}
            />
          );
        },
      },
      {
        id: "mensaje",
        header: "Mensaje",
        accessorFn: (row) =>
          row.outreach?.has_message_sent ? "sent" : "none",
        cell: ({ row }) => {
          const o = row.original.outreach;
          const sent = o?.has_message_sent ?? false;
          const replied = o?.has_reply_received ?? false;
          if (!sent) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                <Mail className="size-3 opacity-60" aria-hidden />
                Sin enviar
              </span>
            );
          }
          return (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                <Send className="size-3" aria-hidden />
                Enviado
                {o && o.messages_sent_count > 1
                  ? ` (${o.messages_sent_count})`
                  : ""}
              </span>
              {replied && (
                <span className="inline-flex items-center gap-1 text-[10px] text-success">
                  <Inbox className="size-3" aria-hidden />
                  Respondió
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "score",
        header: "Score",
        accessorFn: (row) => row.score,
        cell: ({ getValue }) => {
          const score = getValue() as number | null;
          return (
            <span className="text-xs font-mono tabular-nums text-text">
              {formatScore(score)}
            </span>
          );
        },
      },
      {
        id: "lighthouse_score",
        header: "Lighthouse",
        accessorFn: (row) => row.lighthouse_score ?? 0,
        cell: ({ getValue }) => {
          const score = getValue() as number;
          const scoreClass =
            score >= 90
              ? "text-success"
              : score >= 50
                ? "text-warning"
                : "text-danger";
          return (
            <span className={cn("text-xs font-mono tabular-nums", scoreClass)}>
              {score || "—"}
            </span>
          );
        },
      },
      {
        id: "load_time_ms",
        header: "Load Time",
        accessorFn: (row) => row.load_time_ms ?? 0,
        cell: ({ getValue }) => {
          const ms = getValue() as number;
          const timeClass =
            ms === 0
              ? "text-text-dim"
              : ms < 2000
                ? "text-success"
                : ms < 4000
                  ? "text-warning"
                  : "text-danger";
          return (
            <span className={cn("text-xs font-mono tabular-nums", timeClass)}>
              {ms ? `${ms}ms` : "—"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-1 justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/leads/${lead.id}`);
                }}
                aria-label="Ver lead"
              >
                <Mail className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-danger hover:text-danger hover:bg-danger/10"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteDialog(lead);
                }}
                aria-label="Eliminar lead"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          );
        },
      },
    ],
    [navigate]
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-headline font-semibold text-text">
            Leads
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {total.toLocaleString()} total leads
          </p>
        </div>
      </div>

      <DataTable<Lead>
        data={leads}
        columns={columns}
        loading={isLoading}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Search domains...",
        }}
        filters={filterConfigs}
        bulkActions={bulkActions}
        density="compact"
        getRowId={(row) => row.id}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar lead</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget) && deleteTarget.length > 1 ? (
                <>
                  Vas a eliminar <strong>{deleteTarget.length} leads</strong>.
                  Se ocultarán de la lista; los datos relacionados (auditorías,
                  informes) se conservan en base de datos.
                </>
              ) : (
                <>
                  Vas a eliminar <strong>{deleteDialogLabel}</strong>. El lead
                  dejará de aparecer en la lista.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="delete-reason">Motivo</Label>
              <Select
                value={deleteReason}
                onValueChange={(v) =>
                  setDeleteReason(v as LeadDeleteReasonCode)
                }
              >
                <SelectTrigger id="delete-reason" className="w-full">
                  <SelectValue placeholder="Selecciona por qué lo archivas" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_DELETE_REASONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-text-muted">
                Queda guardado en base de datos por si revisas descartes más
                adelante.
              </p>
            </div>

            {deleteReason === "other" && (
              <div className="space-y-1.5">
                <Label htmlFor="delete-detail">Detalle</Label>
                <Textarea
                  id="delete-detail"
                  rows={3}
                  value={deleteDetail}
                  onChange={(e) => setDeleteDetail(e.target.value)}
                  placeholder="Ej.: solo formulario genérico, sin email público..."
                />
              </div>
            )}

            {!Array.isArray(deleteTarget) && deleteTarget && !deleteTarget.email && (
              <p className="text-xs text-warning rounded-md border border-warning/30 bg-warning/5 p-2">
                Este lead no tiene email guardado; por eso sugerimos
                &quot;Sin email para contactar&quot;.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTarget(null);
                setDeleteReason("");
                setDeleteDetail("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteLead.isPending || !canConfirmDelete}
            >
              {deleteLead.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
          Error loading leads: {(error as Error).message}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && leads.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Users className="size-12 text-text-dim" aria-hidden="true" />
          <div>
            <h3 className="text-base font-headline font-medium text-text">
              No leads found
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {searchValue || statusFilter || segmentFilter
                ? "Try adjusting your filters"
                : "Start by discovering new leads from the Discover page"}
            </p>
          </div>
          {!searchValue && !statusFilter && !segmentFilter && (
            <Button onClick={() => navigate("/discover")}>
              Discover Leads
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
