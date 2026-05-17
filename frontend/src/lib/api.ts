const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const API_BASE = RAW_BASE.replace(/\/$/, "");

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

export interface Lead {
  id: string;
  url: string;
  normalized_domain: string;
  company_name: string | null;
  industry: string | null;
  status: LeadStatus;
  score: number;
  lighthouse_score: number | null;
  mobile_friendly: boolean | null;
  has_ssl: boolean | null;
  load_time_ms: number | null;
  email: string | null;
  phone: string | null;
  discovered_at: string;
  audited_at: string | null;
  contacted_at: string | null;
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
    throw new Error(`API ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listLeads(params: { limit?: number; offset?: number; status?: LeadStatus } = {}) {
    const search = new URLSearchParams();
    if (params.limit) search.set("limit", String(params.limit));
    if (params.offset) search.set("offset", String(params.offset));
    if (params.status) search.set("status", params.status);
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
  sendOutreachEmail(leadId: string, subject?: string, body?: string) {
    const params = new URLSearchParams();
    params.set("lead_id", leadId);
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    return request<{ status: string; message_id: string; outreach_id: string; recipient: string }>(
      `/v1/outreach/send?${params.toString()}`,
      { method: "POST" }
    );
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
};
