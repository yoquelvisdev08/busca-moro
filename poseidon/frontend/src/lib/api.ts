const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const API_BASE = RAW_BASE.replace(/\/$/, "");

export const ORION_APP_URL = (import.meta.env.VITE_ORION_APP_URL ?? "").replace(/\/$/, "");

export function orionLeadUrl(leadId: string): string {
  if (ORION_APP_URL) {
    return `${ORION_APP_URL}/orion/leads/${leadId}`;
  }
  return `/orion/leads/${leadId}`;
}

export type PoseidonSignalStatus =
  | "new"
  | "reviewed"
  | "contacted"
  | "dismissed"
  | "converted";

export type PoseidonIntentCategory =
  | "web_dev"
  | "scraping"
  | "performance"
  | "hosting"
  | "wordpress"
  | "general";

export interface PoseidonSignal {
  id: string;
  source_url: string;
  platform: string;
  title: string;
  snippet: string;
  intent_category: PoseidonIntentCategory | string;
  intent_score: number;
  keyword_score: number;
  llm_score: number | null;
  query_used: string | null;
  status: PoseidonSignalStatus;
  lead_id: string | null;
  llm_summary: string | null;
  reply_angle: string | null;
  notes: string | null;
  detected_at: string;
  created_at: string;
  updated_at: string;
}

export interface PoseidonSignalListResponse {
  items: PoseidonSignal[];
  total: number;
  limit: number;
  offset: number;
}

export interface PoseidonScanStatus {
  active: boolean;
  last_scan_at: string | null;
  last_scan_found: number;
  last_scan_saved: number;
  last_error: string | null;
  queries_count: number;
  phase?: "discovery" | "classify" | "done" | "error" | null;
  progress_current?: number;
  progress_total?: number;
  status_message?: string | null;
}

export interface PoseidonConvertResult {
  signal_id: string;
  lead_id: string;
  lead_url: string;
  message: string;
}

export interface SubredditScan {
  subreddit: string;
  query: string;
}

export interface PoseidonConfig {
  loop_interval_minutes: number;
  query_delay_seconds: number;
  results_per_query: number;
  max_post_age_days: number;
  min_keyword_score: number;
  min_intent_score: number;
  min_intent_score_no_llm: number;
  max_llm_classifications: number;
  use_llm: boolean;
  use_arctic_shift: boolean;
  use_pullpush: boolean;
  use_searx: boolean;
  require_spanish: boolean;
  require_latam_or_spain: boolean;
  search_queries: string[];
  subreddit_scans: SubredditScan[];
  query_subreddits: string[];
  searx_domains: string[];
}

export type PoseidonConfigUpdate = Partial<PoseidonConfig>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  listPoseidonSignals(params?: {
    status?: PoseidonSignalStatus;
    intent_category?: string;
    min_score?: number;
    limit?: number;
    offset?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.intent_category) qs.set("intent_category", params.intent_category);
    if (params?.min_score != null) qs.set("min_score", String(params.min_score));
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request<PoseidonSignalListResponse>(`/v1/poseidon/signals${q ? `?${q}` : ""}`);
  },
  updatePoseidonSignal(id: string, patch: { status?: PoseidonSignalStatus; notes?: string }) {
    return request<PoseidonSignal>(`/v1/poseidon/signals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  convertPoseidonSignal(id: string) {
    return request<PoseidonConvertResult>(`/v1/poseidon/signals/${id}/convert`, {
      method: "POST",
    });
  },
  getPoseidonStats() {
    return request<Record<string, number>>("/v1/poseidon/stats");
  },
  getPoseidonScanStatus() {
    return request<PoseidonScanStatus>("/v1/poseidon/scan-status");
  },
  triggerPoseidonScan() {
    return request<PoseidonScanStatus>("/v1/poseidon/scan", { method: "POST" });
  },
  getPoseidonConfig() {
    return request<PoseidonConfig>("/v1/poseidon/config");
  },
  updatePoseidonConfig(patch: PoseidonConfigUpdate) {
    return request<PoseidonConfig>("/v1/poseidon/config", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};
