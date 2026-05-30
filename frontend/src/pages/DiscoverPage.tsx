import { useState } from "react";
import { notify } from "@/lib/notify";
import { Search, Rocket, Radar, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useLeads, useMonitorStatus } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";
import { Chip } from "@/components/domain/Chip";
import { StatusLED } from "@/components/domain/StatusLED";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DISCOVER_COUNTRIES,
  DISCOVER_INDUSTRIES,
} from "@/lib/discover-options";

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
  const [country, setCountry] = useState("");
  const [numDorks, setNumDorks] = useState(15);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const { data: leadsData } = useLeads({ limit: 100 });
  const { data: monitor } = useMonitorStatus();

  const leads = leadsData?.items ?? [];
  const recentLeads = leads.slice(0, 8);

  const scoutOnline =
    monitor?.services?.find((s) => s.name === "Scout")?.status === "online";
  const discoveryQueue = monitor?.queues.discovery ?? 0;

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
        location: country || undefined,
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
                className="w-full h-2 rounded-full bg-surface-high accent-primary cursor-pointer"
                aria-label={`Dorks: ${numDorks}`}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <Button
                onClick={handleStartDiscovery}
                disabled={isDiscovering}
                size="lg"
                className="w-full sm:w-auto min-w-[200px]"
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />
                    Iniciando Scout...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4 mr-2" aria-hidden />
                    Lanzar búsqueda
                  </>
                )}
              </Button>
              {discoveryQueue > 0 && (
                <p className="text-xs text-text-muted">
                  Cola discovery:{" "}
                  <span className="font-mono text-text">{discoveryQueue}</span>
                  {" · "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => navigate("/monitor")}
                  >
                    Monitor
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-border/60 py-4">
            <div>
              <h2 className="text-base font-headline font-semibold text-text">
                Resultados de esta sesión
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Últimos dominios capturados (segmentos A–C prioritarios)
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
            {recentLeads.length === 0 ? (
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
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 sm:gap-3 sm:items-center px-4 py-3 hover:bg-surface-high/40 transition-colors"
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
      </div>
    </PageContainer>
  );
}
