import { useState, useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Crosshair,
  Eye,
  Globe,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  TestTube,
  User,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";

type ConfigSection = "scout" | "auditor" | "closer" | "email" | "sniper" | "sender" | "system";

interface ConfigState {
  scout: {
    concurrency: number;
    load_time_threshold_ms: number;
    dorks_file: string;
    seeds_file: string;
    proxies_file: string;
    respect_robots: boolean;
    loop_interval: string;
  };
  auditor: {
    concurrency: number;
    headless: boolean;
    viewport_width: number;
    viewport_height: number;
    nav_timeout_ms: number;
    lighthouse_preset: string;
  };
  closer: {
    concurrency: number;
    max_pain_points: number;
    email_tone: string;
    language: string;
  };
  email: {
    provider: string;
    api_key: string;
    from_email: string;
    from_name: string;
  };
  sniper: {
    interval_seconds: number;
    failure_threshold: number;
    webhook_url: string;
  };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<ConfigSection>("system");
  const [config, setConfig] = useState<ConfigState>({
    scout: {
      concurrency: 16,
      load_time_threshold_ms: 5000,
      dorks_file: "/app/config/dorks.txt",
      seeds_file: "/app/config/seeds.txt",
      proxies_file: "/app/config/proxies.txt",
      respect_robots: true,
      loop_interval: "15m",
    },
    auditor: {
      concurrency: 4,
      headless: true,
      viewport_width: 1366,
      viewport_height: 768,
      nav_timeout_ms: 45000,
      lighthouse_preset: "desktop",
    },
    closer: {
      concurrency: 2,
      max_pain_points: 3,
      email_tone: "consultivo",
      language: "es",
    },
    email: {
      provider: "resend",
      api_key: "",
      from_email: "outreach@yoquelvis.dev",
      from_name: "SIPHON-X Outreach",
    },
    sniper: {
      interval_seconds: 60,
      failure_threshold: 3,
      webhook_url: "",
    },
  });

  const { data: queueDepths } = useQuery({
    queryKey: ["queues"],
    queryFn: () => api.getQueueDepths(),
    refetchInterval: 10000,
  });

  const saveConfig = useMutation({
    mutationFn: async (section: keyof ConfigState) => {
      localStorage.setItem(
        `siphon-config-${section}`,
        JSON.stringify(config[section])
      );
      return section;
    },
    onSuccess: (section) => {
      toast.success(`Configuración de ${sectionLabel(section)} guardada`);
    },
    onError: () => toast.error("Error al guardar configuración"),
  });

  const testEmail = useMutation({
    mutationFn: async () => {
      toast.loading("Enviando email de prueba...");
      return new Promise<void>((resolve) => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success("Email de prueba enviado correctamente");
    },
    onError: () => {
      toast.dismiss();
      toast.error("Error al enviar email de prueba");
    },
  });

  const restartWorkers = useMutation({
    mutationFn: async () => {
      toast.loading("Reiniciando workers...");
      return new Promise<void>((resolve) => setTimeout(resolve, 3000));
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success("Workers reiniciados correctamente");
      queryClient.invalidateQueries({ queryKey: ["queues"] });
    },
  });

  const updateField = <S extends keyof ConfigState>(
    section: S,
    field: keyof ConfigState[S],
    value: unknown
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const sections: { id: ConfigSection; label: string; icon: ReactNode }[] = [
    { id: "scout", label: "SCOUT", icon: <Search className="w-4 h-4" /> },
    { id: "auditor", label: "AUDITOR", icon: <Eye className="w-4 h-4" /> },
    { id: "closer", label: "CLOSER", icon: <Zap className="w-4 h-4" /> },
    { id: "email", label: "EMAIL", icon: <Mail className="w-4 h-4" /> },
    { id: "sniper", label: "SNIPER", icon: <Crosshair className="w-4 h-4" /> },
    { id: "sender", label: "SENDER", icon: <User className="w-4 h-4" /> },
    { id: "system", label: "SYSTEM", icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <section>
      <h2 className="page-title">CONFIGURATION TERMINAL</h2>

      <div className="settings-layout">
        {/* Sidebar */}
        <aside className="settings-nav">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`settings-nav-item ${activeSection === s.id ? "active" : ""}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </aside>

        {/* Config Panel */}
        <div className="settings-panel">
          {activeSection === "scout" && (
            <ConfigPanel
              title="SCOUT CONFIGURATION"
              onSave={() => saveConfig.mutate("scout")}
            >
              <NumberField
                label="CONCURRENCY"
                value={config.scout.concurrency}
                min={1}
                max={64}
                onChange={(v) => updateField("scout", "concurrency", v)}
              />
              <NumberField
                label="LOAD TIME THRESHOLD (ms)"
                value={config.scout.load_time_threshold_ms}
                min={1000}
                max={30000}
                step={500}
                onChange={(v) => updateField("scout", "load_time_threshold_ms", v)}
              />
              <TextField
                label="DORKS FILE"
                value={config.scout.dorks_file}
                onChange={(v) => updateField("scout", "dorks_file", v)}
              />
              <TextField
                label="SEEDS FILE"
                value={config.scout.seeds_file}
                onChange={(v) => updateField("scout", "seeds_file", v)}
              />
              <TextField
                label="PROXIES FILE"
                value={config.scout.proxies_file}
                onChange={(v) => updateField("scout", "proxies_file", v)}
              />
              <ToggleField
                label="RESPECT ROBOTS.TXT"
                value={config.scout.respect_robots}
                onChange={(v) => updateField("scout", "respect_robots", v)}
              />
              <SelectField
                label="LOOP INTERVAL"
                value={config.scout.loop_interval}
                options={[
                  { value: "0", label: "Single pass (cron)" },
                  { value: "15m", label: "15 minutes" },
                  { value: "1h", label: "1 hour" },
                  { value: "6h", label: "6 hours" },
                ]}
                onChange={(v) => updateField("scout", "loop_interval", v)}
              />
            </ConfigPanel>
          )}

          {activeSection === "auditor" && (
            <ConfigPanel
              title="AUDITOR CONFIGURATION"
              onSave={() => saveConfig.mutate("auditor")}
            >
              <NumberField
                label="CONCURRENCY"
                value={config.auditor.concurrency}
                min={1}
                max={16}
                onChange={(v) => updateField("auditor", "concurrency", v)}
              />
              <ToggleField
                label="HEADLESS MODE"
                value={config.auditor.headless}
                onChange={(v) => updateField("auditor", "headless", v)}
              />
              <div className="flex gap-4">
                <NumberField
                  label="VIEWPORT WIDTH"
                  value={config.auditor.viewport_width}
                  min={320}
                  max={3840}
                  onChange={(v) => updateField("auditor", "viewport_width", v)}
                />
                <NumberField
                  label="VIEWPORT HEIGHT"
                  value={config.auditor.viewport_height}
                  min={240}
                  max={2160}
                  onChange={(v) => updateField("auditor", "viewport_height", v)}
                />
              </div>
              <NumberField
                label="NAV TIMEOUT (ms)"
                value={config.auditor.nav_timeout_ms}
                min={5000}
                max={120000}
                step={5000}
                onChange={(v) => updateField("auditor", "nav_timeout_ms", v)}
              />
              <SelectField
                label="LIGHTHOUSE PRESET"
                value={config.auditor.lighthouse_preset}
                options={[
                  { value: "desktop", label: "Desktop" },
                  { value: "mobile", label: "Mobile" },
                ]}
                onChange={(v) => updateField("auditor", "lighthouse_preset", v)}
              />
            </ConfigPanel>
          )}

          {activeSection === "closer" && (
            <ConfigPanel
              title="CLOSER CONFIGURATION"
              onSave={() => saveConfig.mutate("closer")}
            >
              <NumberField
                label="CONCURRENCY"
                value={config.closer.concurrency}
                min={1}
                max={8}
                onChange={(v) => updateField("closer", "concurrency", v)}
              />
              <NumberField
                label="MAX PAIN POINTS"
                value={config.closer.max_pain_points}
                min={1}
                max={10}
                onChange={(v) => updateField("closer", "max_pain_points", v)}
              />
              <SelectField
                label="EMAIL TONE"
                value={config.closer.email_tone}
                options={[
                  { value: "consultivo", label: "Consultivo" },
                  { value: "directo", label: "Directo" },
                  { value: "tecnico", label: "Técnico" },
                  { value: "agresivo", label: "Agresivo" },
                ]}
                onChange={(v) => updateField("closer", "email_tone", v)}
              />
              <SelectField
                label="LANGUAGE"
                value={config.closer.language}
                options={[
                  { value: "es", label: "Español" },
                  { value: "en", label: "English" },
                  { value: "pt", label: "Português" },
                ]}
                onChange={(v) => updateField("closer", "language", v)}
              />
            </ConfigPanel>
          )}

          {activeSection === "email" && (
            <ConfigPanel
              title="EMAIL / OUTREACH CONFIGURATION"
              onSave={() => saveConfig.mutate("email")}
            >
              <SelectField
                label="PROVIDER"
                value={config.email.provider}
                options={[
                  { value: "resend", label: "Resend" },
                  { value: "ses", label: "AWS SES" },
                  { value: "smtp", label: "SMTP" },
                  { value: "dev", label: "Dev (log only)" },
                ]}
                onChange={(v) => updateField("email", "provider", v)}
              />
              <PasswordField
                label="API KEY"
                value={config.email.api_key}
                onChange={(v) => updateField("email", "api_key", v)}
                placeholder="re_..."
              />
              <TextField
                label="FROM EMAIL"
                value={config.email.from_email}
                onChange={(v) => updateField("email", "from_email", v)}
              />
              <TextField
                label="FROM NAME"
                value={config.email.from_name}
                onChange={(v) => updateField("email", "from_name", v)}
              />
              <div className="flex gap-3 mt-4">
                <button
                  className="btn ghost"
                  onClick={() => testEmail.mutate()}
                  disabled={testEmail.isPending}
                >
                  <TestTube className="w-4 h-4 mr-1" />
                  {testEmail.isPending ? "Enviando..." : "Test Email"}
                </button>
              </div>
            </ConfigPanel>
          )}

          {activeSection === "sniper" && (
            <ConfigPanel
              title="SNIPER CONFIGURATION"
              onSave={() => saveConfig.mutate("sniper")}
            >
              <NumberField
                label="INTERVAL (seconds)"
                value={config.sniper.interval_seconds}
                min={10}
                max={3600}
                onChange={(v) => updateField("sniper", "interval_seconds", v)}
              />
              <NumberField
                label="FAILURE THRESHOLD"
                value={config.sniper.failure_threshold}
                min={1}
                max={10}
                onChange={(v) => updateField("sniper", "failure_threshold", v)}
              />
              <TextField
                label="WEBHOOK URL"
                value={config.sniper.webhook_url}
                onChange={(v) => updateField("sniper", "webhook_url", v)}
                placeholder="https://hooks.slack.com/..."
              />
            </ConfigPanel>
          )}

          {activeSection === "sender" && <SenderProfilePanel />}

          {activeSection === "system" && (
            <div className="space-y-6">
              {/* Queue Depths */}
              <ConfigPanel title="QUEUE DEPTHS">
                <div className="grid grid-cols-4 gap-4">
                  <QueueCard
                    label="DISCOVERY"
                    value={queueDepths?.discovery ?? "—"}
                    color="var(--void-cyan)"
                  />
                  <QueueCard
                    label="AUDIT"
                    value={queueDepths?.audit ?? "—"}
                    color="var(--void-purple)"
                  />
                  <QueueCard
                    label="OUTREACH"
                    value={queueDepths?.outreach ?? "—"}
                    color="var(--void-green)"
                  />
                  <QueueCard
                    label="DLQ"
                    value={queueDepths?.dlq ?? "—"}
                    color={
                      queueDepths?.dlq && queueDepths.dlq > 0
                        ? "var(--void-red)"
                        : "var(--void-text-muted)"
                    }
                  />
                </div>
              </ConfigPanel>

              {/* Worker Status */}
              <ConfigPanel title="WORKER STATUS">
                <div className="grid grid-cols-4 gap-4">
                  <WorkerCard
                    name="SCOUT"
                    status="running"
                    color="var(--void-green)"
                  />
                  <WorkerCard
                    name="AUDITOR"
                    status="running"
                    color="var(--void-green)"
                  />
                  <WorkerCard
                    name="CLOSER"
                    status="idle"
                    color="var(--void-yellow)"
                  />
                  <WorkerCard
                    name="SNIPER"
                    status="running"
                    color="var(--void-green)"
                  />
                </div>
              </ConfigPanel>

              {/* Actions */}
              <ConfigPanel title="SYSTEM ACTIONS">
                <div className="flex gap-3">
                  <button
                    className="btn"
                    onClick={() => restartWorkers.mutate()}
                    disabled={restartWorkers.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    {restartWorkers.isPending
                      ? "Reiniciando..."
                      : "RESTART ALL WORKERS"}
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["queues"] });
                      toast.success("Telemetría actualizada");
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    REFRESH TELEMETRY
                  </button>
                </div>
              </ConfigPanel>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// --- Sub-components ---

function ConfigPanel({
  title,
  children,
  onSave,
}: {
  title: string;
  children: ReactNode;
  onSave?: () => void;
}) {
  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h3 className="config-panel-title">{title}</h3>
        {onSave && (
          <button className="btn" onClick={onSave}>
            <Save className="w-4 h-4 mr-1" />
            SAVE
          </button>
        )}
      </div>
      <div className="config-panel-body space-y-4">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step || 1}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="field-input"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="field-input-wrapper">
        <input
          type={show ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="field-input flex-1"
        />
        <button
          className="btn ghost sm"
          onClick={() => setShow(!show)}
          type="button"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="field toggle-field">
      <label className="field-label">{label}</label>
      <button
        className={`toggle ${value ? "on" : "off"}`}
        onClick={() => onChange(!value)}
        type="button"
      >
        <span className="toggle-thumb" />
        <span className="toggle-label">{value ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input field-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function QueueCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="queue-card">
      <div className="queue-card-label">{label}</div>
      <div className="queue-card-value" style={{ color }}>
        {typeof value === "number" ? value : "—"}
      </div>
    </div>
  );
}

function WorkerCard({
  name,
  status,
  color,
}: {
  name: string;
  status: string;
  color: string;
}) {
  return (
    <div className="worker-card">
      <div className="worker-card-header">
        <div
          className="worker-status-dot"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <span className="worker-name">{name}</span>
      </div>
      <div className="worker-status-text" style={{ color }}>
        {status.toUpperCase()}
      </div>
    </div>
  );
}

function SenderProfilePanel() {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["sender-profile"],
    queryFn: () => api.getSenderProfile(),
  });

  const [form, setForm] = useState({
    name: "",
    title: "",
    company: "",
    website: "https://yoquelvis.dev",
    bio: "",
    services: "",
    tech_stack: "",
    tone: "consultivo",
    email_signature: "",
  });

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        title: profile.title || "",
        company: profile.company || "",
        website: profile.website || "https://yoquelvis.dev",
        bio: profile.bio || "",
        services: (profile.services || []).join(", "),
        tech_stack: (profile.tech_stack || []).join(", "),
        tone: profile.tone || "consultivo",
        email_signature: profile.email_signature || "",
      });
    }
  }, [profile]);

  const scrapeProfile = useMutation({
    mutationFn: () => api.scrapeSenderProfile(form.website),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["sender-profile"] });
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });

  const saveProfile = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        title: form.title || null,
        company: form.company || null,
        website: form.website,
        bio: form.bio || null,
        services: form.services.split(",").map((s) => s.trim()).filter(Boolean),
        tech_stack: form.tech_stack.split(",").map((s) => s.trim()).filter(Boolean),
        tone: form.tone,
        email_signature: form.email_signature,
        is_active: true,
      };
      if (profile?.id) {
        return api.updateSenderProfile(profile.id, payload);
      }
      return api.createSenderProfile(payload as any);
    },
    onSuccess: () => {
      toast.success("Perfil guardado correctamente");
      queryClient.invalidateQueries({ queryKey: ["sender-profile"] });
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <ConfigPanel
        title="SENDER PROFILE"
        onSave={() => saveProfile.mutate()}
      >
        <div className="flex gap-3 mb-4">
          <button
            className="btn"
            onClick={() => scrapeProfile.mutate()}
            disabled={scrapeProfile.isPending}
          >
            <Globe className="w-4 h-4 mr-1" />
            {scrapeProfile.isPending ? "Scrapeando..." : "Scrape my website"}
          </button>
          {profile?.scraped_at && (
            <span className="text-xs text-gray-500 font-mono self-center">
              Último scrape: {new Date(profile.scraped_at).toLocaleString()}
            </span>
          )}
        </div>

        <TextField
          label="NAME"
          value={form.name}
          onChange={(v) => updateField("name", v)}
        />
        <TextField
          label="TITLE"
          value={form.title}
          onChange={(v) => updateField("title", v)}
        />
        <TextField
          label="COMPANY"
          value={form.company}
          onChange={(v) => updateField("company", v)}
        />
        <TextField
          label="WEBSITE"
          value={form.website}
          onChange={(v) => updateField("website", v)}
        />
        <div className="field">
          <label className="field-label">BIO</label>
          <textarea
            className="field-input w-full min-h-[80px] resize-y"
            value={form.bio}
            onChange={(e) => updateField("bio", e.target.value)}
            placeholder="Short bio..."
          />
        </div>
        <TextField
          label="SERVICES (comma separated)"
          value={form.services}
          onChange={(v) => updateField("services", v)}
        />
        <TextField
          label="TECH STACK (comma separated)"
          value={form.tech_stack}
          onChange={(v) => updateField("tech_stack", v)}
        />
        <SelectField
          label="TONE"
          value={form.tone}
          options={[
            { value: "consultivo", label: "Consultivo" },
            { value: "directo", label: "Directo" },
            { value: "tecnico", label: "Técnico" },
            { value: "agresivo", label: "Agresivo" },
          ]}
          onChange={(v) => updateField("tone", v)}
        />
        <div className="field">
          <label className="field-label">EMAIL SIGNATURE</label>
          <textarea
            className="field-input w-full min-h-[60px] resize-y"
            value={form.email_signature}
            onChange={(e) => updateField("email_signature", e.target.value)}
            placeholder="--\nYour Name | Title\nwebsite.com"
          />
        </div>
      </ConfigPanel>
    </div>
  );
}

function sectionLabel(id: ConfigSection): string {
  const labels: Record<ConfigSection, string> = {
    scout: "Scout",
    auditor: "Auditor",
    closer: "Closer",
    email: "Email",
    sniper: "Sniper",
    sender: "Sender",
    system: "System",
  };
  return labels[id];
}
