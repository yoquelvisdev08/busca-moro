import { useState, useEffect, useMemo } from "react";
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
} from "@/lib/hooks";
import type {
  Lead,
  Audit,
  SalesIntelligence,
  ReportRead,
  OutreachMessage,
  FollowUpRead,
} from "@/lib/api";
import { api } from "@/lib/api";
import { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
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
import { StatusLED, type StatusLEDVariant } from "@/components/domain/StatusLED";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable } from "@/components/tables/DataTable";
import { cn } from "@/lib/utils";

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
    if (intel?.cold_email_subject && !outreachSubject)
      setOutreachSubject(intel.cold_email_subject);
    if (intel?.cold_email_body && !outreachBody)
      setOutreachBody(intel.cold_email_body);
  }, [intel]);

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
    sendOutreach.mutate(
      {
        leadId: id!,
        subject: outreachSubject,
        body: outreachBody,
        attachReportId,
      },
      {
        onSuccess: (result) => {
          toast.success(`Email sent to ${result.recipient}`);
          setSendModalOpen(false);
        },
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
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
        onSuccess: () => toast.success("Follow-up sequence scheduled"),
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
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
              onGenerate={() =>
                generateReport.mutate(id!, {
                  onSuccess: () => toast.success("Report generated"),
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
        </CardContent>
      </Card>

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

      {/* AI Sales Intelligence */}
      {intel?.cold_email_body && (
        <div>
          <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
            <Sparkles className="size-4 text-warning" aria-hidden="true" /> AI Sales Intelligence
          </h3>
          <div className="rounded-lg bg-bg border border-border p-4">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {intel.cold_email_body.slice(0, 500)}
              {intel.cold_email_body.length > 500 ? "..." : ""}
            </p>
          </div>
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
      unit: "ms",
      good: 1800,
    },
    {
      label: "LCP",
      value: audit.largest_contentful_paint_ms,
      unit: "ms",
      good: 2500,
    },
    {
      label: "CLS",
      value: audit.cumulative_layout_shift,
      unit: "",
      good: 0.1,
    },
    {
      label: "TBT",
      value: audit.total_blocking_time_ms,
      unit: "ms",
      good: 200,
    },
  ];

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
            const val = v.value ?? 0;
            const isGood =
              v.unit === ""
                ? val <= v.good
                : val <= v.good;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-3",
                  isGood
                    ? "border-success/30 bg-success/5"
                    : "border-danger/30 bg-danger/5"
                )}
              >
                <div className="text-xs font-mono text-text-muted">
                  {v.label}
                </div>
                <div
                  className={cn(
                    "text-2xl font-mono font-bold mt-1",
                    isGood ? "text-success" : "text-danger"
                  )}
                >
                  {v.value ?? "—"}
                  {v.unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Screenshot */}
      {audit.screenshot_path && (
        <div>
          <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Screenshot
          </h3>
          <div className="rounded-lg border border-border overflow-hidden max-w-[600px]">
            <img
              src={`/screenshots/${audit.screenshot_path.split("/").pop()}`}
              alt="Audit screenshot"
              className="w-full"
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
  isGenerating,
}: {
  leadId: string;
  reports: ReportRead[];
  onGenerate: () => void;
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
          return (
            <a
              href={api.getReportDownloadUrl(r.id)}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Download className="size-3.5" aria-hidden="true" />
              </Button>
            </a>
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

      {/* Email Editor */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider">
          Compose Email
        </h3>
        <div className="space-y-3">
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
              disabled={!subject || !body || isSending}
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

      {/* Email History */}
      <div>
        <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-text-secondary uppercase tracking-wider mb-3">
          <Mail className="size-3.5" aria-hidden="true" /> Email History
        </h3>
        {outreach.length === 0 ? (
          <p className="text-sm text-text-muted">No emails sent yet.</p>
        ) : (
          <div className="space-y-2">
            {outreach.map((msg) => (
              <div
                key={msg.id}
                className="flex items-center justify-between rounded-lg bg-bg border border-border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text truncate">
                    {msg.subject}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    To: {msg.recipient} ·{" "}
                    {msg.sent_at
                      ? new Date(msg.sent_at).toLocaleDateString()
                      : "Pending"}
                    {msg.replied && (
                      <span className="ml-2 text-success">
                        ● Replied
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-text-muted shrink-0 ml-4">
                  {msg.opened_at ? (
                    <span>✓ Opened</span>
                  ) : (
                    <span>— Unopened</span>
                  )}
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
