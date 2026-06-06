import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  FileText,
  Users,
  Trash2,
  Send,
  Inbox,
  AlertTriangle,
  MailX,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { api, type BulkSendResponse } from "@/lib/api";
import { useLeads, useTriggerAuditMutation, useDeleteLeadMutation } from "@/lib/hooks";
import type { Lead, LeadStatus } from "@/lib/api";
import { DataTable, type BulkAction, type FilterConfig } from "@/components/tables/DataTable";
import type { ColumnDef, PaginationState, RowSelectionState } from "@tanstack/react-table";
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
import { LeadsPipelineTabs } from "@/components/domain/LeadsPipelineTabs";
import { AutomationLiveStatus } from "@/components/domain/AutomationLiveStatus";
import { leadHasEmail, leadPrimaryEmail } from "@/lib/lead-email";
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

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  queued: "En cola",
  auditing: "Auditando",
  audited: "Auditado",
  enriched: "Enriquecido",
  contacted: "Contactado",
  interested: "Interesado",
  negotiation: "Negociación",
  closed_won: "Ganado",
  closed_lost: "Perdido",
  replied: "Respondió",
  won: "Ganado",
  rejected: "Rechazado",
  error: "Error",
};

type MetricTone = "success" | "warning" | "danger" | "neutral";

const metricToneClass: Record<MetricTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  neutral: "border-border/50 bg-surface-high/50 text-text-muted",
};

function MetricPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: MetricTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.75rem] justify-center rounded-md border px-2 py-0.5 text-xs font-mono tabular-nums",
        metricToneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

function CellBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: MetricTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
        metricToneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type LeadsPipeline = "new" | "reviewed";

const PIPELINE_COPY: Record<
  LeadsPipeline,
  { title: string; subtitle: string; searchPlaceholder: string }
> = {
  new: {
    title: "Leads nuevos",
    subtitle: "Aún no has enviado mensaje a estos leads",
    searchPlaceholder: "Buscar dominios sin contactar...",
  },
  reviewed: {
    title: "Leads revisados",
    subtitle: "Ya recibieron al menos un mensaje tuyo",
    searchPlaceholder: "Buscar en leads contactados...",
  },
};

export function LeadsPage({ pipeline = "new" }: { pipeline?: LeadsPipeline }) {
  const navigate = useNavigate();
  const copy = PIPELINE_COPY[pipeline];
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<string>("");
  const [emailFilter, setEmailFilter] = useState<string>("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [pipeline, statusFilter, segmentFilter, emailFilter]);

  useEffect(() => {
    setRowSelection({});
  }, [pipeline, pagination.pageIndex, pagination.pageSize]);

  const { data, isLoading, error } = useLeads({
    pipeline,
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    ...(statusFilter ? { status: statusFilter as LeadStatus } : {}),
    ...(emailFilter === "yes"
      ? { has_email: true }
      : emailFilter === "no"
        ? { has_email: false }
        : {}),
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

  useEffect(() => {
    setRowSelection({});
  }, [total, leads.length]);

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
    setRowSelection({});
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
      label: "Auditar",
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
    ...(pipeline === "new"
      ? [
          {
            label: "Generar reporte y enviar",
            icon: <Send className="size-3" />,
            action: (rows: Lead[]) => {
              const ids = rows.map((r) => r.id);
              if (
                !window.confirm(
                  `¿Generar y enviar reporte a ${ids.length} lead(s)?`,
                )
              )
                return;

              notify.promise(
                api.bulkReportSend(ids),
                {
                  loading: `Generando y enviando reportes a ${ids.length} leads...`,
                  success: ((res: BulkSendResponse) =>
                    `${res.sent} enviados, ${res.skipped.length} omitidos, ${res.failed.length} fallidos`) as unknown as string,
                  error: "Error al enviar reportes",
                },
              );
            },
            variant: "default" as const,
          } satisfies BulkAction<Lead>,
        ]
      : []),
    {
      label: "Eliminar seleccionados",
      icon: <Trash2 className="size-3" />,
      action: (rows) => {
        if (rows.length === 0) return;
        openDeleteDialog(rows);
      },
      variant: "destructive",
    },
  ];

  const filterConfigs: FilterConfig[] = [
    {
      id: "status",
      label: "Estado",
      type: "select",
      value: statusFilter || "all",
      onChange: (v) => setStatusFilter(v === "all" ? "" : v),
      options: [
        { value: "new", label: "Nuevo" },
        { value: "queued", label: "En cola" },
        { value: "auditing", label: "Auditando" },
        { value: "audited", label: "Auditado" },
        { value: "contacted", label: "Contactado" },
        { value: "replied", label: "Respondió" },
        { value: "error", label: "Error" },
      ],
    },
    {
      id: "segment",
      label: "Segmento",
      type: "select",
      value: segmentFilter || "all",
      onChange: (v) => setSegmentFilter(v === "all" ? "" : v),
      options: [
        { value: "A", label: "Segmento A" },
        { value: "B", label: "Segmento B" },
        { value: "C", label: "Segmento C" },
        { value: "D", label: "Segmento D" },
      ],
    },
    {
      id: "email_filter",
      label: "Email",
      type: "select",
      value: emailFilter || "all",
      onChange: (v) => setEmailFilter(v === "all" ? "" : v),
      options: [
        { value: "all", label: "Todos" },
        { value: "yes", label: "Con email" },
        { value: "no", label: "Sin email" },
      ],
    },
  ];

  const columns = useMemo<ColumnDef<Lead, unknown>[]>(
    () => [
      {
        id: "domain",
        header: "Dominio",
        accessorFn: (row) => row.normalized_domain,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <button
              type="button"
              className="group/domain max-w-[220px] overflow-hidden text-left cursor-pointer rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-surface-high/60"
              onClick={() => navigate(`/leads/${lead.id}`)}
            >
              <span className="truncate block text-sm font-mono font-medium text-text-secondary group-hover/domain:text-primary">
                {lead.normalized_domain}
              </span>
              {lead.company_name && (
                <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                  {lead.company_name}
                </span>
              )}
            </button>
          );
        },
      },
      {
        id: "email",
        header: "Correo",
        accessorFn: (row) => (leadHasEmail(row) ? "yes" : "no"),
        cell: ({ row }) => {
          const lead = row.original;
          const has = lead.has_email ?? leadHasEmail(lead);
          const primary = leadPrimaryEmail(lead);
          if (!has) {
            return (
              <CellBadge tone="danger">
                <MailX className="size-3 shrink-0" aria-hidden />
                Sin email
              </CellBadge>
            );
          }
          return (
            <span
              className="block max-w-[200px] truncate"
              title={primary ?? undefined}
            >
              <span className="inline-flex flex-col gap-0.5">
                <CellBadge tone="success" className="w-fit">
                  <Mail className="size-3 shrink-0" aria-hidden />
                  Con email
                </CellBadge>
                {primary && (
                  <span className="truncate block pl-0.5 font-mono text-[10px] text-text-muted">
                    {primary}
                  </span>
                )}
              </span>
            </span>
          );
        },
      },
      {
        id: "segment",
        header: "Seg.",
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
              variant="solid"
              className="min-w-[1.75rem] justify-center font-semibold"
            >
              {seg}
            </Chip>
          );
        },
      },
      {
        id: "status",
        header: "Estado",
        accessorFn: (row) => row.status,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <StatusLED
              variant={statusToLED[status] ?? "neutral"}
              size="sm"
              label={STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
              pulse={status === "auditing"}
            />
          );
        },
      },
      {
        id: "cierre",
        header: "Cierre",
        accessorFn: (row) => (row.needs_next_step ? "pending" : row.next_step_type ?? ""),
        cell: ({ row }) => {
          const lead = row.original;
          if (lead.needs_next_step) {
            return (
              <CellBadge tone="warning">
                <AlertTriangle className="size-3 shrink-0" aria-hidden />
                Sin paso
              </CellBadge>
            );
          }
          if (lead.next_step_type === "call") {
            return <CellBadge tone="success">Llamada</CellBadge>;
          }
          if (lead.next_step_type === "proposal") {
            return (
              <CellBadge tone="neutral" className="border-primary/30 bg-primary-soft text-primary">
                Propuesta
              </CellBadge>
            );
          }
          if (lead.next_step_type === "discard") {
            return <CellBadge tone="neutral">Descartado</CellBadge>;
          }
          return <span className="text-xs text-text-dim">—</span>;
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
              <CellBadge tone="neutral">
                <Mail className="size-3 opacity-70" aria-hidden />
                Sin enviar
              </CellBadge>
            );
          }
          return (
            <div className="flex flex-col gap-1">
              <CellBadge tone="neutral" className="border-primary/30 bg-primary-soft text-primary">
                <Send className="size-3 shrink-0" aria-hidden />
                Enviado
                {o && o.messages_sent_count > 1
                  ? ` · ${o.messages_sent_count}`
                  : ""}
              </CellBadge>
              {replied && (
                <CellBadge tone="success" className="w-fit py-0.5 text-[10px]">
                  <Inbox className="size-3 shrink-0" aria-hidden />
                  Respondió
                </CellBadge>
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
          const label = formatScore(score);
          if (label === "—") {
            return <span className="text-xs text-text-dim">—</span>;
          }
          return <MetricPill tone="neutral">{label}</MetricPill>;
        },
      },
      {
        id: "lighthouse_score",
        header: "LH",
        accessorFn: (row) => row.lighthouse_score ?? 0,
        cell: ({ getValue }) => {
          const score = getValue() as number;
          if (!score) return <span className="text-xs text-text-dim">—</span>;
          const tone: MetricTone =
            score >= 90 ? "success" : score >= 50 ? "warning" : "danger";
          return <MetricPill tone={tone}>{score}</MetricPill>;
        },
      },
      {
        id: "load_time_ms",
        header: "Carga",
        accessorFn: (row) => row.load_time_ms ?? 0,
        cell: ({ getValue }) => {
          const ms = getValue() as number;
          if (!ms) return <span className="text-xs text-text-dim">—</span>;
          const tone: MetricTone =
            ms < 2000 ? "success" : ms < 4000 ? "warning" : "danger";
          return <MetricPill tone={tone}>{ms}ms</MetricPill>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center justify-end gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-text-muted hover:bg-primary-soft hover:text-primary"
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
                className="size-8 text-text-muted hover:bg-danger/15 hover:text-danger"
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
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-headline text-2xl font-semibold tracking-tight text-text">
              {copy.title}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-text-muted">
              {copy.subtitle}
            </p>
          </div>
          {!isLoading && (
            <div className="flex items-center gap-2 rounded-full border border-border/80 bg-surface-high/80 px-3.5 py-1.5 text-xs font-medium text-text-secondary tabular-nums">
              <Users className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {total.toLocaleString()} en esta lista
            </div>
          )}
        </div>
        <LeadsPipelineTabs />
      </div>

      {pipeline === "new" && <AutomationLiveStatus variant="banner" />}

      <section className="rounded-xl border border-border/70 bg-surface p-4 shadow-sm">
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
            placeholder: copy.searchPlaceholder,
          }}
          filters={filterConfigs}
          bulkActions={bulkActions}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          density="normal"
          getRowId={(row) => row.id}
        />
      </section>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? `Eliminar ${deleteTarget.length} leads`
                : "Eliminar lead"}
            </DialogTitle>
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
              {pipeline === "reviewed"
                ? "No hay leads revisados"
                : "No hay leads nuevos"}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {searchValue || statusFilter || segmentFilter || emailFilter
                ? "Prueba ajustando los filtros"
                : pipeline === "reviewed"
                  ? "Cuando envíes un mensaje, el lead aparecerá aquí"
                  : "Scout puede traer leads solos cada ~15 min, o lanza Discover para buscar por país y nicho"}
            </p>
          </div>
          {!searchValue &&
            !statusFilter &&
            !segmentFilter &&
            !emailFilter &&
            pipeline === "new" && (
            <Button onClick={() => navigate("/discover")}>
              Ir a Discover
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
