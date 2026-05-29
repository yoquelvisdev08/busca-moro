import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  Smartphone,
  Gauge,
  FileText,
  CheckCircle,
  XCircle,
  Sparkles,
  Send,
  Clock,
  Download,
  RefreshCw,
  Eye,
} from "lucide-react";
import {
  useLead,
  useFollowUps,
  useReports,
  useSendOutreachMutation,
  useTriggerAuditMutation,
  useTriggerCloserMutation,
  useGenerateReportMutation,
  useScheduleFollowUpMutation,
  useCancelAllFollowUpsMutation,
  useOutreach,
} from "@/lib/hooks";
import type { Lead, Audit, SalesIntelligence, FollowUpRead, ReportRead, OutreachMessage } from "@/lib/api";
import { Card, CardHeader, CardBody } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Checkbox } from "@/design-system/components/Checkbox";
import { Modal } from "@/design-system/components/Modal";
import { Spinner } from "@/design-system/components/Spinner";
import { colors } from "@/design-system/tokens";

type TabId = "overview" | "audit" | "reports" | "outreach";

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachBody, setOutreachBody] = useState("");
  const [attachReportId, setAttachReportId] = useState<string | undefined>();
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const { data, isLoading, error } = useLead(id);
  const { data: reportsData } = useReports({ lead_id: id });
  const { data: followUps } = useFollowUps(id);
  const { data: outreachData } = useOutreach(id);

  const triggerAudit = useTriggerAuditMutation();
  const triggerCloser = useTriggerCloserMutation();
  const sendOutreach = useSendOutreachMutation();
  const generateReport = useGenerateReportMutation();
  const scheduleFollowUp = useScheduleFollowUpMutation();
  const cancelFollowUps = useCancelAllFollowUpsMutation();

  const lead = data?.lead as Lead | undefined;
  const audit = data?.latest_audit as Audit | null | undefined;
  const intel = data?.sales_intelligence?.[0] as SalesIntelligence | undefined;

  useEffect(() => {
    if (intel?.cold_email_subject && !outreachSubject) setOutreachSubject(intel.cold_email_subject);
    if (intel?.cold_email_body && !outreachBody) setOutreachBody(intel.cold_email_body);
  }, [intel]);

  if (isLoading) return <Spinner size="lg" style={{ padding: "80px 0" }} />;
  if (error) return <div style={{ padding: "32px", color: colors.danger, fontFamily: "var(--font-mono)" }}>Error: {(error as Error).message}</div>;
  if (!data) return <div style={{ padding: "32px", color: colors.textMuted }}>Lead not found</div>;

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "audit", label: "Audit" },
    { id: "reports", label: "Reports" },
    { id: "outreach", label: "Outreach" },
  ];

  const handleSendOutreach = () => {
    sendOutreach.mutate(
      { leadId: id!, subject: outreachSubject, body: outreachBody, attachReportId },
      {
        onSuccess: (data) => {
          toast.success(`Email sent to ${data.recipient}`);
          setSendModalOpen(false);
        },
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      },
    );
  };

  const handleQuickFollowUp = () => {
    scheduleFollowUp.mutate(
      {
        leadId: id!,
        sequenceName: "Quick Follow-up",
        steps: [
          { delay_days: 0, subject: outreachSubject || intel?.cold_email_subject || "Initial outreach", body: outreachBody || intel?.cold_email_body || "", include_pdf: !!attachReportId },
          { delay_days: 3, subject: "Following up on our conversation", body: "Hi! I wanted to follow up on my previous message. Let me know if you have any questions.", include_pdf: false },
          { delay_days: 7, subject: "Last follow-up", body: "One last follow-up. Happy to jump on a call to discuss how we can help.", include_pdf: false },
        ],
      },
      {
        onSuccess: () => toast.success("Follow-up sequence scheduled"),
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      },
    );
  };

  return (
    <section>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
          <ArrowLeft size={16} />
        </Button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>
            {lead?.normalized_domain}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: colors.textMuted, fontFamily: "var(--font-mono)" }}>
            <a href={lead?.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", color: colors.primary }}>
              <ExternalLink size={12} /> Visit
            </a>
            {lead?.score != null && <span>Score: <strong style={{ color: colors.text }}>{lead.score}</strong></span>}
            {lead?.segment && <Badge variant={lead.segment === "A" ? "danger" : lead.segment === "B" ? "warning" : "info"}>{lead.segment}</Badge>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary" size="sm" onClick={() => triggerAudit.mutate(id!)} disabled={triggerAudit.isPending}>
            <RefreshCw size={14} /> Re-audit
          </Button>
          <Button variant="secondary" size="sm" onClick={() => triggerCloser.mutate(id!)} disabled={triggerCloser.isPending}>
            <Sparkles size={14} /> Re-gen intel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card padding="0">
        <CardHeader>
          <div style={{ display: "flex", gap: "4px" }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 150ms",
                  background: activeTab === tab.id ? "rgba(139, 92, 246, 0.12)" : "transparent",
                  color: activeTab === tab.id ? colors.primary : colors.textMuted,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody>
          {activeTab === "overview" && <OverviewTab lead={lead} audit={audit} intel={intel} />}
          {activeTab === "audit" && <AuditTab audit={audit} />}
          {activeTab === "reports" && (
            <ReportsTab
              leadId={id!}
              reports={reportsData?.items ?? []}
              onGenerate={() => generateReport.mutate(id!, { onSuccess: () => toast.success("Report generated") })}
              isGenerating={generateReport.isPending}
            />
          )}
          {activeTab === "outreach" && (
            <OutreachTab
              lead={lead}
              intel={intel}
              followUps={followUps?.items ?? []}
              outreach={outreachData?.items ?? []}
              reports={reportsData?.items ?? []}
              subject={outreachSubject}
              body={outreachBody}
              attachReportId={attachReportId}
              onSubjectChange={setOutreachSubject}
              onBodyChange={setOutreachBody}
              onAttachReportIdChange={setAttachReportId}
              onSend={() => setSendModalOpen(true)}
              onQuickFollowUp={handleQuickFollowUp}
              onCancelFollowUps={() => cancelFollowUps.mutate(id!)}
              isSending={sendOutreach.isPending}
            />
          )}
        </CardBody>
      </Card>

      {/* Send Modal */}
      <Modal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Send Outreach Email"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSendModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSendOutreach} loading={sendOutreach.isPending}>
              <Send size={14} /> Send Email
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Input label="Subject" value={outreachSubject} onChange={(e) => setOutreachSubject(e.target.value)} />
          <div>
            <label style={labelStyle}>Body</label>
            <textarea
              value={outreachBody}
              onChange={(e) => setOutreachBody(e.target.value)}
              style={{
                width: "100%",
                minHeight: "180px",
                resize: "vertical",
                padding: "8px 12px",
                background: colors.bg,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: "4px",
                fontSize: "13px",
                color: colors.text,
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
          <Checkbox
            label="Attach latest PDF report"
            checked={!!attachReportId}
            onChange={(checked) => setAttachReportId(checked ? (reportsData?.items?.[0]?.id) : undefined)}
          />
        </div>
      </Modal>
    </section>
  );
}

/* ── Overview Tab ── */
function OverviewTab({ lead, audit, intel }: { lead: Lead | undefined; audit: Audit | null | undefined; intel: SalesIntelligence | undefined }) {
  const problems = [
    { icon: <Shield size={16} />, label: "SSL", ok: lead?.has_ssl ?? false },
    { icon: <Smartphone size={16} />, label: "Mobile Friendly", ok: lead?.mobile_friendly ?? false },
    { icon: <Gauge size={16} />, label: `Load: ${lead?.load_time_ms ?? "—"}ms`, ok: (lead?.load_time_ms ?? Infinity) < 3000 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Scores */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px" }}>
        <ScoreCard label="Total Score" value={lead?.score} max={100} color={colors.primary} />
        <ScoreCard label="Lighthouse" value={audit?.lighthouse_score as number | undefined} max={100} color="#10b981" />
        <ScoreCard label="Performance" value={audit?.performance_score} max={100} color="#3b82f6" />
        <ScoreCard label="Commercial Score" value={lead?.commercial_score} max={100} color="#f59e0b" />
      </div>

      {/* Technical Checks */}
      <div>
        <h3 style={sectionTitleStyle}>Technical Diagnostics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          {problems.map((p, i) => (
            <div key={i} style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${p.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`, background: p.ok ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {p.ok ? <CheckCircle size={16} style={{ color: "#10b981" }} /> : <XCircle size={16} style={{ color: "#ef4444" }} />}
                <span style={{ fontSize: "14px", color: p.ok ? "#10b981" : "#ef4444" }}>{p.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Sales Argument */}
      {intel?.cold_email_body && (
        <div>
          <h3 style={{ ...sectionTitleStyle, display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} style={{ color: "#f59e0b" }} /> AI Sales Intelligence
          </h3>
          <div style={{ padding: "16px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px" }}>
            <p style={{ fontSize: "13px", color: colors.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {intel.cold_email_body.slice(0, 500)}{intel.cold_email_body.length > 500 ? "..." : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Audit Tab ── */
function AuditTab({ audit }: { audit: Audit | null | undefined }) {
  if (!audit) return <p style={{ color: colors.textMuted, padding: "24px 0" }}>No audit data available. Trigger an audit first.</p>;

  const metrics = [
    { label: "Performance", value: audit.performance_score, color: "#10b981" },
    { label: "Accessibility", value: audit.accessibility_score, color: "#a855f7" },
    { label: "Best Practices", value: audit.best_practices_score, color: "#f59e0b" },
    { label: "SEO", value: audit.seo_score, color: "#3b82f6" },
  ];

  const vitals = [
    { label: "FCP", value: audit.first_contentful_paint_ms, unit: "ms", good: 1800 },
    { label: "LCP", value: audit.largest_contentful_paint_ms, unit: "ms", good: 2500 },
    { label: "CLS", value: audit.cumulative_layout_shift, unit: "", good: 0.1 },
    { label: "TBT", value: audit.total_blocking_time_ms, unit: "ms", good: 200 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px" }}>
        {metrics.map((m, i) => <ScoreCard key={i} label={m.label} value={m.value} max={100} color={m.color} />)}
      </div>

      <div>
        <h3 style={sectionTitleStyle}>Core Web Vitals</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
          {vitals.map((v, i) => {
            const val = v.value ?? 0;
            const isGood = v.unit === "" ? val <= v.good : val <= v.good;
            return (
              <div key={i} style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${isGood ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`, background: isGood ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)" }}>
                <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted }}>{v.label}</div>
                <div style={{ fontSize: "24px", fontFamily: "var(--font-mono)", marginTop: "4px", color: isGood ? "#10b981" : "#ef4444" }}>
                  {v.value ?? "—"}{v.unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {audit.screenshot_path && (
        <div>
          <h3 style={sectionTitleStyle}>Screenshot</h3>
          <div style={{ borderRadius: "8px", border: `1px solid ${colors.border}`, overflow: "hidden", maxWidth: "600px" }}>
            <img src={`/screenshots/${audit.screenshot_path.split("/").pop()}`} alt="Screenshot" style={{ width: "100%" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reports Tab ── */
function ReportsTab({
  reports,
  onGenerate,
  isGenerating,
}: {
  leadId?: string;
  reports: ReportRead[];
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const downloadUrl = (id: string) => `/api/v1/reports/${id}/download`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Generated Reports</h3>
        <Button onClick={onGenerate} loading={isGenerating}>
          <FileText size={14} /> Generate Report
        </Button>
      </div>

      {reports.length === 0 ? (
        <p style={{ color: colors.textMuted, padding: "32px 0", textAlign: "center" }}>No reports generated yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {reports.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <FileText size={20} style={{ color: colors.primary, opacity: 0.6 }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>{r.lead_domain || r.lead_id}</div>
                  <div style={{ fontSize: "11px", color: colors.textMuted }}>
                    {r.generated_at ? new Date(r.generated_at).toLocaleDateString() : ""} · {(r.file_size / 1024).toFixed(1)} KB · {r.status}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <a href={downloadUrl(r.id)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary"><Download size={14} /></Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Outreach Tab ── */
function OutreachTab({
  lead,
  followUps,
  outreach,
  reports,
  subject,
  body,
  attachReportId,
  onSubjectChange,
  onBodyChange,
  onAttachReportIdChange,
  onSend,
  onQuickFollowUp,
  onCancelFollowUps,
  isSending,
}: {
  lead: Lead | undefined;
  intel?: SalesIntelligence | undefined;
  followUps: FollowUpRead[];
  outreach: OutreachMessage[];
  reports: ReportRead[];
  subject: string;
  body: string;
  attachReportId: string | undefined;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onAttachReportIdChange: (v: string | undefined) => void;
  onSend: () => void;
  onQuickFollowUp: () => void;
  onCancelFollowUps: () => void;
  isSending: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={{ padding: "12px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px" }}>
          <div style={{ fontSize: "11px", color: colors.textMuted, marginBottom: "4px" }}>STATUS</div>
          <div style={{ fontSize: "16px", fontFamily: "var(--font-mono)", color: colors.text, textTransform: "capitalize" }}>{lead?.status}</div>
        </div>
        <div style={{ padding: "12px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px" }}>
          <div style={{ fontSize: "11px", color: colors.textMuted, marginBottom: "4px" }}>FOLLOW-UP STATUS</div>
          <div style={{ fontSize: "16px", fontFamily: "var(--font-mono)", color: followUps.some((f) => f.status === "pending") ? colors.warning : colors.textMuted }}>
            {followUps.some((f) => f.status === "pending") ? `${followUps.filter((f) => f.status === "pending").length} pending` : "None active"}
          </div>
        </div>
      </div>

      {/* Email Editor */}
      <div>
        <h3 style={sectionTitleStyle}>Compose Email</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Input label="Subject" value={subject} onChange={(e) => onSubjectChange(e.target.value)} placeholder="Email subject" />
          <div>
            <label style={labelStyle}>Body</label>
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              style={{
                width: "100%",
                minHeight: "180px",
                resize: "vertical",
                padding: "8px 12px",
                background: colors.bg,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: "4px",
                fontSize: "13px",
                color: colors.text,
                fontFamily: "var(--font-sans)",
              }}
              placeholder="Email body..."
            />
          </div>
          <Checkbox
            label={`Attach latest PDF report${reports.length === 0 ? " (no reports available)" : ""}`}
            checked={!!attachReportId}
            onChange={(checked) => onAttachReportIdChange(checked ? reports[0]?.id : undefined)}
            disabled={reports.length === 0}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <Button onClick={onSend} loading={isSending} disabled={!subject || !body}>
              <Send size={14} /> Send Email
            </Button>
            <Button variant="secondary" onClick={onQuickFollowUp}>
              <Clock size={14} /> Schedule Follow-up
            </Button>
            {followUps.some((f) => f.status === "pending") && (
              <Button variant="danger" onClick={onCancelFollowUps}>
                Cancel Follow-ups
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Email History */}
      <div>
        <h3 style={sectionTitleStyle}>
          <Eye size={14} /> Email History
        </h3>
        {outreach.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: "13px" }}>No emails sent yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {outreach.map((msg) => (
              <div key={msg.id} style={{ padding: "10px 14px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>{msg.subject}</div>
                  <div style={{ fontSize: "11px", color: colors.textMuted }}>
                    To: {msg.recipient} · {msg.sent_at ? new Date(msg.sent_at).toLocaleDateString() : "Pending"}
                    {msg.replied && <span style={{ marginLeft: "8px", color: colors.success }}>● Replied</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: colors.textMuted }}>
                  {msg.opened_at ? <span>✓ Opened</span> : <span>— Unopened</span>}
                  {msg.has_attachment && <span>📎 PDF</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-up Schedule */}
      {followUps.length > 0 && (
        <div>
          <h3 style={sectionTitleStyle}>
            <Clock size={14} /> Scheduled Follow-ups
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {followUps.map((fu) => (
              <div key={fu.id} style={{ padding: "8px 14px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: colors.text }}>{fu.subject}</span>
                <Badge variant={fu.status === "sent" ? "success" : fu.status === "cancelled" ? "danger" : "warning"}>{fu.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.textMuted,
  fontFamily: "var(--font-sans)",
  marginBottom: "6px",
  display: "block",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  color: colors.textSecondary,
  marginBottom: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

function ScoreCard({ label, value, max = 100, color }: { label: string; value?: number | null; max?: number; color: string }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ padding: "16px", borderRadius: "8px", border: `1px solid ${colors.border}`, background: colors.bg }}>
      <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: colors.textMuted, marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontFamily: "var(--font-mono)", fontWeight: 700, color }}>{value ?? "—"}</div>
      {value != null && (
        <div style={{ marginTop: "8px", height: "4px", borderRadius: "2px", background: colors.surfaceHigh }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: "2px", background: color, transition: "width 300ms" }} />
        </div>
      )}
    </div>
  );
}
