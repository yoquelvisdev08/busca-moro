import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox,
  Mail,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { useMensajeriaMessages } from "@/lib/hooks";
import type { MessageDirection, OutreachMessage } from "@/lib/api";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MensajeriaTab = "all" | MessageDirection;

const TABS: { id: MensajeriaTab; label: string; icon: typeof Mail }[] = [
  { id: "all", label: "Todos", icon: Mail },
  { id: "outbound", label: "Enviados", icon: Send },
  { id: "inbound", label: "Recibidos", icon: Inbox },
];

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewBody(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}

export function MensajeriaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MensajeriaTab>("all");
  const [searchValue, setSearchValue] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const direction = tab === "all" ? undefined : tab;
  const { data, isLoading, error } = useMensajeriaMessages(direction, {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });

  const messages = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize) || 1;

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      const hay = [
        m.lead_domain,
        m.lead_company_name,
        m.recipient,
        m.subject,
        m.body,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [messages, searchValue]);

  const columns = useMemo<ColumnDef<OutreachMessage, unknown>[]>(
    () => [
      {
        id: "direction",
        header: "Tipo",
        accessorFn: (row) => row.direction,
        cell: ({ row }) => {
          const isOut = row.original.direction === "outbound";
          return (
            <Badge
              variant={isOut ? "default" : "secondary"}
              className="gap-1 font-mono text-[10px]"
            >
              {isOut ? (
                <ArrowUpRight className="size-3" aria-hidden />
              ) : (
                <ArrowDownLeft className="size-3" aria-hidden />
              )}
              {isOut ? "Enviado" : "Recibido"}
            </Badge>
          );
        },
      },
      {
        id: "lead",
        header: "Lead",
        accessorFn: (row) => row.lead_domain ?? row.lead_id,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <button
              type="button"
              className="text-left hover:text-primary transition-colors"
              onClick={() => navigate(`/leads/${m.lead_id}`)}
            >
              <span className="text-sm font-mono text-primary block">
                {m.lead_domain ?? m.lead_id.slice(0, 8)}
              </span>
              {m.lead_company_name && (
                <span className="text-[11px] text-text-muted block">
                  {m.lead_company_name}
                </span>
              )}
            </button>
          );
        },
      },
      {
        id: "contact",
        header: "Contacto",
        accessorFn: (row) => row.recipient,
        cell: ({ getValue }) => (
          <span className="text-xs font-mono text-text-secondary truncate max-w-[200px] block">
            {getValue() as string}
          </span>
        ),
      },
      {
        id: "subject",
        header: "Asunto",
        accessorFn: (row) => row.subject ?? "",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[280px]">
            <div className="text-sm text-text truncate">
              {row.original.subject || "(sin asunto)"}
            </div>
            <div className="text-[11px] text-text-muted truncate mt-0.5">
              {previewBody(row.original.body)}
            </div>
          </div>
        ),
      },
      {
        id: "when",
        header: "Fecha",
        accessorFn: (row) => row.sent_at ?? row.created_at,
        cell: ({ row }) => (
          <span className="text-xs font-mono text-text-muted tabular-nums whitespace-nowrap">
            {formatWhen(row.original.sent_at ?? row.original.created_at)}
          </span>
        ),
      },
      {
        id: "signals",
        header: "Estado",
        cell: ({ row }) => {
          const m = row.original;
          if (m.direction === "inbound") {
            return (
              <span className="text-xs text-success font-medium">Respuesta</span>
            );
          }
          return (
            <div className="flex flex-col gap-0.5 text-[11px] text-text-muted">
              {m.opened && <span className="text-success">Abierto</span>}
              {m.replied && <span className="text-success">Respondió</span>}
              {m.has_attachment && <span>PDF adjunto</span>}
              {!m.opened && !m.replied && !m.has_attachment && <span>Enviado</span>}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Ver lead"
            onClick={() => navigate(`/leads/${row.original.lead_id}?tab=outreach`)}
          >
            <ExternalLink className="size-3.5" />
          </Button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-headline font-semibold tracking-tight text-text">
            Mensajería
          </h1>
          <p className="text-sm text-text-muted mt-1 max-w-xl">
            Historial de mensajes enviados a leads y respuestas recibidas.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <span>{total} mensajes</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-sm border-b-2 transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger">
          Error al cargar mensajes: {(error as Error).message}
        </p>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        loading={isLoading}
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Buscar por dominio, email o asunto…",
        }}
        pagination={pagination}
        onPaginationChange={setPagination}
        pageCount={pageCount}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
