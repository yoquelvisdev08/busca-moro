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
    await save({ auto_outreach_enabled: checked });
  };

  const handleSaveDefaults = async () => {
    await save({
      default_num_dorks: numDorks,
      default_industry: defaultIndustry,
      default_location: defaultLocation,
      default_niche: defaultNiche,
      auto_outreach_min_segment: minSegment,
      auto_outreach_max_per_run: maxPerRun,
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
    try {
      await updateMutation.mutateAsync({
        auto_scout_enabled: true,
        auto_outreach_enabled: true,
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

  const fullMode = autoScout && autoOutreach;
  const modeSummary = fullMode
    ? "Modo completo: buscar leads + auditar + enviar emails"
    : autoScout
      ? "Solo búsqueda activa (Scout auto, sin emails automáticos)"
      : autoOutreach
        ? "Solo pipeline de email (auditar + enviar, Scout manual)"
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
                  <p className="text-sm font-medium text-text">Reporte + email (auto)</p>
                  <Chip
                    variant={autoOutreach ? "solid" : "outline"}
                    color={autoOutreach ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {autoOutreach ? "ON" : "OFF"}
                  </Chip>
                </div>
                <p className="text-xs text-text-muted">
                  Leads enriquecidos con email, segmento {minSegment}+
                </p>
              </div>
            </div>
            <Switch
              checked={autoOutreach}
              onCheckedChange={(v) => void handleToggleOutreach(Boolean(v))}
              disabled={updateMutation.isPending}
              aria-label="Enviar reporte y email automáticamente"
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
              title="Reporte + correo auto"
              description={
                <>
                  Flujo: Scout → Auditor (Lighthouse) → Closer (IA) → PDF + cold email.
                  Solo leads <strong>enriched</strong> con email y segmento mínimo.
                </>
              }
              switchLabel="Activar reporte y correo automático"
              checked={autoOutreach}
              onCheckedChange={(v) => void handleToggleOutreach(v)}
              disabled={updateMutation.isPending}
            />
          </div>

        </CardContent>
      </Card>

      <AutomationLiveStatus variant="panel" />

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
            onClick={() => void handleSaveDefaults()}
            disabled={updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Guardar configuración
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
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  switchLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
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
    </div>
  );
}
