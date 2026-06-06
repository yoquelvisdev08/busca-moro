import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Mail, Radar, Loader2, Save } from "lucide-react";
import { notify } from "@/lib/notify";
import {
  useAutomationStatus,
  useUpdateAutomationConfigMutation,
} from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/domain/Chip";
import { StatusLED } from "@/components/domain/StatusLED";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DISCOVER_COUNTRIES,
  DISCOVER_INDUSTRIES,
} from "@/lib/discover-options";
import { AutomationLiveStatus } from "@/components/domain/AutomationLiveStatus";
import type { AutomationConfigUpdate } from "@/lib/api";
import { cn } from "@/lib/utils";

type AutomationPanelProps = {
  variant?: "full" | "compact";
  className?: string;
  onDefaultsChange?: (defaults: {
    industry: string;
    location: string;
    niche: string;
    numDorks: number;
  }) => void;
};

export function AutomationPanel({
  variant = "full",
  className,
  onDefaultsChange,
}: AutomationPanelProps) {
  const navigate = useNavigate();
  const { data: status, isLoading } = useAutomationStatus();
  const updateMutation = useUpdateAutomationConfigMutation();

  const [autoScout, setAutoScout] = useState(true);
  const [autoOutreach, setAutoOutreach] = useState(false);
  const [autoEmail, setAutoEmail] = useState(true);
  const [scoutLoopMinutes, setScoutLoopMinutes] = useState(15);
  const [pipelinePollSeconds, setPipelinePollSeconds] = useState(45);
  const [pdfEnabled, setPdfEnabled] = useState(true);
  const [emailFrom, setEmailFrom] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [agencyOwnerName, setAgencyOwnerName] = useState("");
  const [agencyOwnerTitle, setAgencyOwnerTitle] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [minSegment, setMinSegment] = useState<"A" | "B" | "C">("B");
  const [maxPerRun, setMaxPerRun] = useState(3);
  const [numDorks, setNumDorks] = useState(20);
  const [defaultIndustry, setDefaultIndustry] = useState("");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [defaultNiche, setDefaultNiche] = useState("");

  useEffect(() => {
    if (!status?.config) return;
    const c = status.config;
    setAutoScout(c.auto_scout_enabled);
    setAutoOutreach(c.auto_outreach_enabled);
    setAutoEmail(c.auto_email_enabled ?? true);
    setScoutLoopMinutes(c.scout_loop_minutes ?? 15);
    setPipelinePollSeconds(c.pipeline_poll_seconds ?? 45);
    setPdfEnabled(c.pdf_generation_enabled ?? true);
    setEmailFrom(c.email_from ?? "");
    setEmailFromName(c.email_from_name ?? "");
    setAgencyOwnerName(c.agency_owner_name ?? "");
    setAgencyOwnerTitle(c.agency_owner_title ?? "");
    setAgencyWebsite(c.agency_website ?? "");
    setMinSegment(c.auto_outreach_min_segment);
    setMaxPerRun(c.auto_outreach_max_per_run);
    setNumDorks(c.default_num_dorks);
    setDefaultIndustry(c.default_industry);
    setDefaultLocation(c.default_location);
    setDefaultNiche(c.default_niche);
    onDefaultsChange?.({
      industry: c.default_industry,
      location: c.default_location,
      niche: c.default_niche,
      numDorks: c.default_num_dorks,
    });
  }, [status?.config, onDefaultsChange]);

  const save = async (patch: AutomationConfigUpdate) => {
    try {
      await updateMutation.mutateAsync(patch);
      notify.success("Configuración guardada");
    } catch (e) {
      notify.error(`No se pudo guardar: ${(e as Error).message}`);
    }
  };

  const handleToggleScout = async (checked: boolean) => {
    setAutoScout(checked);
    await save({ auto_scout_enabled: checked });
  };

  const handleToggleOutreach = async (checked: boolean) => {
    setAutoOutreach(checked);
    if (!checked) {
      setAutoEmail(false);
      await save({ auto_outreach_enabled: false, auto_email_enabled: false });
      return;
    }
    await save({ auto_outreach_enabled: true });
  };

  const handleToggleEmail = async (checked: boolean) => {
    setAutoEmail(checked);
    await save({ auto_email_enabled: checked });
  };

  const handleSaveSettings = async () => {
    await save({
      default_num_dorks: numDorks,
      default_industry: defaultIndustry,
      default_location: defaultLocation,
      default_niche: defaultNiche,
      auto_outreach_min_segment: minSegment,
      auto_outreach_max_per_run: maxPerRun,
      scout_loop_minutes: scoutLoopMinutes,
      pipeline_poll_seconds: pipelinePollSeconds,
      pdf_generation_enabled: pdfEnabled,
      email_from: emailFrom,
      email_from_name: emailFromName,
      agency_owner_name: agencyOwnerName,
      agency_owner_title: agencyOwnerTitle,
      agency_website: agencyWebsite,
    });
    onDefaultsChange?.({
      industry: defaultIndustry,
      location: defaultLocation,
      niche: defaultNiche,
      numDorks,
    });
  };

  const enableFullAuto = async () => {
    setAutoScout(true);
    setAutoOutreach(true);
    setAutoEmail(true);
    try {
      await updateMutation.mutateAsync({
        auto_scout_enabled: true,
        auto_outreach_enabled: true,
        auto_email_enabled: true,
      });
      notify.success("Modo completo activado: buscar + auditar + enviar emails");
    } catch (e) {
      notify.error(`Error: ${(e as Error).message}`);
    }
  };

  if (isLoading && !status) {
    return (
      <Card className={cn("border-border/80", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        </CardContent>
      </Card>
    );
  }

  const scoutActive = status?.scout?.active ?? status?.scout_pass_active ?? false;
  const scoutMode = status?.scout?.mode ?? status?.scout_pass_mode ?? "automatic";

  const fullMode = autoScout && autoOutreach && autoEmail;
  const pipelineOnly = autoOutreach && !autoEmail;
  const modeSummary = fullMode
    ? "Modo completo: buscar leads + auditar + enviar emails"
    : pipelineOnly
      ? "Pipeline activo: auditar y generar reportes · emails pausados"
      : autoScout
        ? "Solo búsqueda activa (Scout auto, sin pipeline automático)"
        : autoOutreach
          ? autoEmail
            ? "Solo pipeline + email (Scout manual)"
            : "Solo pipeline (auditar + closer, sin emails)"
          : "Automatización apagada";

  if (variant === "compact") {
    return (
      <Card className={cn("border-border/80", className)}>
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-headline font-medium text-text">
                Automatización
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Scout en background y envío automático de reportes
              </p>
            </div>
            <Chip
              variant="outline"
              color={scoutActive ? "primary" : "secondary"}
              icon={
                <StatusLED
                  variant={scoutActive ? "success" : "neutral"}
                  size="sm"
                  pulse={scoutActive}
                />
              }
            >
              Scout {scoutActive ? scoutMode : "idle"}
            </Chip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface/40 px-4 py-3">
            <div className="flex items-start gap-3 min-w-0">
              <Radar className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text">Buscar leads (auto)</p>
                  <Chip
                    variant={autoScout ? "solid" : "outline"}
                    color={autoScout ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {autoScout ? "ON" : "OFF"}
                  </Chip>
                </div>
                <p className="text-xs text-text-muted">
                  Scout usa dorks y seeds cada 15 min
                </p>
              </div>
            </div>
            <Switch
              checked={autoScout}
              onCheckedChange={(v) => void handleToggleScout(Boolean(v))}
              disabled={updateMutation.isPending}
              aria-label="Buscar leads automáticamente"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface/40 px-4 py-3">
            <div className="flex items-start gap-3 min-w-0">
              <Mail className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text">Pipeline auto (auditar + IA)</p>
                  <Chip
                    variant={autoOutreach ? "solid" : "outline"}
                    color={autoOutreach ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {autoOutreach ? "ON" : "OFF"}
                  </Chip>
                </div>
                <p className="text-xs text-text-muted">
                  Auditor → Closer → reporte PDF (sin depender de Scout)
                </p>
              </div>
            </div>
            <Switch
              checked={autoOutreach}
              onCheckedChange={(v) => void handleToggleOutreach(Boolean(v))}
              disabled={updateMutation.isPending}
              aria-label="Activar pipeline automático de auditoría"
            />
          </div>

          <div
            className={cn(
              "flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
              autoOutreach
                ? "border-border/60 bg-surface/40"
                : "border-border/40 bg-surface/20 opacity-60",
            )}
          >
            <div className="flex items-start gap-3 min-w-0">
              <Mail className="size-4 shrink-0 text-text-muted mt-0.5" aria-hidden />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text">Enviar emails auto</p>
                  <Chip
                    variant={autoEmail && autoOutreach ? "solid" : "outline"}
                    color={autoEmail && autoOutreach ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {autoEmail && autoOutreach ? "ON" : "OFF"}
                  </Chip>
                </div>
                <p className="text-xs text-text-muted">
                  Resend · segmento {minSegment}+ · pausa si cuota diaria
                </p>
              </div>
            </div>
            <Switch
              checked={autoEmail && autoOutreach}
              onCheckedChange={(v) => void handleToggleEmail(Boolean(v))}
              disabled={updateMutation.isPending || !autoOutreach}
              aria-label="Enviar emails automáticamente"
            />
          </div>

          {status?.stats && (
            <p className="text-[11px] text-text-dim">
              Enviados: {status.stats.outreach_sent_total} · Fallidos:{" "}
              {status.stats.outreach_failed_total}
            </p>
          )}

          <AutomationLiveStatus variant="panel" />

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate("/discover?tab=automation")}
          >
            Configurar en Discover
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="border-border/80">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Bot className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-headline font-semibold text-text">
                  Modos automáticos
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Activa o desactiva cada flujo sin detener el resto del pipeline
                </p>
              </div>
            </div>
            <Chip
              variant="outline"
              color={scoutActive ? "primary" : "secondary"}
              icon={
                <StatusLED
                  variant={scoutActive ? "success" : "neutral"}
                  size="sm"
                  pulse={scoutActive}
                />
              }
            >
              Scout {scoutActive ? `activo (${scoutMode})` : "en espera"}
            </Chip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div
            className={cn(
              "flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between rounded-lg border px-4 py-3",
              fullMode
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-surface/30",
            )}
            role="status"
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-text">Modo completo</p>
                {fullMode && (
                  <Chip variant="solid" color="success" className="text-[10px]">
                    Activo ahora
                  </Chip>
                )}
              </div>
              <p className="text-xs text-text-muted">
                Buscar leads + auditar + generar reporte + enviar email (todo automático)
              </p>
              <p className="text-[11px] text-text-dim">{modeSummary}</p>
            </div>
            <Button
              size="sm"
              variant={fullMode ? "secondary" : "default"}
              onClick={() => void enableFullAuto()}
              disabled={updateMutation.isPending || fullMode}
              className="shrink-0"
            >
              {fullMode ? "Activo" : "Activar todo"}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AutomationModeCard
              active={autoScout}
              icon={<Radar className="size-4" aria-hidden />}
              title="Solo buscar leads"
              description={
                <>
                  Scout ejecuta pasadas periódicas con los dorks de{" "}
                  <code className="text-[10px]">dorks.txt</code> y seeds. Las
                  búsquedas manuales desde Discover siguen funcionando aunque esto
                  esté apagado.
                </>
              }
              switchLabel="Activar búsqueda automática de leads"
              checked={autoScout}
              onCheckedChange={(v) => void handleToggleScout(v)}
              disabled={updateMutation.isPending}
            />

            <AutomationModeCard
              active={autoOutreach}
              icon={<Mail className="size-4" aria-hidden />}
              title="Pipeline auto (auditar + reporte)"
              description={
                <>
                  Flujo: Auditor (Lighthouse) → Closer (IA) → PDF. Puedes pausar solo
                  el envío por email si Resend agota cuota.
                </>
              }
              switchLabel="Activar pipeline automático"
              checked={autoOutreach}
              onCheckedChange={(v) => void handleToggleOutreach(v)}
              disabled={updateMutation.isPending}
              footer={
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                    autoOutreach ? "border-border/60 bg-surface/30" : "opacity-50",
                  )}
                >
                  <div>
                    <p className="text-xs font-medium text-text">Enviar emails auto</p>
                    <p className="text-[11px] text-text-muted">
                      Segmento {minSegment}+ · máx. {maxPerRun}/ciclo
                    </p>
                  </div>
                  <Switch
                    checked={autoEmail && autoOutreach}
                    onCheckedChange={(v) => void handleToggleEmail(Boolean(v))}
                    disabled={updateMutation.isPending || !autoOutreach}
                    aria-label="Enviar emails automáticamente"
                  />
                </div>
              }
            />
          </div>

        </CardContent>
      </Card>

      <AutomationLiveStatus variant="panel" />

      <Card className="border-border/80">
        <CardHeader className="border-b border-border/60 pb-4">
          <h2 className="text-base font-headline font-semibold text-text">
            Intervalos y tiempos
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Sustituyen valores de <code className="text-[10px]">.env</code> en runtime (sin
            reiniciar contenedores). Los secretos (API keys) siguen en .env.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Pasada Scout cada ({scoutLoopMinutes} min)
              </Label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={scoutLoopMinutes}
                onChange={(e) => setScoutLoopMinutes(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-surface-high accent-primary cursor-pointer"
              />
              <p className="text-[10px] text-text-dim">
                .env SCOUT_LOOP_INTERVAL:{" "}
                {status?.env_hints?.scout_loop_env_minutes ?? 15} min
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Ciclo pipeline cada ({pipelinePollSeconds} s)
              </Label>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={pipelinePollSeconds}
                onChange={(e) => setPipelinePollSeconds(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-surface-high accent-primary cursor-pointer"
              />
              <p className="text-[10px] text-text-dim">
                Auditar + closer + emails (si están activos)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="border-b border-border/60 pb-4">
          <h2 className="text-base font-headline font-semibold text-text">
            Correo y reportes
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Remitente visible en cold email. La API key de Resend permanece en .env (
            {status?.env_hints?.email_api_key_configured ? "configurada" : "sin configurar"}).
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text">Generar PDF en outreach auto</p>
              <p className="text-xs text-text-muted">Desactiva si solo quieres email sin adjunto</p>
            </div>
            <Switch
              checked={pdfEnabled}
              onCheckedChange={(v) => setPdfEnabled(Boolean(v))}
              disabled={updateMutation.isPending}
              aria-label="Generar PDF automáticamente"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Email remitente
              </Label>
              <Input
                type="email"
                placeholder={status?.env_hints?.email_from_env || "outreach@dominio.com"}
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Nombre remitente
              </Label>
              <Input
                placeholder={status?.env_hints?.email_from_name_env || "Tu nombre"}
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Nombre (firma)
              </Label>
              <Input
                placeholder="Yoquelvis"
                value={agencyOwnerName}
                onChange={(e) => setAgencyOwnerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Título (firma)
              </Label>
              <Input
                placeholder="Desarrollo web y optimización"
                value={agencyOwnerTitle}
                onChange={(e) => setAgencyOwnerTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Web agencia
              </Label>
              <Input
                type="url"
                placeholder="https://tu-sitio.com"
                value={agencyWebsite}
                onChange={(e) => setAgencyWebsite(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 overflow-visible">
        <CardHeader className="border-b border-border/60 pb-4">
          <h2 className="text-base font-headline font-semibold text-text">
            Valores por defecto (búsqueda manual)
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Pre-rellenan el formulario de la pestaña Buscar
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-5 overflow-visible">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Nicho por defecto
              </Label>
              <Input
                placeholder="ej. clínicas dentales premium"
                value={defaultNiche}
                onChange={(e) => setDefaultNiche(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Industria
              </Label>
              <SearchableSelect
                options={DISCOVER_INDUSTRIES}
                value={defaultIndustry}
                onValueChange={setDefaultIndustry}
                placeholder="Industria..."
                searchPlaceholder="Filtrar..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                País
              </Label>
              <SearchableSelect
                options={DISCOVER_COUNTRIES}
                value={defaultLocation}
                onValueChange={setDefaultLocation}
                placeholder="País..."
                searchPlaceholder="Filtrar..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Dorks por defecto ({numDorks})
              </Label>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={numDorks}
              onChange={(e) => setNumDorks(Number(e.target.value))}
              className="w-full h-2 rounded-full bg-surface-high accent-primary cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Segmento mínimo (outreach auto)
              </Label>
              <select
                value={minSegment}
                onChange={(e) =>
                  setMinSegment(e.target.value as "A" | "B" | "C")
                }
                className="w-full h-9 rounded-md border border-border bg-surface px-3 text-sm text-text"
              >
                <option value="A">A — solo premium</option>
                <option value="B">B — A y B (recomendado)</option>
                <option value="C">C — A, B y C (recomendado si tus leads son C)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                Máx. emails por ciclo ({maxPerRun})
              </Label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={maxPerRun}
                onChange={(e) => setMaxPerRun(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-surface-high accent-primary cursor-pointer mt-3"
              />
            </div>
          </div>

          <Button
            onClick={() => void handleSaveSettings()}
            disabled={updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Guardar toda la configuración
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationModeCard({
  active,
  icon,
  title,
  description,
  switchLabel,
  checked,
  onCheckedChange,
  disabled,
  footer,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  switchLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-colors",
        active
          ? "border-primary/50 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(var(--color-primary-rgb,99,102,241),0.15)]"
          : "border-border/50 bg-surface/20 opacity-80",
      )}
      aria-current={active ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={cn(
              "mt-0.5 shrink-0",
              active ? "text-primary" : "text-text-muted",
            )}
          >
            {icon}
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-text">{title}</span>
              <Chip
                variant={active ? "solid" : "outline"}
                color={active ? "success" : "secondary"}
                icon={
                  <StatusLED
                    variant={active ? "success" : "neutral"}
                    size="sm"
                    pulse={active}
                  />
                }
                className="text-[10px] uppercase tracking-wide"
              >
                {active ? "Activado" : "Apagado"}
              </Chip>
            </div>
          </div>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(Boolean(v))}
          disabled={disabled}
          aria-label={switchLabel}
        />
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      {footer}
    </div>
  );
}
