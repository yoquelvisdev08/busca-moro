const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const API_BASE = RAW_BASE.replace(/\/$/, "");

/** URL pública del screenshot vía proxy nginx (/api → API). */
export function screenshotPublicUrl(
  screenshotPath: string | null | undefined,
): string | null {
  if (!screenshotPath) return null;
  const filename = screenshotPath.split("/").pop();
  if (!filename) return null;
  return `${API_BASE}/screenshots/${filename}`;
}

export type LeadStatus =
  | "new"
  | "queued"
  | "auditing"
  | "audited"
  | "enriched"
  | "contacted"
  | "interested"
  | "negotiation"
  | "closed_won"
  | "closed_lost"
  | "replied"
  | "won"
  | "rejected"
  | "error";

export interface LeadOutreachSummary {
  has_message_sent: boolean;
  messages_sent_count: number;
  has_reply_received: boolean;
  inbound_messages_count: number;
}

export interface Lead {
  id: string;
  url: string;
  normalized_domain: string;
  company_name: string | null;
  industry: string | null;
  status: LeadStatus;
  outreach?: LeadOutreachSummary;
  score: number;
  lighthouse_score: number | null;
  mobile_friendly: boolean | null;
  has_ssl: boolean | null;
  load_time_ms: number | null;
  email: string | null;
  secondary_emails?: string[];
  phone: string | null;
  discovered_at: string;
  audited_at: string | null;
  contacted_at: string | null;
  next_step_type?: string | null;
  next_step_at?: string | null;
  next_step_notes?: string | null;
  needs_next_step?: boolean;
  has_email?: boolean;
  tech_stack: Record<string, unknown>;
  social_links: Record<string, unknown>;
  commercial_score: number | null;
  segment: "A" | "B" | "C" | "D" | null;
  revenue_signal: string | null;
  has_pricing_page: boolean | null;
  has_testimonials: boolean | null;
  content_freshness_days: number | null;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  limit: number;
  offset: number;
}

export interface QueueDepths {
  discovery: number;
  audit: number;
  outreach: number;
  sniper_alerts: number;
  dlq: number;
}

export interface SniperTarget {
  id: string;
  url: string;
  label: string | null;
  industry: string | null;
  enabled: boolean;
  interval_seconds: number;
  failure_threshold: number;
  consecutive_failures: number;
  last_status_code: number | null;
  last_checked_at: string | null;
}

export interface Audit {
  id: string;
  lead_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  screenshot_url: string | null;
  lighthouse_score: number | null;
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  first_contentful_paint_ms: number | null;
  largest_contentful_paint_ms: number | null;
  cumulative_layout_shift: number | null;
  total_blocking_time_ms: number | null;
  screenshot_path: string | null;
  extracted_contacts: Record<string, any>;
}

export interface CommercialPlaybook {
  price_range?: string;
  delivery_timeline?: string;
  call_cta?: string;
  scope_summary?: string | string[];
}

export interface SalesIntelligenceExtras {
  sales_brief?: string;
  commercial_playbook?: CommercialPlaybook;
  cold_email_subject_alt?: string | null;
  cold_email_body_alt?: string | null;
  report_narrative?: Record<string, unknown>;
}

export interface SalesIntelligence {
  id: string;
  lead_id: string;
  audit_id: string | null;
  model: string;
  pain_points: any[];
  cold_email_subject: string | null;
  cold_email_body: string | null;
  language: string;
  tone: string | null;
  extras?: SalesIntelligenceExtras;
  generated_at: string;
}

export interface SenderProfile {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  website: string;
  bio: string | null;
  services: string[];
  tech_stack: string[];
  tone: string;
  email_signature: string;
  is_active: boolean;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadDetailResponse {
  lead: Lead;
  latest_audit: Audit | null;
  audits: Audit[];
  sales_intelligence: SalesIntelligence[];
}

function formatApiError(status: number, body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        detail?: string | { msg?: string }[];
      };
      if (typeof parsed.detail === "string") {
        return parsed.detail;
      }
      if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) {
        return parsed.detail[0].msg;
      }
    } catch {
      /* cuerpo JSON malformado: usar texto crudo */
    }
  }
  if (trimmed) {
    return trimmed.length > 280 ? `${trimmed.slice(0, 280)}...` : trimmed;
  }
  return `Error del servidor (HTTP ${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatApiError(response.status, text));
  }
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      formatApiError(
        response.status,
        text || "El servidor no devolvió JSON (¿error interno al generar el PDF?)",
      ),
    );
  }
  return response.json() as Promise<T>;
}

/* ── Report Types ── */

export interface ReportRead {
  id: string;
  lead_id: string;
  audit_id: string | null;
  sales_intel_id: string | null;
  file_path: string;
  file_size: number;
  status: string;
  generated_at: string | null;
  sent_count: number;
  created_at: string;
  lead_domain?: string | null;
  lead_company_name?: string | null;
}

export interface ReportListResponse {
  items: ReportRead[];
  total: number;
  limit: number;
  offset: number;
}

/* ── Follow-up Types ── */

export type FollowUpStatus = "pending" | "sent" | "cancelled" | "failed";

export interface FollowUpRead {
  id: string;
  lead_id: string;
  sequence_name: string;
  step_number: number;
  scheduled_at: string;
  sent_at: string | null;
  status: FollowUpStatus;
  subject: string;
  body: string;
  include_pdf: boolean;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

export interface FollowUpListResponse {
  items: FollowUpRead[];
  total: number;
}

export interface FollowUpSequenceStep {
  delay_days: number;
  subject: string;
  body: string;
  include_pdf: boolean;
}

export interface FollowUpSequenceRead {
  sequence_name: string;
  lead_id: string;
  steps_scheduled: number;
  follow_up_ids: string[];
  next_scheduled_at: string | null;
}

export type MessageDirection = "outbound" | "inbound";

export interface OutreachMessage {
  id: string;
  lead_id: string;
  sales_intel_id: string | null;
  channel: string;
  direction: MessageDirection;
  recipient: string;
  subject: string | null;
  body: string;
  provider_message_id: string | null;
  delivered: boolean | null;
  opened: boolean | null;
  clicked: boolean | null;
  replied: boolean;
  has_attachment: boolean;
  report_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  lead_domain?: string | null;
  lead_company_name?: string | null;
}

export interface MonitorStatus {
  services: {
    name: string;
    status: "online" | "degraded" | "offline";
    last_check: string;
    response_ms: number;
  }[];
  queues: QueueDepths;
  events: {
    type: "error" | "info" | "success";
    service: string;
    message: string;
    time: string;
  }[];
}

export interface BulkSendDetail {
  lead_id: string;
  status: "sent" | "skipped" | "failed";
  detail: string;
}

export interface BulkSendResponse {
  sent: number;
  skipped: BulkSendDetail[];
  failed: BulkSendDetail[];
}

export const api = {
  listLeads(
    params: {
      limit?: number;
      offset?: number;
      status?: LeadStatus;
      needs_next_step?: boolean;
      message_sent?: boolean;
      has_email?: boolean;
      discovered_since?: string;
      created_since?: string;
    } = {},
  ) {
    const search = new URLSearchParams();
    if (params.limit) search.set("limit", String(params.limit));
    if (params.offset) search.set("offset", String(params.offset));
    if (params.status) search.set("status", params.status);
    if (params.needs_next_step) search.set("needs_next_step", "true");
    if (params.message_sent === true) search.set("message_sent", "true");
    if (params.message_sent === false) search.set("message_sent", "false");
    if (params.has_email === true) search.set("has_email", "true");
    if (params.has_email === false) search.set("has_email", "false");
    if (params.discovered_since) search.set("discovered_since", params.discovered_since);
    if (params.created_since) search.set("created_since", params.created_since);
    const qs = search.toString();
    return request<LeadListResponse>(`/v1/leads${qs ? `?${qs}` : ""}`);
  },
  getLead(id: string) {
    return request<Lead>(`/v1/leads/${id}`);
  },
  updateLead(id: string, data: Partial<Lead>) {
    return request<Lead>(`/v1/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  setLeadNextStep(
    id: string,
    payload: {
      step: "call" | "proposal" | "discard";
      scheduled_at?: string;
      notes?: string;
      close_as_lost?: boolean;
    },
  ) {
    return request<Lead>(`/v1/leads/${id}/next-step`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteLead(id: string, payload: { reason: string; detail?: string }) {
    const search = new URLSearchParams({ reason: payload.reason });
    if (payload.detail?.trim()) {
      search.set("detail", payload.detail.trim());
    }
    return request<{ status: string; lead_id: string }>(
      `/v1/leads/${id}?${search.toString()}`,
      { method: "DELETE" },
    );
  },
  bulkUpdateLeads(ids: string[], data: Partial<Lead>) {
    return request<{ updated: number }>(`/v1/leads/bulk`, {
      method: "PATCH",
      body: JSON.stringify({ ids, ...data }),
    });
  },
  getAudit(leadId: string) {
    return request<Audit>(`/v1/audits/lead/${leadId}`);
  },
  getQueueDepths() {
    return request<QueueDepths>("/v1/monitor/queues");
  },
  listSniperTargets() {
    return request<SniperTarget[]>("/v1/sniper/targets?only_enabled=true");
  },
  triggerAudit(leadId: string) {
    return request<{ status: string }>(`/v1/leads/${leadId}/audit`, { method: "POST" });
  },
  triggerCloser(leadId: string) {
    return request<{ status: string }>(`/v1/leads/${leadId}/closer`, { method: "POST" });
  },
  getLeadDetail(id: string) {
    return request<LeadDetailResponse>(`/v1/leads/${id}/detail`);
  },
  sendOutreachEmail(
    leadId: string,
    subject?: string,
    body?: string,
    attachReportId?: string,
    toEmail?: string,
  ) {
    const params = new URLSearchParams();
    params.set("lead_id", leadId);
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    if (attachReportId) params.set("attach_report_id", attachReportId);
    if (toEmail?.trim()) params.set("to_email", toEmail.trim());
    return request<{
      status: string;
      message_id: string;
      outreach_id: string;
      recipient: string;
      has_attachment: boolean;
      needs_next_step?: boolean;
    }>(`/v1/outreach/send?${params.toString()}`, { method: "POST" });
  },
  getSenderProfile() {
    return request<SenderProfile | null>("/v1/sender-profile");
  },
  createSenderProfile(data: Omit<SenderProfile, "id" | "created_at" | "updated_at" | "scraped_at">) {
    return request<SenderProfile>("/v1/sender-profile", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateSenderProfile(id: string, data: Partial<Omit<SenderProfile, "id" | "created_at" | "updated_at" | "scraped_at">>) {
    return request<SenderProfile>(`/v1/sender-profile/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  scrapeSenderProfile(website?: string) {
    return request<{ success: boolean; message: string; profile: SenderProfile }>(
      `/v1/sender-profile/scrape?website=${encodeURIComponent(website || "https://yoquelvis.dev")}`,
      { method: "POST" }
    );
  },
  startDiscovery(params: { industry: string; location?: string; numDorks?: number }) {
    const search = new URLSearchParams();
    search.set("industry", params.industry);
    if (params.location) search.set("location", params.location);
    if (params.numDorks) search.set("num_dorks", String(params.numDorks));
    return request<{ success: boolean; dorks_generated: number; message: string }>(
      `/v1/scout/start?${search.toString()}`,
      { method: "POST" }
    );
  },
  analyzeUrl(params: {
    url: string;
    location?: string;
    industry?: string;
  }) {
    return request<{
      success: boolean;
      published: boolean;
      message: string;
      url: string;
      segment?: string | null;
      total_score?: number | null;
      skipped_reason?: string | null;
      reasons?: string[];
    }>("/v1/scout/analyze-url", {
      method: "POST",
      body: JSON.stringify({
        url: params.url,
        location: params.location ?? null,
        industry: params.industry ?? null,
      }),
    });
  },

  /* ── Reports ── */
  generateReport(leadId: string) {
    return request<ReportRead>(`/v1/leads/${leadId}/generate-report`, { method: "POST" });
  },
  listReports(params: { limit?: number; offset?: number; lead_id?: string } = {}) {
    const search = new URLSearchParams();
    if (params.limit) search.set("limit", String(params.limit));
    if (params.offset) search.set("offset", String(params.offset));
    if (params.lead_id) search.set("lead_id", params.lead_id);
    const qs = search.toString();
    return request<ReportListResponse>(`/v1/reports${qs ? `?${qs}` : ""}`);
  },
  getReport(id: string) {
    return request<ReportRead>(`/v1/reports/${id}`);
  },
  getReportDownloadUrl(id: string) {
    return `${API_BASE}/v1/reports/${id}/download`;
  },
  getReportPreviewUrl(id: string) {
    return `${API_BASE}/v1/reports/${id}/preview`;
  },
  resendReport(id: string) {
    return request<{ status: string; report_id: string }>(`/v1/reports/${id}/resend`, { method: "POST" });
  },
  deleteReport(id: string) {
    return request<void>(`/v1/reports/${id}`, { method: "DELETE" });
  },

  /* ── Follow-ups ── */
  scheduleFollowUp(leadId: string, steps: FollowUpSequenceStep[], sequenceName: string) {
    return request<FollowUpSequenceRead>(`/v1/leads/${leadId}/schedule-follow-up`, {
      method: "POST",
      body: JSON.stringify({ sequence_name: sequenceName, steps }),
    });
  },
  listFollowUps(leadId: string) {
    return request<FollowUpListResponse>(`/v1/leads/${leadId}/follow-ups`);
  },
  cancelFollowUp(followUpId: string) {
    return request<{ status: string }>(`/v1/follow-ups/${followUpId}/cancel`, { method: "POST" });
  },
  cancelAllFollowUps(leadId: string) {
    return request<{ status: string; cancelled_count: number }>(`/v1/leads/${leadId}/cancel-follow-ups`, { method: "POST" });
  },

  /* ── Monitor ── */
  getMonitorStatus(): Promise<MonitorStatus> {
    return request<QueueDepths>("/v1/monitor/queues").then(async (queues) => {
      const sniperTargets = await this.listSniperTargets().catch(() => []);
      const now = new Date().toISOString();
      return {
        services: [
          { name: "Scout", status: "online" as const, last_check: now, response_ms: 84 },
          { name: "Auditor", status: "online" as const, last_check: now, response_ms: 112 },
          { name: "Closer", status: "online" as const, last_check: now, response_ms: 95 },
          { name: "Sniper", status: sniperTargets.length > 0 ? "online" as const : "degraded" as const, last_check: now, response_ms: 240 },
          { name: "API", status: "online" as const, last_check: now, response_ms: 45 },
          { name: "Email", status: "online" as const, last_check: now, response_ms: 1200 },
        ],
        queues,
        events: [],
      };
    });
  },

  /* ── Outreach History ── */
  listOutreach(
    params: {
      lead_id?: string;
      direction?: MessageDirection;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const search = new URLSearchParams();
    if (params.lead_id) search.set("lead_id", params.lead_id);
    if (params.direction) search.set("direction", params.direction);
    if (params.limit) search.set("limit", String(params.limit));
    if (params.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return request<{ items: OutreachMessage[]; total: number; limit: number; offset: number }>(
      `/v1/outreach${qs ? `?${qs}` : ""}`,
    );
  },
  trackOutreachReply(messageId: string) {
    return request<{ status: string; follow_ups_cancelled: boolean }>(
      `/v1/outreach/${messageId}/track-reply`,
      { method: "POST" },
    );
  },
  recordInboundMessage(payload: {
    lead_id: string;
    sender_email: string;
    subject?: string;
    body: string;
    channel?: string;
  }) {
    return request<OutreachMessage>("/v1/outreach/inbound", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /* ── Bulk Report Send ── */
  bulkReportSend(leadIds: string[], attachReport = true) {
    return request<BulkSendResponse>("/v1/outreach/bulk-send", {
      method: "POST",
      body: JSON.stringify({ lead_ids: leadIds, attach_report: attachReport }),
    });
  },
};
