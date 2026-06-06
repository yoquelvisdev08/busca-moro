import { useState, useEffect, useRef, useCallback } from "react";
import { notify } from "@/lib/notify";
import {
  Search,
  Rocket,
  Radar,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Link2,
  Settings2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLeads, useMonitorStatus, useAutomationStatus, queryKeys } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";
import { Chip } from "@/components/domain/Chip";
import { StatusLED } from "@/components/domain/StatusLED";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DISCOVER_COUNTRIES,
  DISCOVER_INDUSTRIES,
} from "@/lib/discover-options";
import { cn } from "@/lib/utils";
import { AutomationPanel } from "@/components/domain/AutomationPanel";

type DiscoverTab = "search" | "automation";

type DiscoveryPhase = "idle" | "generating" | "scouting" | "done";

type DiscoverySession = {
  dorksTotal: number;
  startedAt: number;
  baselineTotal: number;
  industryLabel: string;
};

/** Scout vacía la cola Redis al arrancar cada pasada; no usar LLEN para saber si terminó. */
const SCOUT_MIN_SCOUTING_MS = 45_000;
const SCOUT_QUIET_MS = 35_000;
const SCOUT_MAX_MS = 12 * 60 * 1000;

function segmentChipColor(segment: string | null | undefined) {
  switch (segment) {
    case "A":
      return "success" as const;
    case "B":
      return "primary" as const;
    case "C":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "automation" ? "automation" : "search";
  const [activeTab, setActiveTab] = useState<DiscoverTab>(initialTab);
  const queryClient = useQueryClient();
  const [industry, setIndustry] = useState("");
  const [niche, setNiche] = useState("");
  const [country, setCountry] = useState("");
  const [numDorks, setNumDorks] = useState(20);
  const [manualUrl, setManualUrl] = useState("");
  const [manualAnalyzing, setManualAnalyzing] = useState(false);
  const [phase, setPhase] = useState<DiscoveryPhase>("idle");
  const [session, setSession] = useState<DiscoverySession | null>(null);
  const [scoutingTick, setScoutingTick] = useState(0);
  const lastActivityAtRef = useRef<number>(0);
  const prevNewLeadsRef = useRef(0);
  const touchedRef = useRef(0);
  const createdRef = useRef(0);

  const applyAutomationDefaults = useCallback(
    (defaults: {
      industry: string;
      location: string;
      niche: string;
      numDorks: number;
    }) => {
      if (defaults.industry) setIndustry(defaults.industry);
      if (defaults.location) setCountry(defaults.location);
      if (defaults.niche) setNiche(defaults.niche);
      if (defaults.numDorks) setNumDorks(defaults.numDorks);
    },
    [],
  );

  const setTab = (tab: DiscoverTab) => {
    setActiveTab(tab);
    if (tab === "automation") {
      setSearchParams({ tab: "automation" });
    } else {
      setSearchParams({});
    }
  };

  const scoutingActive = phase === "generating" || phase === "scouting";

  const sessionSinceIso = session
    ? new Date(session.startedAt - 5_000).toISOString()
    : undefined;

  const { data: recentLeadsData } = useLeads({ limit: 8 });
  const { data: sessionLeadsData, isFetching: leadsFetching } = useLeads(
    { limit: 30, discovered_since: sessionSinceIso },
    {
      refetchInterval: phase === "scouting" ? 2_500 : false,
      enabled: Boolean(sessionSinceIso),
    },
  );
  const { data: newDomainsData } = useLeads(
    { limit: 1, created_since: sessionSinceIso },
    {
      refetchInterval: phase === "scouting" ? 2_500 : false,
      enabled: Boolean(sessionSinceIso),
    },
  );
  const { data: monitor } = useMonitorStatus();
  const { data: automationStatus } = useAutomationStatus();

  useEffect(() => {
    const c = automationStatus?.config;
    if (!c) return;
    if (c.default_industry) setIndustry(c.default_industry);
    if (c.default_location) setCountry(c.default_location);
    if (c.default_niche) setNiche(c.default_niche);
    if (c.default_num_dorks) setNumDorks(c.default_num_dorks);
  }, [automationStatus?.config]);

  const leads = recentLeadsData?.items ?? [];
  const discoveryQueue = monitor?.queues.discovery ?? 0;

  const scoutOnline =
    monitor?.services?.find((s) => s.name === "Scout")?.status === "online";

  const sessionLeads = sessionLeadsData?.items ?? [];
  const touchedInSession = sessionLeadsData?.total ?? 0;
  const newDomainsCount = newDomainsData?.total ?? 0;

  useEffect(() => {
    if (phase !== "scouting") return;
    const id = window.setInterval(() => setScoutingTick((t) => t + 1), 1_000);
    return () => window.clearInterval(id);
  }, [phase]);

  const scoutingElapsedMs = session
    ? Date.now() - session.startedAt
    : 0;
  void scoutingTick;
  const expectedPassMs = session
    ? Math.max(90_000, session.dorksTotal * 12_000)
    : 90_000;
  const scoutProgress =
    phase === "done"
      ? 100
      : phase === "scouting" && session
        ? Math.min(95, Math.round((scoutingElapsedMs / expectedPassMs) * 100))
        : 0;

  useEffect(() => {
    touchedRef.current = touchedInSession;
    createdRef.current = newDomainsCount;
    if (touchedInSession > prevNewLeadsRef.current) {
      lastActivityAtRef.current = Date.now();
    }
    prevNewLeadsRef.current = touchedInSession;
  }, [touchedInSession, newDomainsCount]);

  useEffect(() => {
    if (phase !== "scouting" || !session) return;

    const tick = window.setInterval(() => {
      const elapsed = Date.now() - session.startedAt;
      if (elapsed >= SCOUT_MAX_MS) {
        finishScouting();
        return;
      }
      if (elapsed < SCOUT_MIN_SCOUTING_MS) return;

      const lastBump =
        lastActivityAtRef.current > 0
          ? lastActivityAtRef.current
          : session.startedAt;
      if (Date.now() - lastBump >= SCOUT_QUIET_MS) {
        finishScouting();
      }
    }, 2_000);

    return () => window.clearInterval(tick);

    function finishScouting() {
      setPhase("done");
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      const touched = touchedRef.current;
      const created = createdRef.current;
      if (touched > 0) {
        notify.success(
          created > 0
            ? `Listo: ${created} dominio${created === 1 ? "" : "s"} nuevo${created === 1 ? "" : "s"} y ${touched} actualizado${touched === 1 ? "" : "s"}.`
            : `Listo: ${touched} lead${touched === 1 ? "" : "s"} revisado${touched === 1 ? "" : "s"} (ya existían; mira Leads revisados si ya les escribiste).`,
          { href: "/leads" },
        );
      } else {
        notify.error(
          "Scout terminó sin guardar leads. Usa un nicho local concreto (ej. clínica dental Madrid).",
        );
      }
    }
  }, [phase, session, queryClient]);

  const handleStartDiscovery = async () => {
    const industryQuery = [niche.trim(), industry.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!industryQuery) {
      notify.error("Selecciona una industria o escribe un nicho");
      return;
    }

    const startedAt = Date.now();
    setSession({
      dorksTotal: numDorks,
      startedAt,
      baselineTotal: 0,
      industryLabel: industryQuery,
    });
    lastActivityAtRef.current = startedAt;
    setPhase("generating");
    prevNewLeadsRef.current = 0;
    void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });

    try {
      const result = await api.startDiscovery({
        industry: industryQuery,
        location: country || undefined,
        numDorks,
      });

      if (!result.success) {
        notify.error(result.message || "No se pudo iniciar la búsqueda");
        setPhase("idle");
        setSession(null);
        return;
      }

      setSession((prev) =>
        prev
          ? { ...prev, dorksTotal: result.dorks_generated }
          : null,
      );
      setPhase("scouting");
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    } catch (e) {
      notify.error(`Discovery falló: ${(e as Error).message}`);
      setPhase("idle");
      setSession(null);
    }
  };

  const resetSession = () => {
    setPhase("idle");
    setSession(null);
    lastActivityAtRef.current = 0;
    prevNewLeadsRef.current = 0;
  };

  const handleManualAnalyze = async () => {
    const raw = manualUrl.trim();
    if (!raw) {
      notify.error("Escribe o pega la URL del sitio a analizar");
      return;
    }
    const industryQuery = [niche.trim(), industry].filter(Boolean).join(" — ");
    setManualAnalyzing(true);
    try {
      const result = await api.analyzeUrl({
        url: raw.startsWith("http") ? raw : `https://${raw}`,
        location: country || undefined,
        industry: industryQuery || industry || undefined,
      });
      if (result.published) {
        notify.success(result.message);
        setManualUrl("");
        void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      } else if (result.success) {
        notify.warning(result.message);
      } else {
        notify.error(result.message);
      }
    } catch (e) {
      notify.error(`Análisis falló: ${(e as Error).message}`);
    } finally {
      setManualAnalyzing(false);
    }
  };

  const showProgress =
    phase === "generating" ||
    (session != null && (phase === "scouting" || phase === "done"));

  return (
    <PageContainer className="max-w-4xl">
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-xl font-headline font-semibold text-text">
            Discover
          </h1>
          <p className="text-sm text-text-muted">
            Busca negocios con web mejorable que puedan pagar optimización y
            desarrollo web profesional.
          </p>
        </header>

        <div
          className="flex gap-1 rounded-lg border border-border/60 bg-surface-high/30 p-1"
          role="tablist"
          aria-label="Secciones de Discover"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "search"}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "search"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text",
            )}
            onClick={() => setTab("search")}
          >
            <Search className="size-4" aria-hidden />
            Buscar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "automation"}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "automation"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text",
            )}
            onClick={() => setTab("automation")}
          >
            <Settings2 className="size-4" aria-hidden />
            Automatización
          </button>
        </div>

        {activeTab === "automation" ? (
          <AutomationPanel onDefaultsChange={applyAutomationDefaults} />
        ) : (
          <>
        <Card className="border-border/80 overflow-visible">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Search className="size-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-headline font-semibold text-text">
                    Nueva búsqueda
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Prioriza PYMEs con señales de facturación (reservas, precios,
                    testimonios)
                  </p>
                </div>
              </div>
              <Chip
                variant="outline"
                color={scoutOnline ? "success" : "warning"}
                icon={
                  <StatusLED
                    variant={scoutOnline ? "success" : "warning"}
                    size="sm"
                  />
                }
              >
                Scout {scoutOnline ? "listo" : "revisar"}
              </Chip>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-5 overflow-visible">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                  Nicho (recomendado)
                </Label>
                <Input
                  placeholder="ej. clínicas dentales premium, bufetes laboralistas"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  disabled={scoutingActive}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                  Industria
                </Label>
                <SearchableSelect
                  options={DISCOVER_INDUSTRIES}
                  value={industry}
                  onValueChange={setIndustry}
                  placeholder="Buscar industria..."
                  searchPlaceholder="Escribe para filtrar..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                  País
                </Label>
                <SearchableSelect
                  options={DISCOVER_COUNTRIES}
                  value={country}
                  onValueChange={setCountry}
                  placeholder="Buscar país..."
                  searchPlaceholder="Escribe país o ciudad..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                  Dorks ({numDorks})
                </Label>
                <span className="text-xs text-text-muted">
                  Consultas en SearXNG (5–30)
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={numDorks}
                onChange={(e) => setNumDorks(Number(e.target.value))}
                disabled={scoutingActive}
                className="w-full h-2 rounded-full bg-surface-high accent-primary cursor-pointer disabled:opacity-50"
                aria-label={`Dorks: ${numDorks}`}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <Button
                onClick={handleStartDiscovery}
                disabled={scoutingActive}
                size="lg"
                className="w-full sm:w-auto min-w-[200px]"
              >
                {phase === "generating" ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                    Generando dorks...
                  </>
                ) : phase === "scouting" ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                    Scout en marcha...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4 mr-2" aria-hidden />
                    Lanzar búsqueda
                  </>
                )}
              </Button>
              {phase === "done" && session && (
                <Button variant="outline" size="lg" onClick={resetSession}>
                  Nueva búsqueda
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-surface-high text-primary">
                <Link2 className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-headline font-semibold text-text">
                  Análisis manual
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Pega la URL de un negocio; Scout la analiza y, si califica, la
                  guarda en Leads nuevos
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                URL del sitio
              </Label>
              <Input
                type="url"
                placeholder="https://ejemplo.com.do"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                disabled={manualAnalyzing}
              />
              {country && (
                <p className="text-[11px] text-text-dim">
                  Filtro geográfico activo: {country} (sitios fuera del mercado
                  se descartan)
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void handleManualAnalyze()}
              disabled={manualAnalyzing || !manualUrl.trim()}
              className="w-full sm:w-auto"
            >
              {manualAnalyzing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                  Analizando...
                </>
              ) : (
                "Analizar y guardar lead"
              )}
            </Button>
          </CardContent>
        </Card>

        {showProgress && (
          <Card
            className={cn(
              "overflow-hidden",
              phase === "scouting"
                ? "border-primary/30 bg-primary-soft/25"
                : touchedInSession > 0
                  ? "border-success/30 bg-success/5"
                  : "border-warning/30 bg-warning/5",
            )}
            aria-live="polite"
            aria-busy={phase === "scouting"}
          >
            <CardContent className="space-y-4 py-5">
              <div className="flex flex-wrap items-start gap-3">
                {phase === "scouting" ? (
                  <Loader2
                    className="size-5 shrink-0 animate-spin text-primary"
                    aria-hidden
                  />
                ) : touchedInSession > 0 ? (
                  <CheckCircle2
                    className="size-5 shrink-0 text-success"
                    aria-hidden
                  />
                ) : (
                  <Radar
                    className="size-5 shrink-0 text-warning"
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-text">
                    {phase === "generating"
                      ? "Generando consultas con IA..."
                      : phase === "scouting" && session
                        ? `Scout buscando: ${session.industryLabel}`
                        : "Búsqueda finalizada"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {phase === "generating"
                      ? "Preparando dorks para SearXNG"
                      : phase === "scouting" && session
                        ? `${session.dorksTotal} dorks encolados · la lista se actualiza sola`
                        : touchedInSession > 0
                          ? `${newDomainsCount} dominios nuevos · ${touchedInSession} detectados en esta pasada`
                          : "Scout terminó sin dominios que pasen el filtro de calidad"}
                  </p>
                </div>
                {leadsFetching && phase === "scouting" && (
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">
                    Actualizando
                  </span>
                )}
              </div>

              {session && phase !== "generating" && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Scout en pasada</span>
                      <span className="font-mono tabular-nums text-text">
                        {session.dorksTotal} dorks · ~
                        {Math.ceil(expectedPassMs / 60_000)} min est.
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
                      role="progressbar"
                      aria-valuenow={scoutProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          phase === "done" ? "bg-success" : "bg-primary",
                          phase === "scouting" &&
                            scoutProgress < 95 &&
                            "animate-pulse",
                        )}
                        style={{ width: `${scoutProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-text-dim">
                      La cola Redis puede estar en 0 mientras Scout sigue
                      buscando en SearXNG ({discoveryQueue} pendientes en cola).
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        Cola discovery
                      </p>
                      <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-text">
                        {discoveryQueue}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        Leads nuevos
                      </p>
                      <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-primary">
                        {newDomainsCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2 col-span-2 sm:col-span-1">
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        Detectados
                      </p>
                      <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-text">
                        {touchedInSession}
                      </p>
                    </div>
                  </div>

                  {phase === "done" && touchedInSession > 0 && newDomainsCount === 0 && (
                    <p className="text-xs text-text-secondary rounded-md border border-border/60 bg-surface/40 px-3 py-2">
                      Scout encontró negocios que ya estaban en tu base (quizá en{" "}
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => navigate("/leads/revisados")}
                      >
                        Leads revisados
                      </button>
                      ). Los dominios nuevos aparecen en{" "}
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => navigate("/leads")}
                      >
                        Leads nuevos
                      </button>
                      .
                    </p>
                  )}

                  {phase === "done" && touchedInSession === 0 && (
                    <div className="space-y-2 text-xs text-text-secondary rounded-md border border-warning/25 bg-warning/5 px-3 py-3">
                      <p className="font-medium text-warning">
                        La pasada fue correcta (mira los logs: muchos
                        fingerprinted con eligible=false).
                      </p>
                      <p>
                        Solo se guardan sitios con{" "}
                        <strong>problema técnico</strong> (lenta, sin SSL, WP
                        viejo…) y{" "}
                        <strong>señal de negocio</strong> (reservas, precios,
                        testimonios). Portales como NYT, Google o XNXX se
                        descartan.
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-text-muted">
                        <li>
                          Usa un nicho local: «clínica dental Madrid», «fontanero
                          Barcelona»
                        </li>
                        <li>
                          Evita consultas genéricas que devuelven medios o
                          plataformas
                        </li>
                        <li>
                          Tras rebuild de Scout, umbral de carga 4s (antes 5s)
                        </li>
                      </ul>
                    </div>
                  )}

                  {phase === "scouting" &&
                    scoutingElapsedMs > 90_000 &&
                    touchedInSession === 0 && (
                      <p className="text-xs text-warning rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                        Scout sigue analizando URLs. Si no hay leads, casi siempre
                        es porque las webs son rápidas y no tienen problema
                        detectable.
                      </p>
                    )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/80 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-border/60 py-4">
            <div>
              <h2 className="text-base font-headline font-semibold text-text">
                {session ? "Leads de esta búsqueda" : "Resultados recientes"}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {phase === "scouting"
                  ? "Aparecen aquí en cuanto Scout los guarda"
                  : "Últimos dominios capturados (segmentos A–C prioritarios)"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => navigate("/leads")}
            >
              Todos los leads
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {phase === "scouting" && sessionLeads.length === 0 ? (
              <div className="flex flex-col gap-3 py-10 px-6">
                <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                  Esperando primeros dominios...
                </div>
                <div className="space-y-2 max-w-md mx-auto w-full">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-md" />
                  ))}
                </div>
              </div>
            ) : (session ? sessionLeads : leads.slice(0, 8)).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Radar className="size-8 text-text-muted mb-3" aria-hidden />
                <p className="text-sm text-text-secondary">
                  Sin leads todavía. Lanza una búsqueda arriba.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-text-muted bg-surface-high/30">
                  <span>Dominio</span>
                  <span>Empresa</span>
                  <span>Segmento</span>
                  <span>Fecha</span>
                  <span className="text-right">Acción</span>
                </div>
                {(session ? sessionLeads : leads).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 sm:gap-3 sm:items-center px-4 py-3 hover:bg-surface-high/40 transition-colors"
                  >
                    <span className="block text-sm font-mono text-primary font-medium truncate">
                      {lead.normalized_domain}
                    </span>
                    <span className="text-sm text-text truncate">
                      {lead.company_name || "—"}
                    </span>
                    <Chip
                      variant="solid"
                      color={segmentChipColor(lead.segment)}
                      className="text-[10px] w-fit"
                    >
                      {lead.segment ?? "—"}
                    </Chip>
                    <span className="text-[11px] font-mono text-text-muted whitespace-nowrap">
                      {lead.discovered_at
                        ? new Date(lead.discovered_at).toLocaleDateString()
                        : "—"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs sm:justify-self-end w-fit"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      Ver
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </PageContainer>
  );
}
