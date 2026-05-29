import { useState } from "react";
import toast from "react-hot-toast";
import {
  Search,
  Rocket,
  TrendingUp,
  Cpu,
  Users,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLeads } from "@/lib/hooks";
import { Card } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { colors } from "@/design-system/tokens";

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

export function DiscoverPage() {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(2500);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const { data: leadsData } = useLeads({ limit: 5 });

  const recentLeads = (leadsData?.items ?? []).slice(0, 5);

  const handleStartDiscovery = async () => {
    if (!industry.trim()) {
      toast.error("Please select an industry");
      return;
    }
    setIsDiscovering(true);
    try {
      const result = await api.startDiscovery({ industry, location: location || undefined });
      toast.success(`${result.dorks_generated} dorks generated. Discovery started.`);
    } catch (e) {
      toast.error(`Discovery failed: ${(e as Error).message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <section style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Target Configuration */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <Search size={20} style={{ color: colors.primary }} />
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, margin: 0 }}>Target Configuration</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "end" }}>
          <Input
            label="Keywords"
            placeholder="e.g., SaaS, Fintech"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={labelStyle}>Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={labelStyle}>Geography</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={selectStyle}
            >
              <option value="">All locations</option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleStartDiscovery}
            loading={isDiscovering}
            size="lg"
          >
            <Rocket size={16} /> Start Discovery
          </Button>
        </div>

        {/* Max Results Slider */}
        <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={labelStyle}>Max Results</span>
            <span style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.primary }}>
              {maxResults.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "3px",
              background: colors.surfaceHigh,
              accentColor: colors.primaryContainer,
              cursor: "pointer",
              appearance: "auto",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: colors.textMuted }}>
            <span>100 leads</span>
            <span>10,000 leads</span>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: 0 }}>Recent Discoveries</h2>
          <span style={{ fontSize: "12px", color: colors.primary, cursor: "pointer" }}>
            View All <ArrowRight size={14} style={{ verticalAlign: "middle" }} />
          </span>
        </div>

        {recentLeads.length === 0 ? (
          <p style={{ color: colors.textMuted, padding: "24px 0", textAlign: "center" }}>
            No leads discovered yet. Start a discovery above.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {recentLeads.map((lead) => (
              <div
                key={lead.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto auto",
                  gap: "16px",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  transition: "background 100ms",
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHigh)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "13px", fontFamily: "var(--font-mono)", color: colors.primary, fontWeight: 500 }}>
                  {lead.normalized_domain}
                </span>
                <span style={{ fontSize: "13px", color: colors.text }}>
                  {lead.company_name || "—"}
                </span>
                <Badge variant="success" dot>{lead.status}</Badge>
                <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted }}>
                  {lead.discovered_at ? new Date(lead.discovered_at).toLocaleDateString() : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <BentoCard label="Success Rate" value="94.2%" icon={<TrendingUp size={20} />} accent />
        <BentoCard label="Active Crawlers" value="12" icon={<Cpu size={20} />} />
        <BentoCard label="Leads Found (24h)" value="1.8k" icon={<Users size={20} />} />
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

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: colors.bg,
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: "4px",
  fontSize: "14px",
  color: colors.text,
  cursor: "pointer",
  outline: "none",
  appearance: "none",
};

function BentoCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden", background: colors.bgLower, border: `1px solid ${colors.border}`, borderRadius: "8px" }}>
      <div style={{ zIndex: 1 }}>
        <p style={{ fontSize: "12px", fontWeight: 500, color: colors.textMuted, margin: "0 0 4px" }}>{label}</p>
        <h4 style={{ fontSize: "32px", fontWeight: 700, color: accent ? colors.primary : colors.text, margin: 0 }}>{value}</h4>
      </div>
      <div style={{ position: "absolute", right: "-12px", bottom: "0", color: accent ? "rgba(139, 92, 246, 0.1)" : "rgba(231, 224, 237, 0.05)", transform: "scale(3)", pointerEvents: "none" }}>
        {icon}
      </div>
    </div>
  );
}
