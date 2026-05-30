import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { notify } from "@/lib/notify";
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
  Eye,
  RefreshCw,
  Mail,
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
  useRecordInboundMutation,
} from "@/lib/hooks";
import type {
  Lead,
  Audit,
  SalesIntelligence,
  ReportRead,
  OutreachMessage,
  FollowUpRead,
} from "@/lib/api";
import { api, screenshotPublicUrl } from "@/lib/api";
import { ColumnDef } from "@tanstack/react-table";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { TabGroup, type Tab } from "@/components/domain/TabGroup";
import { ReportPdfPreviewDialog } from "@/components/domain/ReportPdfPreviewDialog";
import { StatusLED, type StatusLEDVariant } from "@/components/domain/StatusLED";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable } from "@/components/tables/DataTable";
import { cn } from "@/lib/utils";

type TabId = "overview" | "audit" | "reports" | "outreach";

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachBody, setOutreachBody] = useState("");
  const [outreachToEmail, setOutreachToEmail] = useState("");
  const [attachReportId, setAttachReportId] = useState<string | undefined>();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [emailVariant, setEmailVariant] = useState<"a" | "b">("a");
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);

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

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "outreach" || tab === "audit" || tab === "reports" || tab === "overview") {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const audit = data?.latest_audit as Audit | null | undefined;
  const intel = data?.sales_intelligence?.[0] as SalesIntelligence | undefined;

  const suggestedEmails = useMemo(() => {
    const emails: string[] = [];
    const seen = new Set<string>();
    const add = (value: string | null | undefined) => {
      const v = value?.trim();
      if (!v || seen.has(v.toLowerCase())) return;
      seen.add(v.toLowerCase());
      emails.push(v);
    };
    add(lead?.email);
    lead?.secondary_emails?.forEach((e) => add(e));
    const extracted = audit?.extracted_contacts?.emails as string[] | undefined;
    extracted?.forEach((e) => add(e));
    return emails;
  }, [lead, audit]);

  const hasValidOutreachEmail = useMemo(() => {
    const v = outreachToEmail.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }, [outreachToEmail]);

  useEffect(() => {
    if (!intel) return;
    if (emailVariant === "b" && intel.extras?.cold_email_body_alt) {
      if (!outreachSubject)
        setOutreachSubject(intel.extras.cold_email_subject_alt ?? "");
      if (!outreachBody) setOutreachBody(intel.extras.cold_email_body_alt);
      return;
    }
    if (intel.cold_email_subject && !outreachSubject)
      setOutreachSubject(intel.cold_email_subject);
    if (intel.cold_email_body && !outreachBody)
      setOutreachBody(intel.cold_email_body);
  }, [intel, emailVariant]);

  const applyEmailVariant = (variant: "a" | "b") => {
    setEmailVariant(variant);
    if (!intel) return;
    if (variant === "b" && intel.extras?.cold_email_body_alt) {
      setOutreachSubject(intel.extras.cold_email_subject_alt ?? "");
      setOutreachBody(intel.extras.cold_email_body_alt);
      return;
    }
    setOutreachSubject(intel.cold_email_subject ?? "");
    setOutreachBody(intel.cold_email_body ?? "");
  };

  useEffect(() => {
    if (outreachToEmail.trim()) return;
    if (suggestedEmails[0]) setOutreachToEmail(suggestedEmails[0]);
  }, [suggestedEmails, outreachToEmail]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="text-danger text-sm font-mono">Error</span>
        <p className="text-text-muted text-xs">
          {(error as Error).message}
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
          <ArrowLeft className="size-3.5 mr-1.5" /> Back to Leads
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-text-muted">Lead not found</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
          <ArrowLeft className="size-3.5 mr-1.5" /> Back to Leads
        </Button>
      </div>
    );
  }

  const tabs: Tab[] = [
    { id: "overview", label: "Overview" },
    { id: "audit", label: "Audit" },
    {
      id: "reports",
      label: "Reports",
      count: reportsData?.items?.length ?? 0,
    },
    {
      id: "outreach",
      label: "Outreach",
      count: outreachData?.items?.length ?? 0,
    },
  ];

  const handleSendOutreach = () => {
    if (!hasValidOutreachEmail) {
      notify.error(
        "Indica un email de destino válido. Muchos sitios no publican correo en la web.",
      );
      return;
    }
    sendOutreach.mutate(
      {
        leadId: id!,
        subject: outreachSubject,
        body: outreachBody,
        attachReportId,
        toEmail: outreachToEmail.trim(),
      },
      {
        onSuccess: (result) => {
          notify.success(`Email enviado a ${result.recipient}`);
          setSendModalOpen(false);
        },
        onError: (e) => notify.error(`Error: ${(e as Error).message}`),
      }
    );
  };

  const handleQuickFollowUp = () => {
    scheduleFollowUp.mutate(
      {
        leadId: id!,
        sequenceName: "Quick Follow-up",
        steps: [
          {
            delay_days: 0,
            subject:
              outreachSubject ||
              intel?.cold_email_subject ||
              "Initial outreach",
            body:
              outreachBody || intel?.cold_email_body || "",
            include_pdf: !!attachReportId,
          },
          {
            delay_days: 3,
            subject: "Following up on our conversation",
            body: "Hi! I wanted to follow up on my previous message. Let me know if you have any questions.",
            include_pdf: false,
          },
          {
            delay_days: 7,
            subject: "Last follow-up",
            body: "One last follow-up. Happy to jump on a call to discuss how we can help.",
            include_pdf: false,
          },
        ],
      },
      {
        onSuccess: () => notify.success("Secuencia de follow-up programada"),
        onError: (e) => notify.error(`Error: ${(e as Error).message}`),
      }
    );
  };

  const statusToLED: Record<string, StatusLEDVariant> = {
    new: "info",
    queued: "info",
    auditing: "info",
    audited: "success",
    enriched: "success",
    contacted: "success",
    interested: "success",
    negotiation: "warning",
    closed_won: "success",
    closed_lost: "danger",
    replied: "success",
    won: "success",
    rejected: "danger",
    error: "danger",
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start gap-3 md:gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/leads")}
          aria-label="Back to Leads"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-headline font-semibold text-text truncate">
            {lead?.normalized_domain}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-text-muted font-mono flex-wrap">
            <a
              href={lead?.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
              aria-label={`Open ${lead?.normalized_domain} in new tab`}
            >
              <ExternalLink className="size-3" aria-hidden="true" /> Visit
            </a>
            {lead?.score != null && (
              <span>
                Score:{" "}
                <strong className="text-text">{lead.score}</strong>
              </span>
            )}
            {lead?.status && (
              <StatusLED
                variant={statusToLED[lead.status] ?? "neutral"}
                size="sm"
                label={lead.status.replace(/_/g, " ")}
                pulse={lead.status === "auditing"}
              />
            )}
            {lead?.outreach?.has_message_sent ? (
              <Badge variant="default" className="font-mono text-[10px]">
                Mensaje enviado
                {lead.outreach.messages_sent_count > 1
                  ? ` ×${lead.outreach.messages_sent_count}`
                  : ""}
              </Badge>
            ) : (
              <Badge variant="secondary" className="font-mono text-[10px]">
                Sin mensaje enviado
              </Badge>
            )}
            {lead?.outreach?.has_reply_received && (
              <Badge variant="outline" className="font-mono text-[10px] text-success border-success/40">
                Respondió
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerAudit.mutate(id!)}
            disabled={triggerAudit.isPending}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw
              className={cn(
                "size-3.5 mr-1.5",
                triggerAudit.isPending && "animate-spin"
              )}
              aria-hidden="true"
            />
            Re-audit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerCloser.mutate(id!)}
            disabled={triggerCloser.isPending}
            className="flex-1 sm:flex-none"
          >
            <Sparkles className="size-3.5 mr-1.5" aria-hidden="true" /> Re-gen intel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0">
          <TabGroup
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(t) => setActiveTab(t as TabId)}
            variant="pills"
          />
        </CardHeader>
        <CardContent className="pt-4">
          {activeTab === "overview" && (
            <OverviewTab lead={lead} audit={audit} intel={intel} />
          )}
          {activeTab === "audit" && <AuditTab audit={audit} />}
          {activeTab === "reports" && (
            <ReportsTab
              leadId={id!}
              reports={reportsData?.items ?? []}
              onPreview={(reportId) => setPreviewReportId(reportId)}
              onGenerate={() =>
                generateReport.mutate(id!, {
                  onSuccess: (report) => {
                    notify.success("Reporte generado", {
                      href: id ? `/leads/${id}` : undefined,
                    });
                    if (report?.id && report.status === "completed") {
                      setPreviewReportId(report.id);
                    }
                  },
                  onError: (err) =>
                    notify.error(
                      err instanceof Error
                        ? err.message
                        : "No se pudo generar el reporte",
                    ),
                })
              }
              isGenerating={generateReport.isPending}
            />
          )}
          {activeTab === "outreach" && (
            <OutreachTab
              lead={lead}
              followUps={followUps?.items ?? []}
              outreach={outreachData?.items ?? []}
              reports={reportsData?.items ?? []}
              subject={outreachSubject}
              body={outreachBody}
              toEmail={outreachToEmail}
              suggestedEmails={suggestedEmails}
              hasValidEmail={hasValidOutreachEmail}
              attachReportId={attachReportId}
              onSubjectChange={setOutreachSubject}
              onBodyChange={setOutreachBody}
              onToEmailChange={setOutreachToEmail}
              onAttachReportIdChange={setAttachReportId}
              onSend={() => setSendModalOpen(true)}
              onQuickFollowUp={handleQuickFollowUp}
              onCancelFollowUps={() => cancelFollowUps.mutate(id!)}
              isSending={sendOutreach.isPending}
              intel={intel}
              emailVariant={emailVariant}
              onEmailVariantChange={applyEmailVariant}
            />
          )}
        </CardContent>
      </Card>

      <ReportPdfPreviewDialog
        reportId={previewReportId}
        title="Vista previa del informe"
        open={previewReportId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewReportId(null);
        }}
      />

      {/* Send Modal */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Outreach Email</DialogTitle>
            <DialogDescription>
              Compose and send an outreach email to {lead?.company_name ?? lead?.normalized_domain}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Para (email)
              </Label>
              <Input
                type="email"
                value={outreachToEmail}
                onChange={(e) => setOutreachToEmail(e.target.value)}
                placeholder="contacto@empresa.com"
              />
              {suggestedEmails.length === 0 && !hasValidOutreachEmail && (
                <p className="text-xs text-warning">
                  No hay email detectado. Escríbelo manualmente o vuelve a auditar el sitio.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Subject
              </Label>
              <Input
                value={outreachSubject}
                onChange={(e) => setOutreachSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Body
              </Label>
              <Textarea
                rows={8}
                value={outreachBody}
                onChange={(e) => setOutreachBody(e.target.value)}
                placeholder="Write your email..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="attach-report"
                checked={!!attachReportId}
                onCheckedChange={(checked) =>
                  setAttachReportId(
                    checked
                      ? (reportsData?.items?.[0]?.id)
                      : undefined
                  )
                }
                disabled={!reportsData?.items?.length}
              />
              <Label
                htmlFor="attach-report"
                className="text-xs cursor-pointer"
              >
                Attach latest PDF report
                {!reportsData?.items?.length && " (no reports available)"}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendOutreach}
              disabled={
                !hasValidOutreachEmail ||
                !outreachSubject ||
                !outreachBody ||
                sendOutreach.isPending
              }
            >
              <Send className="size-3.5 mr-1.5" aria-hidden="true" />
              {sendOutreach.isPending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Overview Tab
   ═══════════════════════════════════════════ */

function OverviewTab({
  lead,
  audit,
  intel,
}: {
  lead: Lead | undefined;
  audit: Audit | null | undefined;
  intel: SalesIntelligence | undefined;
}) {
  const problems = [
    {
      icon: Shield,
      label: "SSL",
      ok: lead?.has_ssl ?? false,
    },
    {
      icon: Smartphone,
      label: "Mobile Friendly",
      ok: lead?.mobile_friendly ?? false,
    },
    {
      icon: Gauge,
      label: `Load: ${lead?.load_time_ms ?? "—"}ms`,
      ok: (lead?.load_time_ms ?? Infinity) < 3000,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Score MetricCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Score"
          value={lead?.score ?? 0}
          formattedValue={String(lead?.score ?? "—")}
        />
        <MetricCard
          label="Lighthouse"
          value={audit?.lighthouse_score ?? 0}
          formattedValue={String(audit?.lighthouse_score ?? "—")}
        />
        <MetricCard
          label="Performance"
          value={audit?.performance_score ?? 0}
          formattedValue={String(audit?.performance_score ?? "—")}
        />
        <MetricCard
          label="Commercial Score"
          value={lead?.commercial_score ?? 0}
          formattedValue={String(lead?.commercial_score ?? "—")}
        />
      </div>

      {/* Technical Diagnostics */}
      <div>
        <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Technical Diagnostics
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {problems.map((p, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3",
                p.ok
                  ? "border-success/30 bg-success/5"
                  : "border-danger/30 bg-danger/5"
              )}
            >
              {p.ok ? (
                <CheckCircle className="size-4 text-success shrink-0" aria-hidden="true" />
              ) : (
                <XCircle className="size-4 text-danger shrink-0" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "text-sm",
                  p.ok ? "text-success" : "text-danger"
                )}
              >
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {intel?.extras?.sales_brief && (
        <div>
          <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
            <Sparkles className="size-4 text-warning" aria-hidden="true" />
            Pitch 30 s (para ti)
          </h3>
          <div className="rounded-lg bg-bg border border-border p-4">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {intel.extras.sales_brief}
            </p>
          </div>
        </div>
      )}

      {intel?.pain_points && intel.pain_points.length > 0 && (
        <div>
          <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Hallazgos IA
          </h3>
          <ul className="space-y-2">
            {intel.pain_points.slice(0, 5).map((pp: { title?: string; severity?: string }, i: number) => (
              <li
                key={i}
                className="text-sm text-text-secondary border border-border rounded-lg px-3 py-2"
              >
                <span className="font-medium text-text">{pp.title}</span>
                {pp.severity ? (
                  <span className="ml-2 text-[10px] font-mono uppercase text-text-muted">
                    {pp.severity}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Audit Tab
   ═══════════════════════════════════════════ */

function AuditTab({ audit }: { audit: Audit | null | undefined }) {
  if (!audit) {
    return (
      <p className="text-sm text-text-muted py-6">
        No audit data available. Trigger an audit first.
      </p>
    );
  }

  const metrics = [
    { label: "Performance", value: audit.performance_score },
    { label: "Accessibility", value: audit.accessibility_score },
    { label: "Best Practices", value: audit.best_practices_score },
    { label: "SEO", value: audit.seo_score },
  ];

  const vitals = [
    {
      label: "FCP",
      value: audit.first_contentful_paint_ms,
      format: (v: number) => `${Math.round(v)} ms`,
      good: 1800,
      compare: (v: number) => v <= 1800,
    },
    {
      label: "LCP",
      value: audit.largest_contentful_paint_ms,
      format: (v: number) => `${Math.round(v)} ms`,
      good: 2500,
      compare: (v: number) => v <= 2500,
    },
    {
      label: "CLS",
      value: audit.cumulative_layout_shift,
      format: (v: number) => v.toFixed(3),
      good: 0.1,
      compare: (v: number) => v <= 0.1,
    },
    {
      label: "TBT",
      value: audit.total_blocking_time_ms,
      format: (v: number) => `${Math.round(v)} ms`,
      good: 200,
      compare: (v: number) => v <= 200,
    },
  ] as const;

  const screenshotSrc = screenshotPublicUrl(audit.screenshot_path);

  return (
    <div className="flex flex-col gap-6">
      {/* Lighthouse Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <MetricCard
            key={i}
            label={m.label}
            value={m.value ?? 0}
            formattedValue={String(m.value ?? "—")}
          />
        ))}
      </div>

      {/* Core Web Vitals */}
      <div>
        <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Core Web Vitals
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {vitals.map((v, i) => {
            const hasValue = v.value != null;
            const isGood = hasValue && v.compare(v.value as number);
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-3",
                  !hasValue && "border-border bg-surface-elevated/50",
                  hasValue &&
                    (isGood
                      ? "border-success/30 bg-success/5"
                      : "border-danger/30 bg-danger/5")
                )}
              >
                <div className="text-xs font-mono text-text-muted">
                  {v.label}
                </div>
                <div
                  className={cn(
                    "text-2xl font-mono font-bold mt-1",
                    !hasValue && "text-text-muted",
                    hasValue && (isGood ? "text-success" : "text-danger")
                  )}
                >
                  {hasValue ? v.format(v.value as number) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Screenshot */}
      {screenshotSrc && (
        <div>
          <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Screenshot
          </h3>
          <div className="rounded-lg border border-border overflow-hidden max-w-[600px]">
            <img
              src={screenshotSrc}
              alt="Audit screenshot"
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Reports Tab
   ═══════════════════════════════════════════ */

function ReportsTab({
  reports,
  onGenerate,
  onPreview,
  isGenerating,
}: {
  leadId: string;
  reports: ReportRead[];
  onGenerate: () => void;
  onPreview: (reportId: string) => void;
  isGenerating: boolean;
}) {
  const columns = useMemo<ColumnDef<ReportRead, unknown>[]>(
    () => [
      {
        id: "details",
        header: "Report",
        accessorFn: (row) => row.lead_domain ?? row.lead_id,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary opacity-60 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-text truncate">
                  {r.lead_domain || r.lead_id.slice(0, 8)}
                </div>
                <div className="text-[11px] text-text-muted">
                  {r.generated_at
                    ? new Date(r.generated_at).toLocaleDateString()
                    : ""}{" "}
                  · {(r.file_size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const variant =
            status === "completed"
              ? ("default" as const)
              : status === "failed"
                ? ("destructive" as const)
                : ("secondary" as const);
          return <Badge variant={variant}>{status}</Badge>;
        },
      },
      {
        id: "sent_count",
        header: "Sent",
        accessorFn: (row) => row.sent_count,
        cell: ({ getValue }) => (
          <span className="text-xs font-mono text-text-muted">
            {String(getValue())}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          const ready = r.status === "completed";
          return (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!ready}
                aria-label="Vista previa del PDF"
                onClick={() => onPreview(r.id)}
              >
                <Eye className="size-3.5" aria-hidden="true" />
              </Button>
              {ready ? (
                <a
                  href={api.getReportDownloadUrl(r.id)}
                  download
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Descargar PDF"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-sm" }),
                    "h-7 w-7",
                  )}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled
                  aria-label="Descargar PDF"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider">
          Generated Reports
        </h3>
        <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
          <FileText className="size-3.5 mr-1.5" aria-hidden="true" />
          {isGenerating ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          No reports generated yet
        </p>
      ) : (
        <DataTable<ReportRead>
          data={reports}
          columns={columns}
          density="compact"
          getRowId={(row) => row.id}
        />
      )}
    </div>
  );
}

function MessageHistorySection({
  leadId,
  outreach,
}: {
  leadId: string | undefined;
  outreach: OutreachMessage[];
}) {
  const recordInbound = useRecordInboundMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const sorted = useMemo(
    () =>
      [...outreach].sort((a, b) => {
        const ta = new Date(a.sent_at ?? a.created_at).getTime();
        const tb = new Date(b.sent_at ?? b.created_at).getTime();
        return tb - ta;
      }),
    [outreach],
  );

  const handleRecordReply = () => {
    if (!leadId || !senderEmail.trim() || replyBody.trim().length < 3) return;
    notify.promise(
      recordInbound.mutateAsync({
        lead_id: leadId,
        sender_email: senderEmail.trim(),
        subject: replySubject.trim() || undefined,
        body: replyBody.trim(),
      }),
      {
        loading: "Registrando respuesta...",
        success: "Respuesta registrada",
        error: (err) =>
          err instanceof Error ? err.message : "No se pudo registrar",
      },
    );
    setDialogOpen(false);
    setReplySubject("");
    setReplyBody("");
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider">
          <Mail className="size-3.5" aria-hidden="true" /> Historial de mensajes
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!leadId}
          onClick={() => setDialogOpen(true)}
        >
          Registrar respuesta recibida
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted">Aún no hay mensajes enviados ni recibidos.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((msg) => {
            const isOut = msg.direction === "outbound";
            return (
              <div
                key={msg.id}
                className="flex items-start justify-between rounded-lg bg-bg border border-border px-4 py-3 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={isOut ? "default" : "secondary"} className="text-[10px]">
                      {isOut ? "Enviado" : "Recibido"}
                    </Badge>
                    <span className="text-sm font-medium text-text truncate">
                      {msg.subject || "(sin asunto)"}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {isOut ? "Para" : "De"}: {msg.recipient} ·{" "}
                    {new Date(msg.sent_at ?? msg.created_at).toLocaleString("es-ES")}
                  </div>
                  <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                    {msg.body}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted shrink-0">
                  {isOut && msg.opened && <span className="text-success">Abierto</span>}
                  {isOut && msg.replied && <span className="text-success">Marcó respuesta</span>}
                  {msg.has_attachment && <span>PDF</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar mensaje recibido</DialogTitle>
            <DialogDescription>
              Guarda una respuesta del lead para verla en Mensajería y marcar el lead como respondido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="inbound-from">Email del remitente</Label>
              <Input
                id="inbound-from"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </div>
            <div>
              <Label htmlFor="inbound-subject">Asunto</Label>
              <Input
                id="inbound-subject"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inbound-body">Mensaje</Label>
              <Textarea
                id="inbound-body"
                rows={6}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRecordReply}
              disabled={
                recordInbound.isPending ||
                !senderEmail.trim() ||
                replyBody.trim().length < 3
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Outreach Tab
   ═══════════════════════════════════════════ */

function OutreachTab({
  lead,
  followUps,
  outreach,
  reports,
  subject,
  body,
  toEmail,
  suggestedEmails,
  hasValidEmail,
  attachReportId,
  onSubjectChange,
  onBodyChange,
  onToEmailChange,
  onAttachReportIdChange,
  onSend,
  onQuickFollowUp,
  onCancelFollowUps,
  isSending,
  intel,
  emailVariant,
  onEmailVariantChange,
}: {
  lead: Lead | undefined;
  followUps: FollowUpRead[];
  outreach: OutreachMessage[];
  reports: ReportRead[];
  subject: string;
  body: string;
  toEmail: string;
  suggestedEmails: string[];
  hasValidEmail: boolean;
  attachReportId: string | undefined;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onToEmailChange: (v: string) => void;
  onAttachReportIdChange: (v: string | undefined) => void;
  onSend: () => void;
  onQuickFollowUp: () => void;
  onCancelFollowUps: () => void;
  isSending: boolean;
  intel: SalesIntelligence | undefined;
  emailVariant: "a" | "b";
  onEmailVariantChange: (v: "a" | "b") => void;
}) {
  const hasAltEmail = Boolean(intel?.extras?.cold_email_body_alt);
  const pendingFollowUps = followUps.filter(
    (f) => f.status === "pending"
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-1">
              STATUS
            </div>
            <div className="text-base font-mono text-text capitalize">
              {lead?.status.replace(/_/g, " ")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-1">
              FOLLOW-UP STATUS
            </div>
            <div
              className={cn(
                "text-base font-mono",
                pendingFollowUps.length > 0
                  ? "text-warning"
                  : "text-text-muted"
              )}
            >
              {pendingFollowUps.length > 0
                ? `${pendingFollowUps.length} pending`
                : "None active"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider">
            Redactar email
          </h3>
          {hasAltEmail && (
            <div className="flex gap-1 rounded-lg border border-border p-0.5">
              <button
                type="button"
                className={cn(
                  "text-[10px] font-mono px-2.5 py-1 rounded-md",
                  emailVariant === "a"
                    ? "bg-primary text-primary-foreground"
                    : "text-text-muted hover:text-text",
                )}
                onClick={() => onEmailVariantChange("a")}
              >
                Variante A
              </button>
              <button
                type="button"
                className={cn(
                  "text-[10px] font-mono px-2.5 py-1 rounded-md",
                  emailVariant === "b"
                    ? "bg-primary text-primary-foreground"
                    : "text-text-muted hover:text-text",
                )}
                onClick={() => onEmailVariantChange("b")}
              >
                Variante B
              </button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider">
              Para (email)
            </Label>
            <Input
              type="email"
              value={toEmail}
              onChange={(e) => onToEmailChange(e.target.value)}
              placeholder="contacto@empresa.com"
            />
            {suggestedEmails.length > 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestedEmails.map((email) => (
                  <button
                    key={email}
                    type="button"
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border text-primary hover:bg-primary/10"
                    onClick={() => onToEmailChange(email)}
                  >
                    {email}
                  </button>
                ))}
              </div>
            )}
            {!hasValidEmail && (
              <p className="text-xs text-warning">
                Este lead no tiene email guardado. Introduce uno manualmente para enviar.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider">
              Subject
            </Label>
            <Input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Email subject"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider">
              Body
            </Label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Write your email..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="outreach-attach"
              checked={!!attachReportId}
              onCheckedChange={(checked) =>
                onAttachReportIdChange(
                  checked ? reports[0]?.id : undefined
                )
              }
              disabled={reports.length === 0}
            />
            <Label
              htmlFor="outreach-attach"
              className="text-xs cursor-pointer"
            >
              Attach latest PDF report
              {reports.length === 0 && " (no reports available)"}
            </Label>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={onSend}
              disabled={!hasValidEmail || !subject || !body || isSending}
            >
              <Send className="size-3.5 mr-1.5" aria-hidden="true" />
              {isSending ? "Sending..." : "Send Email"}
            </Button>
            <Button variant="outline" onClick={onQuickFollowUp}>
              <Clock className="size-3.5 mr-1.5" aria-hidden="true" /> Schedule Follow-up
            </Button>
            {pendingFollowUps.length > 0 && (
              <Button
                variant="destructive"
                onClick={onCancelFollowUps}
              >
                Cancel Follow-ups
              </Button>
            )}
          </div>
        </div>
      </div>

      <MessageHistorySection leadId={lead?.id} outreach={outreach} />

      {/* Follow-up Schedule */}
      {followUps.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
            <Clock className="size-3.5" aria-hidden="true" /> Scheduled Follow-ups
          </h3>
          <div className="space-y-1.5">
            {followUps.map((fu) => (
              <div
                key={fu.id}
                className="flex items-center justify-between rounded-lg bg-bg border border-border px-4 py-2.5"
              >
                <span className="text-sm text-text">{fu.subject}</span>
                <Badge
                  variant={
                    fu.status === "sent"
                      ? "default"
                      : fu.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {fu.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
