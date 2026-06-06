import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Clock,
  Loader2,
  Mail,
  Radar,
  Search,
  Zap,
} from "lucide-react";
import { useAutomationStatus } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/domain/Chip";
import { StatusLED } from "@/components/domain/StatusLED";
import { cn } from "@/lib/utils";

type AutomationLiveStatusProps = {
  variant?: "banner" | "panel";
  className?: string;
};

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AutomationLiveStatus({
  variant = "panel",
  className,
}: AutomationLiveStatusProps) {
  const navigate = useNavigate();
  const { data: status, isLoading } = useAutomationStatus({ refetchInterval: 4_000 });
  const [tick, setTick] = useState(() => Date.now());

  const config = status?.config;
  const scout = status?.scout;
  const autoScout = config?.auto_scout_enabled ?? false;
  const autoOutreach = config?.auto_outreach_enabled ?? false;
  const autoEmail = config?.auto_email_enabled ?? true;
  const anyAuto = autoScout || autoOutreach;
  const loopMinutes = status?.scout_loop_minutes ?? 15;
  const pollSeconds = status?.pipeline_poll_seconds ?? 45;

  useEffect(() => {
    if (!anyAuto) return;
    const id = window.setInterval(() => setTick(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [anyAuto, scout?.active]);

  void tick;

  const scoutActive = scout?.active === true;
  const scoutMode = scout?.mode ?? "automatic";

  const startedMs = scout?.started_at ? new Date(scout.started_at).getTime() : null;
  const finishedMs = scout?.finished_at ? new Date(scout.finished_at).getTime() : null;
  const elapsedSec = startedMs && scoutActive ? (Date.now() - startedMs) / 1000 : 0;
  const expectedPassMs = Math.max(90_000, (scout?.dorks_count ?? 10) * 12_000);
  const scoutProgress =
    scoutActive && startedMs
      ? Math.min(95, Math.round(((Date.now() - startedMs) / expectedPassMs) * 100))
      : 0;

  const nextPassMs =
    !scoutActive && finishedMs && autoScout
      ? finishedMs + loopMinutes * 60_000
      : null;
  const secondsUntilNext =
    nextPassMs != null ? Math.max(0, Math.ceil((nextPassMs - Date.now()) / 1000)) : null;

  if (isLoading && !status) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-surface-high/30 px-4 py-6 text-sm text-text-muted",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        Cargando actividad...
      </div>
    );
  }

  if (!anyAuto) {
    return (
      <div
        className={cn(
          "rounded-xl border border-warning/30 bg-warning/5 px-4 py-4",
          variant === "banner" && "border-dashed",
          className,
        )}
        role="status"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Bot className="size-5 shrink-0 text-warning mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text">Automatización apagada</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Activa al menos un modo en Discover → Automatización para que Scout
                busque leads o envíe reportes sin intervención manual.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => navigate("/discover?tab=automation")}
          >
            Activar modo auto
          </Button>
        </div>
      </div>
    );
  }

  const pipeline = status?.pipeline;
  const minSegment = config?.auto_outreach_min_segment ?? "B";

  if (autoScout && !autoOutreach) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/70 bg-surface-high/25 overflow-hidden",
          className,
        )}
        role="status"
      >
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <Radar className="size-5 shrink-0 text-primary mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text">Solo búsqueda activa</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Scout encuentra leads, pero <strong>no envía emails</strong> hasta que actives
                también <strong>Reporte + correo auto</strong>. Los leads pasan por auditoría
                y Closer antes de poder contactarse.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="default"
            className="w-full sm:w-auto"
            onClick={() => navigate("/discover?tab=automation")}
          >
            Activar envío automático
          </Button>
        </div>
        {pipeline && (
          <PipelineFunnel pipeline={pipeline} minSegment={minSegment} autoOutreach={false} />
        )}
      </div>
    );
  }

  const headline = scoutActive
    ? scoutMode === "discovery"
      ? "Discover en marcha"
      : "Scout buscando leads ahora"
    : autoOutreach && !autoEmail
      ? "Pipeline activo · auditando (emails pausados)"
      : autoOutreach
        ? "Pipeline completo · auditando y enviando emails"
        : autoScout
          ? secondsUntilNext != null && secondsUntilNext > 0
            ? `Scout en pausa · próxima pasada en ${formatDuration(secondsUntilNext)}`
            : "Scout listo · iniciando pasada..."
          : "Pipeline en marcha";

  const subline = scoutActive
    ? `Pasada #${scout.pass ?? 0} · ${scout.dorks_count ?? 0} dorks · ${scout.seeds_count ?? 0} seeds${
        scout.location ? ` · ${scout.location}` : ""
      }`
    : autoOutreach && !autoEmail
      ? `Cada ~${pollSeconds}s: impulsa auditoría y Closer · emails OFF (cuota Resend o pausa manual)`
      : autoOutreach
        ? `Cada ~${pollSeconds}s: impulsa auditoría/closer (hasta 15 por pasada) y envía hasta ${config?.auto_outreach_max_per_run ?? 3} emails`
        : autoScout
          ? `Ciclo cada ~${loopMinutes} min con dorks.txt${
              finishedMs ? ` · última pasada terminó a las ${formatClock(scout?.finished_at)}` : ""
            }`
          : "Scout manual disponible en Discover";

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        scoutActive
          ? "border-primary/35 bg-primary-soft/15"
          : "border-border/70 bg-surface-high/25",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {scoutActive ? (
            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden />
          ) : (
            <StatusLED
              variant={autoScout ? "info" : "neutral"}
              size="md"
              pulse={autoScout && secondsUntilNext != null && secondsUntilNext <= 30}
              className="mt-1 shrink-0"
            />
          )}
          <div className="min-w-0 space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-text">{headline}</p>
              <div className="flex flex-wrap gap-1.5">
                {autoScout && (
                  <Chip variant="outline" color={scoutActive ? "primary" : "secondary"} className="text-[10px]">
                    <Radar className="size-3" aria-hidden />
                    Buscar {scoutActive ? "activo" : "auto"}
                  </Chip>
                )}
                {autoOutreach && (
                  <Chip variant="outline" color="secondary" className="text-[10px]">
                    <Mail className="size-3" aria-hidden />
                    {autoEmail ? "Email auto" : "Email pausado"}
                  </Chip>
                )}
              </div>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{subline}</p>

            {scoutActive && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>Progreso estimado de pasada</span>
                  <span className="font-mono tabular-nums text-text">
                    {formatDuration(elapsedSec)} · {scoutProgress}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-high">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 animate-pulse"
                    style={{ width: `${scoutProgress}%` }}
                    role="progressbar"
                    aria-valuenow={scoutProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}

            {!scoutActive && autoScout && secondsUntilNext != null && secondsUntilNext > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" aria-hidden />
                    Hasta próxima pasada
                  </span>
                  <span className="font-mono tabular-nums text-text">
                    {formatDuration(secondsUntilNext)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-high">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all duration-1000"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((loopMinutes * 60 - secondsUntilNext) / (loopMinutes * 60)) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {variant === "banner" && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start"
            onClick={() => navigate("/discover?tab=automation")}
          >
            Ver automatización
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-t border-border/50 bg-border/30">
        <MetricCell
          label="En cola"
          value={String(pipeline?.queued ?? 0)}
          hint="esperando auditoría"
          icon={<Zap className="size-3.5" aria-hidden />}
          highlight={(pipeline?.queued ?? 0) > 0}
        />
        <MetricCell
          label="Auditados"
          value={String(pipeline?.audited ?? 0)}
          hint="esperando Closer (IA)"
          icon={<Bot className="size-3.5" aria-hidden />}
          highlight={(pipeline?.audited ?? 0) > 0}
        />
        <MetricCell
          label="Listos email"
          value={String(pipeline?.ready_for_outreach ?? 0)}
          hint={`enriched · seg. ${minSegment}+`}
          icon={<Mail className="size-3.5" aria-hidden />}
          highlight={(pipeline?.ready_for_outreach ?? 0) > 0}
        />
        <MetricCell
          label="Contactados"
          value={String(pipeline?.contacted ?? status?.stats.outreach_sent_total ?? 0)}
          hint={`${status?.stats.outreach_failed_total ?? 0} fallidos`}
          icon={<Search className="size-3.5" aria-hidden />}
          highlight={(pipeline?.contacted ?? 0) > 0}
        />
      </div>

      {autoOutreach && pipeline && (pipeline.queued ?? 0) > 0 && (pipeline.ready_for_outreach ?? 0) === 0 && (
        <p className="border-t border-border/50 px-4 py-2 text-[11px] text-warning bg-warning/5">
          Hay {pipeline.queued} leads en cola de auditoría
          {(status?.queues?.audit ?? 0) > (pipeline.queued ?? 0) * 2 ? (
            <> · cola Redis inflada ({status?.queues?.audit} jobs). El sistema se auto-reconcilia cada pasada.</>
          ) : null}
          . El email se envía cuando lleguen a enriched (Auditor → Closer → PDF → correo).
        </p>
      )}

      {autoOutreach && status?.stats.last_pipeline_run_at && (
        <p className="border-t border-border/50 px-4 py-2 text-[11px] text-text-dim truncate">
          Último avance pipeline: {new Date(status.stats.last_pipeline_run_at).toLocaleString()}
          {status.stats.last_pipeline_detail ? ` · ${status.stats.last_pipeline_detail}` : ""}
        </p>
      )}

      {autoOutreach && status?.stats.last_outreach_run_at && (
        <p className="border-t border-border/50 px-4 py-2 text-[11px] text-text-dim truncate">
          Último envío auto: {new Date(status.stats.last_outreach_run_at).toLocaleString()}
          {status.stats.last_outreach_detail ? ` · ${status.stats.last_outreach_detail}` : ""}
        </p>
      )}
    </div>
  );
}

function PipelineFunnel({
  pipeline,
  minSegment,
  autoOutreach,
}: {
  pipeline: import("@/lib/api").PipelineCounts;
  minSegment: string;
  autoOutreach: boolean;
}) {
  const steps = [
    { label: "En cola", value: pipeline.queued, desc: "Auditor" },
    { label: "Auditando", value: pipeline.auditing, desc: "Lighthouse" },
    { label: "Auditados", value: pipeline.audited, desc: "Closer IA" },
    { label: "Enriched", value: pipeline.enriched, desc: "Con intel" },
    { label: "Listos", value: pipeline.ready_for_outreach, desc: `Email · ${minSegment}+` },
    { label: "Contactados", value: pipeline.contacted, desc: "Enviados" },
  ];
  return (
    <div className="border-t border-border/50 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
        Embudo del pipeline {autoOutreach ? "" : "(sin envío auto)"}
      </p>
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 min-w-[4.5rem]",
              s.value > 0 ? "border-primary/30 bg-primary/5" : "border-border/50 bg-surface/40",
            )}
          >
            <p className="text-[10px] text-text-muted">{s.label}</p>
            <p className="text-sm font-mono font-semibold tabular-nums text-text">{s.value}</p>
            <p className="text-[9px] text-text-dim">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  hint,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface/80 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-lg font-mono font-semibold tabular-nums",
          highlight ? "text-primary" : "text-text",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-text-dim truncate">{hint}</p>
    </div>
  );
}
