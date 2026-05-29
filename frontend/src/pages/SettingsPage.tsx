import { useState } from "react";
import {
  Settings,
  Puzzle,
  Key,
  Radar,
  ClipboardCheck,
  Wand2,
  Target,
  Copy,
  RefreshCw,
  AlertTriangle,
  Mail,
} from "lucide-react";

/* ── Mock Data ── */
const MODULES = [
  { name: "Scout", desc: "Lead Discovery & Extraction", icon: Radar, enabled: true },
  { name: "Auditor", desc: "Integrity & Quality Check", icon: ClipboardCheck, enabled: true },
  { name: "Closer", desc: "Conversion Optimization", icon: Wand2, enabled: false },
  { name: "Sniper", desc: "Precision Targeting Logic", icon: Target, enabled: true },
];

const API_KEYS = [
  { name: "DeepSeek", status: "Active" as const, value: "sk-••••••••••••••••34a1" },
  { name: "Brave Search", status: "Active" as const, value: "br-••••••••••••••••99f2" },
  { name: "Resend", status: "Pending" as const, value: "re-••••••••••••••••00x1" },
];

const glassCard = {
  background: "rgba(33, 30, 39, 0.8)",
  backdropFilter: "blur(12px)",
  border: "1px solid var(--sx-border)",
  borderRadius: "var(--radius-md)",
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "var(--sx-text-muted)",
};

export function SettingsPage() {
  const [modules, setModules] = useState(MODULES);

  const toggleModule = (idx: number) => {
    setModules((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, enabled: !m.enabled } : m))
    );
  };

  return (
    <section className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--sx-text)" }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--sx-text-muted)" }}>
          Global system configuration and module orchestration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: General & Modules */}
        <div className="lg:col-span-7 space-y-6">
          {/* General Settings */}
          <div className="p-6" style={glassCard}>
            <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: "1px solid var(--sx-border)" }}>
              <Settings className="w-5 h-5" style={{ color: "var(--sx-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--sx-text)" }}>
                General Settings
              </h2>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>App Name</label>
                <input
                  type="text"
                  defaultValue="SIPHON-X"
                  className="py-2 px-4 text-sm outline-none transition-all"
                  style={{
                    background: "var(--sx-bg-lower)",
                    border: "1px solid var(--sx-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--sx-text)",
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label style={labelStyle}>Timezone</label>
                  <select
                    className="py-2 px-4 text-sm outline-none appearance-none cursor-pointer"
                    style={{
                      background: "var(--sx-bg-lower)",
                      border: "1px solid var(--sx-border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--sx-text)",
                    }}
                  >
                    <option>UTC (GMT+0)</option>
                    <option selected>PST (GMT-8)</option>
                    <option>EST (GMT-5)</option>
                    <option>CET (GMT+1)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label style={labelStyle}>Language</label>
                  <select
                    className="py-2 px-4 text-sm outline-none appearance-none cursor-pointer"
                    style={{
                      background: "var(--sx-bg-lower)",
                      border: "1px solid var(--sx-border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--sx-text)",
                    }}
                  >
                    <option selected>English (US)</option>
                    <option>German</option>
                    <option>Japanese</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Module Orchestration */}
          <div className="p-6" style={glassCard}>
            <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: "1px solid var(--sx-border)" }}>
              <Puzzle className="w-5 h-5" style={{ color: "var(--sx-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--sx-text)" }}>
                Module Orchestration
              </h2>
            </div>
            <div className="space-y-2">
              {modules.map((mod, i) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.name}
                    className="flex items-center justify-between p-3 rounded transition-colors group"
                    style={{
                      background: mod.enabled ? "rgba(139, 92, 246, 0.05)" : "transparent",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--sx-surface-high)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = mod.enabled
                        ? "rgba(139, 92, 246, 0.05)"
                        : "transparent")
                    }
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded flex items-center justify-center"
                        style={{
                          background: "rgba(139, 92, 246, 0.1)",
                          color: "var(--sx-primary)",
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--sx-text)" }}>
                          {mod.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--sx-text-muted)" }}>
                          {mod.desc}
                        </p>
                      </div>
                    </div>
                    <Toggle checked={mod.enabled} onChange={() => toggleModule(i)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: API, SMTP & Danger */}
        <div className="lg:col-span-5 space-y-6">
          {/* API Vault */}
          <div className="p-6" style={glassCard}>
            <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: "1px solid var(--sx-border)" }}>
              <Key className="w-5 h-5" style={{ color: "var(--sx-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--sx-text)" }}>
                API Vault
              </h2>
            </div>
            <div className="space-y-4">
              {API_KEYS.map((api) => (
                <div
                  key={api.name}
                  className="p-3 rounded border"
                  style={{ background: "var(--sx-bg-lower)", borderColor: "var(--sx-border)" }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--sx-text)" }}>
                      {api.name}
                    </p>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded border font-bold uppercase"
                      style={{
                        background:
                          api.status === "Active"
                            ? "rgba(139, 92, 246, 0.1)"
                            : "rgba(73, 68, 84, 0.1)",
                        color:
                          api.status === "Active" ? "var(--sx-primary)" : "var(--sx-text-muted)",
                        borderColor:
                          api.status === "Active"
                            ? "rgba(139, 92, 246, 0.2)"
                            : "rgba(73, 68, 84, 0.2)",
                      }}
                    >
                      {api.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      readOnly
                      value={api.value}
                      className="flex-1 px-3 py-1.5 text-xs font-mono outline-none"
                      style={{
                        background: "var(--sx-bg-lower)",
                        border: "1px solid var(--sx-border)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--sx-text-muted)",
                      }}
                    />
                    <button
                      className="p-1.5 transition-colors"
                      style={{ color: "var(--sx-text-muted)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sx-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sx-text-muted)")}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 transition-colors"
                      style={{ color: "var(--sx-text-muted)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sx-danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sx-text-muted)")}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SMTP Relay */}
          <div className="p-6" style={glassCard}>
            <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: "1px solid var(--sx-border)" }}>
              <Mail className="w-5 h-5" style={{ color: "var(--sx-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--sx-text)" }}>
                SMTP Relay
              </h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 flex flex-col gap-1.5">
                  <label style={{ ...labelStyle, fontSize: 10 }}>Host</label>
                  <input
                    type="text"
                    placeholder="smtp.resend.com"
                    className="px-3 py-1.5 text-xs outline-none"
                    style={{
                      background: "var(--sx-bg-lower)",
                      border: "1px solid var(--sx-border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--sx-text)",
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label style={{ ...labelStyle, fontSize: 10 }}>Port</label>
                  <input
                    type="text"
                    placeholder="587"
                    className="px-3 py-1.5 text-xs outline-none"
                    style={{
                      background: "var(--sx-bg-lower)",
                      border: "1px solid var(--sx-border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--sx-text)",
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label style={{ ...labelStyle, fontSize: 10 }}>Username</label>
                <input
                  type="text"
                  placeholder="siphon-x-auth"
                  className="px-3 py-1.5 text-xs outline-none"
                  style={{
                    background: "var(--sx-bg-lower)",
                    border: "1px solid var(--sx-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--sx-text)",
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label style={{ ...labelStyle, fontSize: 10 }}>Password</label>
                <input
                  type="password"
                  value="••••••••••••••••"
                  className="px-3 py-1.5 text-xs outline-none"
                  style={{
                    background: "var(--sx-bg-lower)",
                    border: "1px solid var(--sx-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--sx-text)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div
            className="p-6 rounded"
            style={{
              background: "rgba(239, 68, 68, 0.05)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: "1px solid rgba(239, 68, 68, 0.2)" }}>
              <AlertTriangle className="w-5 h-5" style={{ color: "var(--sx-danger)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--sx-danger)" }}>
                Danger Zone
              </h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--sx-text)" }}>
                    Reset System
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--sx-text-muted)" }}>
                    Revert all configurations to factory defaults.
                  </p>
                </div>
                <button
                  className="px-4 py-1.5 text-xs font-semibold border transition-all"
                  style={{
                    borderColor: "rgba(239, 68, 68, 0.5)",
                    color: "var(--sx-danger)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  Reset
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--sx-text)" }}>
                    Purge Database
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--sx-text-muted)" }}>
                    Irreversibly delete all logs and cached data.
                  </p>
                </div>
                <button
                  className="px-4 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: "var(--sx-danger)",
                    color: "#fff",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  Purge
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="flex justify-end gap-4 pt-6" style={{ borderTop: "1px solid var(--sx-border)" }}>
        <button
          className="px-6 py-2 text-sm font-semibold border transition-colors"
          style={{
            borderColor: "var(--sx-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--sx-text-muted)",
          }}
        >
          Discard
        </button>
        <button
          className="px-6 py-2 text-sm font-semibold transition-all"
          style={{
            background: "var(--sx-primary-container)",
            borderRadius: "var(--radius-sm)",
            color: "#fff",
          }}
        >
          Save Configuration
        </button>
      </div>
    </section>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div
        className="w-11 h-6 rounded-full peer transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
        style={{
          background: checked ? "var(--sx-primary-container)" : "var(--sx-border)",
        }}
      />
      <div
        className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white transition-all"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </label>
  );
}
