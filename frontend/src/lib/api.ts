const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const API_BASE = RAW_BASE.replace(/\/$/, "");

export type LeadStatus =
  | "new"
  | "queued"
  | "auditing"
  | "audited"
  | "enriched"
  | "contacted"
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
};
