import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  ArrowRight,
  Flame,
  Inbox,
  MessageCircle,
  Radar,
  RefreshCw,
  Sparkles,
  Target,
  Waves,
} from "lucide-react";
import {
  usePoseidonRecentSignals,
  usePoseidonScanStatus,
  usePoseidonStats,
  useTriggerPoseidonScanMutation,
} from "@/lib/hooks";
import type { PoseidonSignal } from "@/lib/api";
import { MetricCard } from "@/components/charts/MetricCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { DataTable } from "@/components/tables/DataTable";
import { StatusLED } from "@/components/domain/StatusLED";
import { ScanProgressPanel, formatWhen } from "@/components/domain/ScanProgressPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const CATEGORY_LABELS: Record<string, string> = {
  web_dev: "Web / Dev",
  scraping: "Scraping",
  performance: "Performance",
  hosting: "Hosting",
  wordpress: "WordPress",
  general: "General",
};

function weekChartData(signals: PoseidonSignal[]) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - (6 - i));
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const count = signals.filter((s) => {
      const d = new Date(s.detected_at);
      return d >= dayStart && d <= dayEnd;
    }).length;
    return { name: DAY_LABELS[dayStart.getDay()], señales: count };
  });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = usePoseidonStats();
  const { data: recentData, isLoading: signalsLoading } = usePoseidonRecentSignals();
  const { data: scanStatus } = usePoseidonScanStatus();
  const scanMutation = useTriggerPoseidonScanMutation();

  const signals = recentData?.items ?? [];
  const total = stats?.total ?? 0;
  const utiles = stats?.actionable ?? 0;
  const contactadas = stats?.contacted ?? 0;
  const convertidas = stats?.converted ?? 0;
  const hotCount = stats?.high_intent ?? 0;

  const chartData = useMemo(() => weekChartData(signals), [signals]);
  const sparkline = chartData.map((d) => d.señales);

  const scanning = scanStatus?.active || scanMutation.isPending;

  const activityRows = useMemo(() => {
    return signals.slice(0, 8).map((s) => ({
      id: s.id,
      title: s.title || s.source_url.slice(0, 40),
      event:
        s.status === "new"
          ? "Nueva señal"
          : s.status === "contacted"
            ? "Contactado"
            : s.status === "converted"
              ? "En Orion"
              : "Actualizada",
      score: s.intent_score,
      status:
        s.status === "converted"
          ? ("success" as const)
          : s.status === "new"
            ? ("info" as const)
            : ("neutral" as const),
      when: formatWhen(s.detected_at),
    }));
  }, [signals]);

  const activityColumns = useMemo<ColumnDef<(typeof activityRows)[0], unknown>[]>(
    () => [
      {
        id: "title",
        header: "Señal",
        cell: ({ row }) => (
          <span className="truncate block max-w-[180px] text-xs text-text">{row.original.title}</span>
        ),
      },
      {
        id: "event",
        header: "Evento",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <StatusLED variant={row.original.status} size="sm" />
            <span className="text-xs text-text-secondary">{row.original.event}</span>
          </div>
        ),
      },
      {
        id: "score",
        header: "Score",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-primary">{row.original.score}</span>
        ),
      },
      {
        id: "when",
        header: "Hora",
        cell: ({ row }) => (
          <span className="text-[10px] font-mono text-text-dim">{row.original.when}</span>
        ),
      },
    ],
    [],
  );

  const handleScan = () => {
    scanMutation.mutate(undefined, {
      onSuccess: () => notify.success("Escaneo iniciado"),
      onError: () => notify.error("No se pudo iniciar el escaneo"),
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-headline font-semibold text-text">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">
          Personas en español pidiendo ayuda con web, scraping o performance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Útiles ES/LATAM"
          value={utiles}
          formattedValue={String(utiles)}
          variant="highlighted"
          icon={<Waves className="size-4" aria-hidden />}
          sparklineData={sparkline}
        />
        <MetricCard
          label="Total histórico"
          value={total}
          formattedValue={total.toLocaleString("es-ES")}
          icon={<Inbox className="size-4" aria-hidden />}
        />
        <MetricCard
          label="Alta intención (75+)"
          value={hotCount}
          formattedValue={String(hotCount)}
          icon={<Flame className="size-4" aria-hidden />}
        />
        <MetricCard
          label="En Orion"
          value={convertidas}
          formattedValue={String(convertidas)}
          icon={<Target className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AreaChart
            title="Señales detectadas"
            description="Actividad de los últimos 7 días"
            data={chartData}
            series={[{ dataKey: "señales", name: "Señales", color: "#22d3ee" }]}
            loading={signalsLoading || statsLoading}
          />
        </div>

        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <h3 className="text-sm font-headline font-medium text-text">Actividad reciente</h3>
          </CardHeader>
          <CardContent className="pt-0 px-0 pb-0">
            {activityRows.length === 0 ? (
              <p className="text-xs text-text-muted py-8 text-center px-4">
                Sin señales todavía. Lanza un escaneo.
              </p>
            ) : (
              <DataTable
                data={activityRows}
                columns={activityColumns}
                density="compact"
                getRowId={(row) => row.id}
                stickyFirstColumn={false}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Radar className="size-5 text-primary" aria-hidden />
              <div>
                <h3 className="text-sm font-headline font-semibold text-text">Escáner Reddit</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Último: {formatWhen(scanStatus?.last_scan_at)} ·{" "}
                  {scanStatus?.last_scan_saved ?? 0} guardadas
                </p>
              </div>
            </div>
            <Button
              onClick={handleScan}
              disabled={scanning}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn("size-4", scanning && "animate-spin")} />
              {scanning ? "Escaneando…" : "Escanear ahora"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <ScanProgressPanel scanStatus={scanStatus} scanning={scanning} />
          {scanStatus?.last_error && (
            <p className="text-xs text-warning">{scanStatus.last_error}</p>
          )}
          {!scanning && (
            <p className="text-[11px] text-text-dim">
              Solo posts en español · Arctic Shift · clasificación por keywords + IA opcional
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">Inbox</h3>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-text">{utiles}</div>
            <p className="text-xs text-text-muted mt-2">Señales útiles ES/LATAM</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs gap-1"
              onClick={() => navigate("/inbox")}
            >
              Abrir inbox
              <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">Contacto manual</h3>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-text">{contactadas}</div>
            <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
              <MessageCircle className="size-3" aria-hidden />
              Marcadas como contactadas
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs"
              onClick={() => navigate("/inbox?tab=contacted")}
            >
              Ver contactados
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-headline font-medium text-text">Pipeline Orion</h3>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StatusLED variant={convertidas > 0 ? "success" : "neutral"} pulse={convertidas > 0} />
              <span className="text-2xl font-mono font-bold text-text">{convertidas}</span>
            </div>
            <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
              <Sparkles className="size-3" aria-hidden />
              Convertidas a lead en Orion
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs gap-1"
              onClick={() => window.open("/orion/leads", "_blank", "noopener,noreferrer")}
            >
              Ver leads Orion
              <Activity className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {signals.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm font-headline font-medium text-text">Top señales nuevas</h3>
              <p className="text-xs text-text-muted mt-0.5">Mayor score de intención</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/inbox")}>
              Ver todas
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {signals
                .filter((s) => s.status === "new")
                .sort((a, b) => b.intent_score - a.intent_score)
                .slice(0, 5)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-high/40 transition-colors"
                  >
                    <span className="font-mono text-sm font-bold text-primary w-8">{s.intent_score}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text truncate">{s.title || "Sin título"}</p>
                      <p className="text-xs text-text-muted truncate">
                        {CATEGORY_LABELS[s.intent_category] ?? s.intent_category} · {s.platform}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {s.platform}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
