import { useMemo, useState } from "react";
import { notify } from "@/lib/notify";
import {
  Search,
  Rocket,
  TrendingUp,
  Radar,
  Globe2,
  ArrowRight,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useLeads, useMonitorStatus } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/charts/MetricCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { Chip } from "@/components/domain/Chip";
import { StatusLED } from "@/components/domain/StatusLED";
import { cn } from "@/lib/utils";

const INDUSTRIES = [
  "Software Development",
  "Financial Services",
  "Healthcare Tech",
  "E-commerce",
  "Logistics",
  "Real Estate",
  "Education",
  "Marketing & Advertising",
];

const LOCATIONS = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Global",
];

const PIPELINE_STEPS = [
  { key: "scout", label: "Scout", desc: "SearXNG + dorks" },
  { key: "audit", label: "Auditor", desc: "Lighthouse" },
  { key: "closer", label: "Closer", desc: "Sales intel" },
] as const;

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
  const [industry, setIndustry] = useState("");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [numDorks, setNumDorks] = useState(15);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const { data: leadsData } = useLeads({ limit: 100 });
  const { data: monitor } = useMonitorStatus();

  const leads = leadsData?.items ?? [];
  const recentLeads = leads.slice(0, 6);

  const leadsLast24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return leads.filter((l) => new Date(l.discovered_at).getTime() >= cutoff)
      .length;
  }, [leads]);

  const auditedRate = useMemo(() => {
    if (leads.length === 0) return 0;
    const audited = leads.filter((l) => l.lighthouse_score != null).length;
    return Math.round((audited / leads.length) * 1000) / 10;
  }, [leads]);

  const scoutOnline =
    monitor?.services?.find((s) => s.name === "Scout")?.status === "online";

  const handleStartDiscovery = async () => {
    const industryQuery = [niche.trim(), industry.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!industryQuery) {
      notify.error("Selecciona una industria o escribe un nicho");
      return;
    }

    setIsDiscovering(true);
    try {
      const result = await api.startDiscovery({
        industry: industryQuery,
        location: location || undefined,
        numDorks,
      });
      notify.success(
        `${result.dorks_generated} dorks generados. Scout en marcha.`,
        { href: "/leads" },
      );
    } catch (e) {
      notify.error(`Discovery falló: ${(e as Error).message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <PageContainer className="max-w-6xl">
      <div className="flex flex-col gap-8">
        {/* Hero */}
        <section
          className={cn(
            "relative overflow-hidden rounded-2xl border border-primary/20",
            "bg-gradient-to-br from-surface-high/80 via-surface to-bg",
            "p-6 md:p-8",
          )}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-secondary/10 blur-3xl"
            aria-hidden
          />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-primary">
                <Radar className="size-3.5" aria-hidden />
                Lead discovery
              </div>
              <h1 className="text-2xl md:text-3xl font-headline font-semibold text-text tracking-tight">
                Descubre sitios con oportunidad
              </h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                Configura industria y geografía. El Scout genera dorks con IA,
                busca en SearXNG y encola leads para auditoría automática.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                Scout {scoutOnline ? "online" : "degraded"}
              </Chip>
              <Chip variant="default" color="primary" icon={<Sparkles className="size-3" />}>
                IA dorks
              </Chip>
            </div>
          </div>

          {/* Pipeline strip */}
          <div className="relative mt-6 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-stretch">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-1 items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "flex-1 rounded-lg border border-border/80 bg-surface-high/40 px-3 py-2.5",
                    "backdrop-blur-sm",
                  )}
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                    Paso {i + 1}
                  </div>
                  <div className="text-sm font-semibold text-text">{step.label}</div>
                  <div className="text-[11px] text-text-muted truncate">{step.desc}</div>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight
                    className="hidden sm:block size-4 text-text-muted shrink-0 mx-1"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Leads (24h)"
            value={leadsLast24h}
            formattedValue={leadsLast24h.toLocaleString()}
            variant={leadsLast24h > 0 ? "highlighted" : "default"}
            icon={<TrendingUp className="size-4" aria-hidden />}
          />
          <MetricCard
            label="Cola discovery"
            value={monitor?.queues.discovery ?? 0}
            formattedValue={String(monitor?.queues.discovery ?? "—")}
            icon={<Layers className="size-4" aria-hidden />}
          />
          <MetricCard
            label="Tasa auditada"
            value={auditedRate}
            formattedValue={`${auditedRate}%`}
            icon={<Search className="size-4" aria-hidden />}
          />
          <MetricCard
            label="Total leads"
            value={leadsData?.total ?? leads.length}
            formattedValue={(leadsData?.total ?? leads.length).toLocaleString()}
            icon={<Globe2 className="size-4" aria-hidden />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Configuration */}
          <Card
            className={cn(
              "lg:col-span-3 border-border/80 overflow-visible",
              "shadow-[0_0_0_1px_rgba(99,102,241,0.06)]",
            )}
          >
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Search className="size-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-headline font-semibold text-text">
                    Target configuration
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Define el mercado antes de lanzar el Scout
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5 overflow-visible">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                    Nicho (opcional)
                  </Label>
                  <Input
                    placeholder="ej. clínicas dentales, SaaS B2B, restaurantes"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="bg-surface-high/50 border-border/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                    Industria
                  </Label>
                  <Select
                    value={industry}
                    onValueChange={(v) => setIndustry(v ?? "")}
                  >
                    <SelectTrigger className="w-full bg-surface-high/50 border-border/80">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                    Geografía
                  </Label>
                  <Select
                    value={location || "__all__"}
                    onValueChange={(v) =>
                      setLocation(v === "__all__" || !v ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full bg-surface-high/50 border-border/80">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      <SelectItem value="__all__">Todas las regiones</SelectItem>
                      {LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface-high/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-text-muted">
                      Dorks a generar
                    </Label>
                    <p className="text-[11px] text-text-muted mt-1">
                      Consultas que el Scout usará en SearXNG (5–30)
                    </p>
                  </div>
                  <span className="text-2xl font-mono font-bold text-primary tabular-nums">
                    {numDorks}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={numDorks}
                  onChange={(e) => setNumDorks(Number(e.target.value))}
                  className="w-full h-2 rounded-full bg-surface-high accent-primary cursor-pointer"
                  aria-label={`Dorks: ${numDorks}`}
                />
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  <span>5</span>
                  <span>30</span>
                </div>
              </div>

              <Button
                onClick={handleStartDiscovery}
                disabled={isDiscovering}
                size="lg"
                className="w-full sm:w-auto min-w-[200px] shadow-[var(--sx-glow-primary)]"
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                    Iniciando Scout...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4 mr-2" aria-hidden />
                    Iniciar discovery
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Queue sidebar */}
          <Card className="lg:col-span-2 border-border/80 h-fit">
            <CardHeader className="pb-3">
              <h2 className="text-sm font-headline font-semibold text-text">
                Colas en vivo
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                [
                  ["Discovery", monitor?.queues.discovery],
                  ["Audit", monitor?.queues.audit],
                  ["Outreach", monitor?.queues.outreach],
                  ["DLQ", monitor?.queues.dlq],
                ] as const
              ).map(([label, depth]) => {
                const n = depth ?? 0;
                const pct = Math.min(100, (n / 50) * 100);
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{label}</span>
                      <span className="font-mono text-text">{n}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-high overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          label === "DLQ" && n > 0
                            ? "bg-danger"
                            : "bg-primary",
                        )}
                        style={{ width: `${Math.max(n > 0 ? 8 : 0, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-text-muted pt-2 leading-relaxed">
                Los leads nuevos aparecen en{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => navigate("/leads")}
                >
                  Leads
                </button>{" "}
                cuando el Scout los registra.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent discoveries */}
        <Card className="border-border/80 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-border/60 py-4">
            <div>
              <h2 className="text-base font-headline font-semibold text-text">
                Descubrimientos recientes
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Últimos dominios capturados por el pipeline
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => navigate("/leads")}
            >
              Ver todos
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="size-12 rounded-2xl bg-surface-high flex items-center justify-center mb-4">
                  <Radar className="size-6 text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary font-medium">
                  Aún no hay leads
                </p>
                <p className="text-xs text-text-muted mt-1 max-w-sm">
                  Lanza un discovery arriba para poblar esta lista.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-text-muted bg-surface-high/30">
                  <span>Dominio</span>
                  <span>Empresa</span>
                  <span>Segmento</span>
                  <span>Fecha</span>
                  <span className="text-right">Acción</span>
                </div>
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-3 hover:bg-surface-high/40 transition-colors"
                  >
                    <span className="text-sm font-mono text-primary font-medium truncate">
                      {lead.normalized_domain}
                    </span>
                    <span className="text-sm text-text truncate">
                      {lead.company_name || "—"}
                    </span>
                    <Chip
                      variant="solid"
                      color={segmentChipColor(lead.segment)}
                      className="text-[10px]"
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
                      className="h-8 text-xs justify-self-end"
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
      </div>
    </PageContainer>
  );
}
