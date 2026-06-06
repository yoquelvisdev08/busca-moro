import { useMemo, useState } from "react";
import {
  ExternalLink,
  MessageCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import {
  useConvertPoseidonSignalMutation,
  usePoseidonScanStatus,
  usePoseidonSignals,
  usePoseidonStats,
  useTriggerPoseidonScanMutation,
  useUpdatePoseidonSignalMutation,
} from "@/lib/hooks";
import { ORION_APP_URL, type PoseidonSignal, type PoseidonSignalStatus } from "@/lib/api";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const STATUS_TABS: { id: PoseidonSignalStatus | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "new", label: "Nuevos" },
  { id: "reviewed", label: "Revisados" },
  { id: "contacted", label: "Contactados" },
  { id: "dismissed", label: "Descartados" },
];

const CATEGORY_LABELS: Record<string, string> = {
  web_dev: "Web / Dev",
  scraping: "Scraping",
  performance: "Performance",
  hosting: "Hosting",
  wordpress: "WordPress",
  general: "General",
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orionLeadUrl(leadId: string): string {
  return `${ORION_APP_URL}/leads/${leadId}`;
}

export function InboxPage() {
  const [tab, setTab] = useState<PoseidonSignalStatus | "all">("new");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const statusFilter = tab === "all" ? undefined : tab;
  const { data, isLoading, error, refetch } = usePoseidonSignals({
    status: statusFilter,
    min_score: 45,
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });
  const { data: stats } = usePoseidonStats();
  const { data: scanStatus } = usePoseidonScanStatus();
  const updateMutation = useUpdatePoseidonSignalMutation();
  const convertMutation = useConvertPoseidonSignalMutation();
  const scanMutation = useTriggerPoseidonScanMutation();

  const signals = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize) || 1;

  const columns = useMemo<ColumnDef<PoseidonSignal, unknown>[]>(
    () => [
      {
        id: "score",
        header: "Score",
        accessorKey: "intent_score",
        cell: ({ row }) => (
          <span
            className={cn(
              "font-mono text-sm font-bold",
              row.original.intent_score >= 75 ? "text-success" : "text-primary",
            )}
          >
            {row.original.intent_score}
          </span>
        ),
      },
      {
        id: "platform",
        header: "Fuente",
        accessorKey: "platform",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {row.original.platform}
          </Badge>
        ),
      },
      {
        id: "category",
        header: "Intención",
        accessorKey: "intent_category",
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-[10px]">
            {CATEGORY_LABELS[row.original.intent_category] ?? row.original.intent_category}
          </Badge>
        ),
      },
      {
        id: "content",
        header: "Señal",
        cell: ({ row }) => {
          const s = row.original;
          const preview = s.llm_summary || s.snippet || s.title;
          return (
            <div className="max-w-xl space-y-1">
              <p className="text-sm font-medium text-text line-clamp-1">{s.title || "Sin título"}</p>
              <p className="text-xs text-text-muted line-clamp-2">{preview}</p>
              {s.reply_angle && (
                <p className="text-[11px] text-primary/90 line-clamp-1">
                  <Sparkles className="inline size-3 mr-1" aria-hidden />
                  {s.reply_angle}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "when",
        header: "Detectado",
        accessorKey: "detected_at",
        cell: ({ row }) => (
          <span className="text-xs text-text-muted whitespace-nowrap">
            {formatWhen(row.original.detected_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => window.open(s.source_url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="size-4" />
              </Button>
              {s.status === "new" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate(
                        { id: s.id, patch: { status: "contacted" } },
                        { onSuccess: () => notify.success("Marcado como contactado") },
                      )
                    }
                  >
                    <MessageCircle className="size-3.5" />
                    Contacté
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate(
                        { id: s.id, patch: { status: "dismissed" } },
                        { onSuccess: () => notify.info("Señal descartada") },
                      )
                    }
                  >
                    <XCircle className="size-4 text-text-muted" />
                  </Button>
                </>
              )}
              {s.lead_id ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1"
                  onClick={() =>
                    window.open(orionLeadUrl(s.lead_id!), "_blank", "noopener,noreferrer")
                  }
                >
                  Orion
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : (
                s.status !== "dismissed" && (
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    disabled={convertMutation.isPending}
                    onClick={() =>
                      convertMutation.mutate(s.id, {
                        onSuccess: (res) => {
                          notify.success("Lead creado en Orion");
                          window.open(orionLeadUrl(res.lead_id), "_blank", "noopener,noreferrer");
                        },
                        onError: (err: Error) =>
                          notify.error(err.message || "No se pudo convertir"),
                      })
                    }
                  >
                    <CheckCircle2 className="size-3.5" />
                    A Orion
                  </Button>
                )
              )}
            </div>
          );
        },
      },
    ],
    [convertMutation, updateMutation],
  );

  const handleScan = () => {
    scanMutation.mutate(undefined, {
      onSuccess: () => {
        notify.success("Escaneo iniciado. Revisa en unos minutos.");
        void refetch();
      },
      onError: () => notify.error("No se pudo iniciar el escaneo"),
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-semibold tracking-tight text-text">Inbox</h1>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            Personas que piden ayuda con web, scraping o performance. Contacto manual — leads
            calientes.
          </p>
        </div>
        <Button
          onClick={handleScan}
          disabled={scanMutation.isPending || scanStatus?.active}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn("size-4", scanStatus?.active && "animate-spin")} />
          {scanStatus?.active ? "Escaneando…" : "Escanear ahora"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Nuevos" value={stats?.new ?? 0} highlight />
        <StatCard label="Contactados" value={stats?.contacted ?? 0} />
        <StatCard label="Convertidos" value={stats?.converted ?? 0} />
        <StatCard
          label="Último scan"
          value={scanStatus?.last_scan_saved ?? 0}
          suffix=" guardadas"
          sub={formatWhen(scanStatus?.last_scan_at)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
              tab === t.id
                ? "bg-primary/15 border-primary text-primary"
                : "border-border text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {scanStatus?.last_error && (
        <p className="text-sm text-warning">{scanStatus.last_error}</p>
      )}

      {error && <p className="text-sm text-danger">Error cargando señales.</p>}

      <DataTable
        columns={columns}
        data={signals}
        loading={isLoading}
        pagination={pagination}
        onPaginationChange={setPagination}
        pageCount={pageCount}
        getRowId={(row) => row.id}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix = "",
  sub,
  highlight,
}: {
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4 bg-surface/50",
        highlight && "border-primary/40",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-2xl font-headline font-semibold mt-1">
        {value}
        {suffix && <span className="text-sm font-normal text-text-muted">{suffix}</span>}
      </p>
      {sub && <p className="text-[11px] text-text-muted mt-1">{sub}</p>}
    </div>
  );
}
