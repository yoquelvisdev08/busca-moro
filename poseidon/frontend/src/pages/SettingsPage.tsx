import { useEffect, useState } from "react";
import { Loader2, Radar, Save, Search, Shield, SlidersHorizontal } from "lucide-react";
import { usePoseidonConfig, useUpdatePoseidonConfigMutation } from "@/lib/hooks";
import type { PoseidonConfig, SubredditScan } from "@/lib/api";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(items: string[]): string {
  return items.join("\n");
}

function parseSubredditScans(text: string): SubredditScan[] {
  const rows: SubredditScan[] = [];
  for (const line of linesToList(text)) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      rows.push({ subreddit: parts[0], query: parts[1] });
    }
  }
  return rows;
}

function formatSubredditScans(items: SubredditScan[]): string {
  return items.map((row) => `${row.subreddit} | ${row.query}`).join("\n");
}

function applyConfigToForm(config: PoseidonConfig) {
  return {
    loopInterval: String(config.loop_interval_minutes),
    queryDelay: String(config.query_delay_seconds),
    resultsPerQuery: String(config.results_per_query),
    maxPostAge: String(config.max_post_age_days),
    minKeyword: String(config.min_keyword_score),
    minIntent: String(config.min_intent_score),
    minIntentNoLlm: String(config.min_intent_score_no_llm),
    maxLlm: String(config.max_llm_classifications),
    useLlm: config.use_llm,
    useArctic: config.use_arctic_shift,
    usePullpush: config.use_pullpush,
    useSearx: config.use_searx,
    requireSpanish: config.require_spanish,
    requireLatam: config.require_latam_or_spain,
    queriesText: listToLines(config.search_queries),
    subredditScansText: formatSubredditScans(config.subreddit_scans),
    querySubredditsText: listToLines(config.query_subreddits),
    searxDomainsText: listToLines(config.searx_domains),
  };
}

export function SettingsPage() {
  const { data: config, isLoading } = usePoseidonConfig();
  const updateMutation = useUpdatePoseidonConfigMutation();

  const [loopInterval, setLoopInterval] = useState("45");
  const [queryDelay, setQueryDelay] = useState("1");
  const [resultsPerQuery, setResultsPerQuery] = useState("20");
  const [maxPostAge, setMaxPostAge] = useState("120");
  const [minKeyword, setMinKeyword] = useState("25");
  const [minIntent, setMinIntent] = useState("45");
  const [minIntentNoLlm, setMinIntentNoLlm] = useState("32");
  const [maxLlm, setMaxLlm] = useState("40");
  const [useLlm, setUseLlm] = useState(true);
  const [useArctic, setUseArctic] = useState(true);
  const [usePullpush, setUsePullpush] = useState(false);
  const [useSearx, setUseSearx] = useState(true);
  const [requireSpanish, setRequireSpanish] = useState(true);
  const [requireLatam, setRequireLatam] = useState(true);
  const [queriesText, setQueriesText] = useState("");
  const [subredditScansText, setSubredditScansText] = useState("");
  const [querySubredditsText, setQuerySubredditsText] = useState("");
  const [searxDomainsText, setSearxDomainsText] = useState("");

  useEffect(() => {
    if (!config) return;
    const form = applyConfigToForm(config);
    setLoopInterval(form.loopInterval);
    setQueryDelay(form.queryDelay);
    setResultsPerQuery(form.resultsPerQuery);
    setMaxPostAge(form.maxPostAge);
    setMinKeyword(form.minKeyword);
    setMinIntent(form.minIntent);
    setMinIntentNoLlm(form.minIntentNoLlm);
    setMaxLlm(form.maxLlm);
    setUseLlm(form.useLlm);
    setUseArctic(form.useArctic);
    setUsePullpush(form.usePullpush);
    setUseSearx(form.useSearx);
    setRequireSpanish(form.requireSpanish);
    setRequireLatam(form.requireLatam);
    setQueriesText(form.queriesText);
    setSubredditScansText(form.subredditScansText);
    setQuerySubredditsText(form.querySubredditsText);
    setSearxDomainsText(form.searxDomainsText);
  }, [config]);

  const saveAll = async () => {
    try {
      await updateMutation.mutateAsync({
        loop_interval_minutes: Number(loopInterval),
        query_delay_seconds: Number(queryDelay),
        results_per_query: Number(resultsPerQuery),
        max_post_age_days: Number(maxPostAge),
        min_keyword_score: Number(minKeyword),
        min_intent_score: Number(minIntent),
        min_intent_score_no_llm: Number(minIntentNoLlm),
        max_llm_classifications: Number(maxLlm),
        use_llm: useLlm,
        use_arctic_shift: useArctic,
        use_pullpush: usePullpush,
        use_searx: useSearx,
        require_spanish: requireSpanish,
        require_latam_or_spain: requireLatam,
        search_queries: linesToList(queriesText),
        subreddit_scans: parseSubredditScans(subredditScansText),
        query_subreddits: linesToList(querySubredditsText),
        searx_domains: linesToList(searxDomainsText),
      });
      notify.success("Configuración guardada");
    } catch (error) {
      notify.error(`No se pudo guardar: ${(error as Error).message}`);
    }
  };

  if (isLoading && !config) {
    return (
      <div className="flex items-center justify-center p-12 text-text-muted">
        <Loader2 className="size-5 animate-spin mr-2" />
        Cargando configuración…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-headline font-semibold text-text">Configuración</h1>
          <p className="text-sm text-text-muted mt-1">
            Fuentes, queries y filtros de calidad. Solo español / LATAM por defecto.
          </p>
        </div>
        <Button onClick={() => void saveAll()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Guardar cambios
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Radar className="size-4 text-primary" />
            Fuentes de búsqueda
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ToggleRow label="Arctic Shift (Reddit)" checked={useArctic} onChange={setUseArctic} />
          <ToggleRow label="PullPush (Reddit backup)" checked={usePullpush} onChange={setUsePullpush} />
          <ToggleRow label="SearXNG (foros web)" checked={useSearx} onChange={setUseSearx} />
          <ToggleRow label="Clasificación LLM" checked={useLlm} onChange={setUseLlm} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="size-4 text-primary" />
            Filtros de calidad
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ToggleRow
            label="Solo contenido en español"
            checked={requireSpanish}
            onChange={setRequireSpanish}
          />
          <ToggleRow
            label="Solo España / LATAM"
            checked={requireLatam}
            onChange={setRequireLatam}
          />
          <Field label="Score mínimo keywords" value={minKeyword} onChange={setMinKeyword} />
          <Field label="Score mínimo con LLM" value={minIntent} onChange={setMinIntent} />
          <Field label="Score mínimo sin LLM" value={minIntentNoLlm} onChange={setMinIntentNoLlm} />
          <Field label="Máx. clasificaciones LLM / scan" value={maxLlm} onChange={setMaxLlm} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="size-4 text-primary" />
            Intervalos
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Escaneo automático (minutos)" value={loopInterval} onChange={setLoopInterval} />
          <Field label="Delay entre queries (seg)" value={queryDelay} onChange={setQueryDelay} />
          <Field label="Resultados por query" value={resultsPerQuery} onChange={setResultsPerQuery} />
          <Field label="Antigüedad máx. posts (días)" value={maxPostAge} onChange={setMaxPostAge} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Search className="size-4 text-primary" />
            Queries y subreddits
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label className="text-xs text-text-muted">Queries de búsqueda (una por línea)</Label>
            <Textarea
              className="mt-1.5 min-h-[140px] font-mono text-xs"
              value={queriesText}
              onChange={(e) => setQueriesText(e.target.value)}
              placeholder="necesito ayuda con mi pagina web"
            />
          </div>
          <div>
            <Label className="text-xs text-text-muted">
              Escaneos fijos subreddit (formato: subreddit | query)
            </Label>
            <Textarea
              className="mt-1.5 min-h-[140px] font-mono text-xs"
              value={subredditScansText}
              onChange={(e) => setSubredditScansText(e.target.value)}
              placeholder="spain | necesito ayuda pagina web"
            />
          </div>
          <div>
            <Label className="text-xs text-text-muted">
              Subreddits para repetir cada query (uno por línea)
            </Label>
            <Textarea
              className="mt-1.5 min-h-[100px] font-mono text-xs"
              value={querySubredditsText}
              onChange={(e) => setQuerySubredditsText(e.target.value)}
              placeholder="spain"
            />
          </div>
          <div>
            <Label className="text-xs text-text-muted">
              Dominios SearXNG foros (uno por línea)
            </Label>
            <Textarea
              className="mt-1.5 min-h-[80px] font-mono text-xs"
              value={searxDomainsText}
              onChange={(e) => setSearxDomainsText(e.target.value)}
              placeholder="reddit.com"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-text-muted">{label}</Label>
      <Input className="mt-1.5" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
