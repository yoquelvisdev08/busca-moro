import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  Smartphone,
  Gauge,
  Mail,
  Phone,
  Globe,
  BarChart3,
  FileText,
  MessageSquare,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit3,
  Eye,
  Send,
  User,
  Link,
} from "lucide-react";
import { api } from "@/lib/api";

// Types for the detail response
interface LeadDetailResponse {
  lead: any;
  latest_audit: any | null;
  audits: any[];
  sales_intelligence: any[];
}

type TabId = "overview" | "metrics" | "contacts" | "intelligence" | "outreach";

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const { data, isLoading, error } = useQuery<LeadDetailResponse>({
    queryKey: ["lead-detail", id],
    queryFn: () => api.getLeadDetail(id!),
    enabled: !!id,
  });

  const triggerAudit = useMutation({
    mutationFn: () => api.triggerAudit(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-detail", id] });
      toast.success("Auditoría encolada");
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });

  const triggerCloser = useMutation({
    mutationFn: () => api.triggerCloser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-detail", id] });
      toast.success("Closer activado");
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });

  if (isLoading) return <div className="px-4 py-8 text-gray-400 font-mono">cargando dossier...</div>;
  if (error) return <div className="px-4 py-8 text-red-400 font-mono">error: {(error as Error).message}</div>;
  if (!data) return <div className="px-4 py-8 text-gray-400 font-mono">lead no encontrado</div>;

  const lead = data.lead;
  const audit = data.latest_audit;
  const intel = data.sales_intelligence[0];

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "metrics", label: "Metrics", icon: <Gauge className="w-4 h-4" /> },
    { id: "contacts", label: "Contacts", icon: <Mail className="w-4 h-4" /> },
    { id: "intelligence", label: "Intelligence", icon: <FileText className="w-4 h-4" /> },
    { id: "outreach", label: "Outreach", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button className="btn ghost" onClick={() => navigate("/leads")}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="page-title mb-1">{lead.normalized_domain}</h2>
          <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
            <a
              href={lead.url}
              target="_blank"
              rel="noreferrer"
              className="text-void-cyan hover-underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Visitar sitio
            </a>
            <span>•</span>
            <span>
              Score: <strong className="text-void-text">{lead.score}</strong>
            </span>
            {lead.segment && (
              <>
                <span>•</span>
                <SegmentBadge segment={lead.segment} />
              </>
            )}
            {lead.revenue_signal && (
              <>
                <span>•</span>
                <span>
                  Revenue: <strong className="text-void-text">{lead.revenue_signal}</strong>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn ghost" onClick={() => triggerAudit.mutate()}>
            Re-audit
          </button>
          <button className="btn" onClick={() => triggerCloser.mutate()}>
            Re-generate intel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-3 py-1_5 text-xs font-mono rounded transition-colors ${
                  activeTab === tab.id
                    ? "bg-void-cyan-10 text-void-cyan border border-void-cyan-30"
                    : "text-gray-400 hover-text-void-text"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body">
          {activeTab === "overview" && <OverviewTab lead={lead} audit={audit} intel={intel} />}
          {activeTab === "metrics" && <MetricsTab audit={audit} />}
          {activeTab === "contacts" && <ContactsTab lead={lead} audit={audit} />}
          {activeTab === "intelligence" && <IntelligenceTab intel={intel} allIntel={data.sales_intelligence} />}
          {activeTab === "outreach" && <OutreachTab lead={lead} />}
        </div>
      </div>
    </section>
  );
}

// --- Tab Components ---

function OverviewTab({ lead, audit, intel }: any) {
  const problems: { icon: React.ReactNode; label: string; ok: boolean }[] = [
    { icon: <Shield className="w-4 h-4" />, label: "SSL", ok: lead.has_ssl },
    { icon: <Smartphone className="w-4 h-4" />, label: "Mobile Friendly", ok: lead.mobile_friendly },
    { icon: <Gauge className="w-4 h-4" />, label: `Load: ${lead.load_time_ms ?? "—"}ms`, ok: (lead.load_time_ms ?? 9999) < 3000 },
  ];

  const commercialSignals: { label: string; value: boolean }[] = [
    { label: "E-commerce", value: lead.revenue_signal === "ecommerce" },
    { label: "Pricing Page", value: lead.has_pricing_page },
    { label: "Testimonials", value: lead.has_testimonials },
    { label: "Active Blog", value: (lead.content_freshness_days ?? 999) < 90 },
  ];

  return (
    <div className="space-y-6">
      {/* Problem Cards */}
      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3">DIAGNÓSTICO TÉCNICO</h3>
        <div className="grid grid-cols-3 gap-4">
          {problems.map((p, i) => (
            <div
              key={i}
              className={`p-4 rounded border ${
                p.ok ? "border-green-500-30 bg-green-500-5" : "border-red-500-30 bg-red-500-5"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {p.ok ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-sm font-mono">{p.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commercial Signals */}
      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3">SEÑALES COMERCIALES</h3>
        <div className="grid grid-cols-4 gap-3">
          {commercialSignals.map((s, i) => (
            <div
              key={i}
              className={`p-3 rounded border text-center ${
                s.value
                  ? "border-void-cyan-30 bg-void-cyan-5"
                  : "border-gray-700-30 bg-gray-700-5"
              }`}
            >
              <div className="text-xs font-mono text-gray-400">{s.label}</div>
              <div
                className={`text-lg font-mono mt-1 ${
                  s.value ? "text-void-cyan" : "text-gray-600"
                }`}
              >
                {s.value ? "✓" : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-4 gap-4">
        <ScoreCard label="Score Total" value={lead.score ?? 0} max={100} color="var(--void-cyan)" />
        <ScoreCard label="Lighthouse" value={audit?.lighthouse_score ?? "—"} max={100} color="#22c55e" />
        <ScoreCard label="Problem Score" value={lead.problem_score ?? 0} max={100} color="#ef4444" />
        <ScoreCard label="Commercial Score" value={lead.commercial_score ?? 0} max={100} color="#f59e0b" />
      </div>

      {/* AI Sales Argument */}
      {intel?.pain_points && intel.pain_points.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            ARGUMENTO DE VENTA (IA)
          </h3>
          <div className="p-4 rounded border border-void-border bg-void-bg">
            <ul className="space-y-2">
              {(
                typeof intel.pain_points === "string"
                  ? JSON.parse(intel.pain_points)
                  : intel.pain_points
              ).map((pp: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0_5 flex-shrink-0" />
                  <span>{typeof pp === "string" ? pp : pp.title || pp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricsTab({ audit }: any) {
  if (!audit) return <div className="text-gray-400 font-mono text-sm">Sin auditoría disponible</div>;

  const metrics = [
    { label: "Performance", value: audit.performance_score, color: "#22c55e" },
    { label: "SEO", value: audit.seo_score, color: "#3b82f6" },
    { label: "Accessibility", value: audit.accessibility_score, color: "#a855f7" },
    { label: "Best Practices", value: audit.best_practices_score, color: "#f59e0b" },
  ];

  const coreVitals = [
    { label: "FCP", value: audit.first_contentful_paint_ms, unit: "ms", good: 1800 },
    { label: "LCP", value: audit.largest_contentful_paint_ms, unit: "ms", good: 2500 },
    { label: "CLS", value: audit.cumulative_layout_shift, unit: "", good: 0.1 },
    { label: "TBT", value: audit.total_blocking_time_ms, unit: "ms", good: 200 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <ScoreCard key={i} label={m.label} value={m.value ?? "—"} max={100} color={m.color} />
        ))}
      </div>

      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3">CORE WEB VITALS</h3>
        <div className="grid grid-cols-4 gap-4">
          {coreVitals.map((v, i) => {
            const val = v.value ?? 0;
            const isGood = v.unit === "" ? val <= v.good : val <= v.good;
            return (
              <div
                key={i}
                className={`p-4 rounded border ${
                  isGood ? "border-green-500-30 bg-green-500-5" : "border-red-500-30 bg-red-500-5"
                }`}
              >
                <div className="text-xs text-gray-400 font-mono">{v.label}</div>
                <div
                  className={`text-2xl font-mono mt-1 ${
                    isGood ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {v.value ?? "—"}
                  {v.unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit History */}
      {audit.screenshot_path && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 mb-3">SCREENSHOT</h3>
          <div className="rounded border border-void-border overflow-hidden max-w-2xl">
            <img
              src={`/screenshots/${audit.screenshot_path.split("/").pop()}`}
              alt="Screenshot"
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ContactsTab({ lead, audit }: any) {
  const contacts = audit?.extracted_contacts || {};
  const emails = contacts.emails || [];
  const phones = contacts.phones || [];
  const socials = contacts.socials || {};

  return (
    <div className="space-y-6">
      {/* Emails */}
      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4" /> EMAILS
        </h3>
        <div className="space-y-2">
          {lead.email && (
            <div className="flex items-center justify-between p-3 rounded border border-void-border bg-void-bg">
              <span className="font-mono text-sm">{lead.email}</span>
              <span className="text-xs text-gray-500">principal</span>
            </div>
          )}
          {emails.map((email: string, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded border border-void-border bg-void-bg"
            >
              <span className="font-mono text-sm">{email}</span>
              <span className="text-xs text-gray-500">extraído</span>
            </div>
          ))}
          {emails.length === 0 && !lead.email && (
            <div className="text-gray-500 font-mono text-sm">No se encontraron emails</div>
          )}
        </div>
      </div>

      {/* Phones */}
      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
          <Phone className="w-4 h-4" /> TELÉFONOS
        </h3>
        <div className="space-y-2">
          {phones.length > 0 ? (
            phones.map((phone: string, i: number) => (
              <div
                key={i}
                className="p-3 rounded border border-void-border bg-void-bg font-mono text-sm"
              >
                {phone}
              </div>
            ))
          ) : (
            <div className="text-gray-500 font-mono text-sm">No se encontraron teléfonos</div>
          )}
        </div>
      </div>

      {/* Social */}
      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" /> REDES SOCIALES
        </h3>
        <div className="space-y-2">
          {Object.keys(socials).length > 0 ? (
            Object.entries(socials).map(([platform, links]: [string, any]) => (
              <div key={platform} className="p-3 rounded border border-void-border bg-void-bg">
                <div className="text-xs font-mono text-gray-400 capitalize mb-1">{platform}</div>
                {(Array.isArray(links) ? links : [links]).map((link: string, i: number) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-void-cyan hover-underline text-sm font-mono block"
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))
          ) : (
            <div className="text-gray-500 font-mono text-sm">No se encontraron redes sociales</div>
          )}
        </div>
      </div>
    </div>
  );
}

function IntelligenceTab({ intel, allIntel }: any) {
  if (!intel)
    return (
      <div className="text-gray-400 font-mono text-sm">
        Sin inteligencia de ventas. Ejecutá el Closer primero.
      </div>
    );

  const painPoints =
    typeof intel.pain_points === "string" ? JSON.parse(intel.pain_points) : intel.pain_points;

  return (
    <div className="space-y-6">
      {/* Pain Points */}
      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" /> PAIN POINTS
        </h3>
        <div className="space-y-2">
          {(Array.isArray(painPoints) ? painPoints : []).map((pp: any, i: number) => (
            <div key={i} className="p-3 rounded border border-yellow-500-20 bg-yellow-500-5">
              <div className="font-mono text-sm">
                {typeof pp === "string" ? pp : pp.title || JSON.stringify(pp)}
              </div>
              {pp.description && <div className="text-xs text-gray-400 mt-1">{pp.description}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Cold Email */}
      {intel.cold_email_subject && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> COLD EMAIL GENERADO
          </h3>
          <div className="p-4 rounded border border-void-border bg-void-bg">
            <div className="mb-3">
              <span className="text-xs text-gray-500 font-mono">Subject: </span>
              <span className="font-mono text-sm">{intel.cold_email_subject}</span>
            </div>
            <pre className="text-sm font-mono whitespace-pre-wrap text-void-text">
              {intel.cold_email_body}
            </pre>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-gray-500 font-mono space-y-1">
        <div>Modelo: {intel.model}</div>
        <div>Idioma: {intel.language}</div>
        {intel.tone && <div>Tono: {intel.tone}</div>}
        <div>Generado: {intel.generated_at ? new Date(intel.generated_at).toLocaleString() : "—"}</div>
      </div>

      {/* Version history */}
      {allIntel && allIntel.length > 1 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> HISTORIAL DE VERSIONES
          </h3>
          <div className="space-y-1">
            {allIntel.map((v: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 text-xs font-mono text-gray-400 p-2 rounded hover-bg-void-border-10"
              >
                <span>v{i + 1}</span>
                <span>{v.model}</span>
                <span>
                  {v.generated_at ? new Date(v.generated_at).toLocaleDateString() : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OutreachTab({ lead }: any) {
  const queryClient = useQueryClient();
  const [isPreview, setIsPreview] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Fetch lead detail for intel
  const { data: detail } = useQuery({
    queryKey: ["lead-detail", lead.id],
    queryFn: () => api.getLeadDetail(lead.id),
    enabled: !!lead.id,
  });

  // Fetch sender profile
  const { data: senderProfile } = useQuery({
    queryKey: ["sender-profile"],
    queryFn: () => api.getSenderProfile(),
  });

  const intel = detail?.sales_intelligence?.[0];

  // Initialize subject/body from intel when available
  useEffect(() => {
    if (intel?.cold_email_subject && !subject) {
      setSubject(intel.cold_email_subject);
    }
    if (intel?.cold_email_body && !body) {
      setBody(intel.cold_email_body);
    }
  }, [intel]);

  const sendEmail = useMutation({
    mutationFn: () => api.sendOutreachEmail(lead.id, subject, body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-detail", lead.id] });
      toast.success(`Email enviado a ${data.recipient}`);
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });

  const hasIntel = !!intel?.cold_email_subject;

  return (
    <div className="space-y-6">
      {/* Sender Profile Info */}
      {senderProfile && (
        <div className="p-4 rounded border border-void-cyan-30 bg-void-cyan-5">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-void-cyan" />
            <span className="text-xs font-mono text-void-cyan">SENDER PROFILE</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono text-void-text">{senderProfile.name}</span>
            {senderProfile.title && (
              <span className="text-gray-400">· {senderProfile.title}</span>
            )}
            <a
              href={senderProfile.website}
              target="_blank"
              rel="noreferrer"
              className="text-void-cyan hover-underline flex items-center gap-1 text-xs"
            >
              <Link className="w-3 h-3" />
              {senderProfile.website}
            </a>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono text-void-cyan">OUTREACH MANAGER</h3>
        <div className="flex gap-2">
          <button
            className="btn ghost"
            onClick={() => setIsPreview(!isPreview)}
            disabled={sendEmail.isPending}
          >
            {isPreview ? (
              <>
                <Edit3 className="w-4 h-4 mr-1" /> Editar
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" /> Preview
              </>
            )}
          </button>
          <button
            className="btn"
            onClick={() => sendEmail.mutate()}
            disabled={sendEmail.isPending || !subject || !body}
          >
            <Send className="w-4 h-4 mr-1" />
            {sendEmail.isPending ? "Enviando..." : "Send"}
          </button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded border border-void-border bg-void-bg">
          <div className="text-xs text-gray-400 font-mono mb-2">STATUS</div>
          <div className="text-lg font-mono capitalize">{lead.status}</div>
        </div>
        <div className="p-4 rounded border border-void-border bg-void-bg">
          <div className="text-xs text-gray-400 font-mono mb-2">ÚLTIMO CONTACTO</div>
          <div className="text-lg font-mono">
            {lead.contacted_at ? new Date(lead.contacted_at).toLocaleDateString() : "Nunca"}
          </div>
        </div>
      </div>

      {/* Email Editor / Preview */}
      {hasIntel ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-gray-400 mb-2 block">SUBJECT</label>
            {isPreview ? (
              <div className="p-3 rounded border border-void-border bg-void-bg font-mono text-sm">
                {subject || intel.cold_email_subject}
              </div>
            ) : (
              <input
                type="text"
                className="field-input w-full"
                value={subject || intel.cold_email_subject || ""}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            )}
          </div>
          <div>
            <label className="text-xs font-mono text-gray-400 mb-2 block">BODY</label>
            {isPreview ? (
              <div className="p-4 rounded border border-void-border bg-void-bg">
                <pre className="text-sm font-mono whitespace-pre-wrap text-void-text">
                  {body || intel.cold_email_body}
                </pre>
              </div>
            ) : (
              <textarea
                className="field-input w-full min-h-[240px] resize-y"
                value={body || intel.cold_email_body || ""}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email body..."
              />
            )}
          </div>
        </div>
      ) : (
        <div className="text-gray-500 font-mono text-sm">
          Sin inteligencia de ventas disponible. Ejecutá el Closer primero para generar el cold email.
        </div>
      )}

      {/* Email history placeholder */}
      <div>
        <h3 className="text-xs font-mono text-gray-400 mb-3">HISTORIAL DE ENVÍOS</h3>
        <div className="text-gray-500 font-mono text-sm">
          Los emails enviados aparecerán aquí. Implementación completa en Fase 5.
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function ScoreCard({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number | string;
  max?: number;
  color: string;
}) {
  const pct = max && typeof value === "number" ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="p-4 rounded border border-void-border bg-void-bg">
      <div className="text-xs text-gray-400 font-mono mb-2">{label}</div>
      <div className="text-2xl font-mono" style={{ color }}>
        {value}
      </div>
      {max && typeof value === "number" && (
        <div className="mt-2 h-1 rounded bg-void-border overflow-hidden">
          <div
            className="h-full rounded transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}

function SegmentBadge({ segment }: { segment: string }) {
  const colors: Record<string, string> = {
    A: "bg-red-500-20 text-red-400 border-red-500-30",
    B: "bg-orange-500-20 text-orange-400 border-orange-500-30",
    C: "bg-yellow-500-20 text-yellow-400 border-yellow-500-30",
    D: "bg-gray-500-20 text-gray-400 border-gray-500-30",
  };
  return (
    <span className={`px-1_5 py-0_5 text-xs font-mono border rounded ${colors[segment] ?? colors.D}`}>
      {segment}
    </span>
  );
}
