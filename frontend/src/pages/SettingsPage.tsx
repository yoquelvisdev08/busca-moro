import { useState } from "react";
import toast from "react-hot-toast";
import {
  Key,
  Mail,
  Building,
  Shield,
  Copy,
  RefreshCw,
  Save,
} from "lucide-react";
import { useSenderProfile } from "@/lib/hooks";
import { Card } from "@/design-system/components/Card";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Badge } from "@/design-system/components/Badge";
import { colors } from "@/design-system/tokens";

const SECTION_ITEMS = [
  { key: "profile", label: "Agency Profile", icon: Building },
  { key: "email", label: "Email Config", icon: Mail },
  { key: "followups", label: "Follow-up Defaults", icon: Shield },
  { key: "apikeys", label: "API Keys", icon: Key },
] as const;

type SectionKey = (typeof SECTION_ITEMS)[number]["key"];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const { data: senderProfile } = useSenderProfile();

  /* ── Form state ── */
  const [companyName, setCompanyName] = useState(senderProfile?.company ?? "");
  const [website, setWebsite] = useState(senderProfile?.website ?? "");
  const [primaryColor, setPrimaryColor] = useState("#8b5cf6");
  const [resendKey, setResendKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [braveKey, setBraveKey] = useState("");

  const handleSave = (section: string) => {
    toast.success(`${section} settings saved`);
  };

  return (
    <section style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>Settings</h1>
        <p style={{ fontSize: "13px", color: colors.textMuted }}>Configure your agency platform settings</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "24px", minHeight: "60vh" }}>
        {/* Side nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "12px", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "8px", height: "fit-content" }}>
          {SECTION_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms",
                background: activeSection === key ? "rgba(139, 92, 246, 0.1)" : "transparent",
                color: activeSection === key ? colors.primaryContainer : colors.textMuted,
                borderLeft: activeSection === key ? `2px solid ${colors.primaryContainer}` : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Agency Profile */}
          {activeSection === "profile" && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "12px", borderBottom: `1px solid ${colors.border}` }}>
                <Building size={18} style={{ color: colors.primary }} />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: 0 }}>Agency Profile</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <Input label="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Agency" />
                <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://your-agency.com" />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={labelStyle}>Primary Color</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ width: "36px", height: "36px", border: `1px solid ${colors.border}`, borderRadius: "4px", cursor: "pointer", background: "none" }}
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: colors.bg,
                        border: `1px solid ${colors.borderStrong}`,
                        borderRadius: "4px",
                        fontSize: "14px",
                        color: colors.text,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                  </div>
                </div>
                <Button onClick={() => handleSave("Profile")}>
                  <Save size={14} /> Save Profile
                </Button>
              </div>
            </Card>
          )}

          {/* Email Configuration */}
          {activeSection === "email" && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "12px", borderBottom: `1px solid ${colors.border}` }}>
                <Mail size={18} style={{ color: colors.primary }} />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: 0 }}>Email Configuration</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={labelStyle}>Resend API Key</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="password"
                      value={resendKey}
                      onChange={(e) => setResendKey(e.target.value)}
                      placeholder="re_••••••••••••••••"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: colors.bg,
                        border: `1px solid ${colors.borderStrong}`,
                        borderRadius: "4px",
                        fontSize: "14px",
                        color: colors.text,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(resendKey)}>
                      <Copy size={14} />
                    </Button>
                  </div>
                </div>
                <Input label="Sender Email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="outreach@your-agency.com" />
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button onClick={() => handleSave("Email")}>
                    <Save size={14} /> Save Email Settings
                  </Button>
                  <Button variant="secondary" onClick={() => toast.success("Test email sent")}>
                    <RefreshCw size={14} /> Test Email
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Follow-up Defaults */}
          {activeSection === "followups" && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "12px", borderBottom: `1px solid ${colors.border}` }}>
                <Shield size={18} style={{ color: colors.primary }} />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: 0 }}>Follow-up Defaults</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>
                  Configure default follow-up sequence steps. These are applied when scheduling follow-ups from lead detail pages.
                </p>
                {[0, 3, 7].map((day, i) => (
                  <div key={day} style={{ padding: "12px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <Badge variant="info">Step {i + 1}</Badge>
                      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted }}>
                        Day {day}
                      </span>
                    </div>
                    <Input
                      label="Subject"
                      defaultValue={day === 0 ? "Initial outreach proposal" : day === 3 ? "Following up on our conversation" : "Last follow-up"}
                      wrapperStyle={{ marginBottom: "8px" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={labelStyle}>Body Template</label>
                      <textarea
                        defaultValue={
                          day === 0
                            ? "Hi! I noticed your site and wanted to share some insights..."
                            : day === 3
                              ? "Just following up on my previous message. Let me know if you have questions."
                              : "One last follow-up. I'd love to discuss how we can help."
                        }
                        style={{
                          width: "100%",
                          minHeight: "80px",
                          padding: "8px 12px",
                          background: colors.bg,
                          border: `1px solid ${colors.borderStrong}`,
                          borderRadius: "4px",
                          fontSize: "13px",
                          color: colors.text,
                          resize: "vertical",
                          fontFamily: "var(--font-sans)",
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Button onClick={() => handleSave("Follow-up Defaults")}>
                  <Save size={14} /> Save Follow-up Settings
                </Button>
              </div>
            </Card>
          )}

          {/* API Keys */}
          {activeSection === "apikeys" && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "12px", borderBottom: `1px solid ${colors.border}` }}>
                <Key size={18} style={{ color: colors.primary }} />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: 0 }}>API Keys</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { name: "DeepSeek", key: deepseekKey, setter: setDeepseekKey, status: "Active" },
                  { name: "Brave Search", key: braveKey, setter: setBraveKey, status: "Pending" },
                  { name: "Resend", key: resendKey, setter: setResendKey, status: senderProfile ? "Active" : "Pending" },
                ].map((api) => (
                  <div key={api.name} style={{ padding: "12px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{api.name}</span>
                      <Badge variant={api.status === "Active" ? "success" : "warning"}>{api.status}</Badge>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="password"
                        value={api.key}
                        onChange={(e) => api.setter(e.target.value)}
                        placeholder={`${api.name.toLowerCase()}_api_key`}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          background: colors.bg,
                          border: `1px solid ${colors.borderStrong}`,
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          color: colors.text,
                        }}
                      />
                      <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(api.key)}>
                        <Copy size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button onClick={() => handleSave("API Keys")}>
                  <Save size={14} /> Save API Keys
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.textMuted,
  fontFamily: "var(--font-sans)",
};
