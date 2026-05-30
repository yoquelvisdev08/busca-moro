import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeadStatus } from "@/lib/api";
import {
  api,
  type ReportRead,
  type ReportListResponse,
  type FollowUpListResponse,
  type FollowUpSequenceStep,
  type Lead,
  type LeadDetailResponse,
  type LeadListResponse,
  type OutreachMessage,
  type MonitorStatus,
} from "@/lib/api";

/* ═══════════════════════════════════════════════════════
   Query Key Factory
   ═══════════════════════════════════════════════════════ */

export const queryKeys = {
  leads: {
    all: ["leads"] as const,
    list: (params: { limit?: number; offset?: number; status?: LeadStatus }) =>
      ["leads", "list", params] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
  },
  reports: {
    all: ["reports"] as const,
    list: (params?: { limit?: number; offset?: number; lead_id?: string }) =>
      ["reports", "list", params] as const,
    detail: (id: string) => ["reports", id] as const,
  },
  outreach: {
    list: (params?: { lead_id?: string }) => ["outreach", "list", params] as const,
  },
  followUps: {
    list: (leadId: string) => ["follow-ups", leadId] as const,
  },
  campaigns: {
    all: ["campaigns"] as const,
  },
  monitor: {
    status: ["monitor", "status"] as const,
  },
  senderProfile: ["sender-profile"] as const,
};

/* ═══════════════════════════════════════════════════════
   Leads
   ═══════════════════════════════════════════════════════ */

export function useLeads(params: { limit?: number; offset?: number; status?: LeadStatus } = {}) {
  return useQuery<LeadListResponse>({
    queryKey: queryKeys.leads.list(params),
    queryFn: () => api.listLeads(params),
  });
}

export function useLead(id: string | undefined) {
  return useQuery<LeadDetailResponse>({
    queryKey: queryKeys.leads.detail(id!),
    queryFn: () => api.getLeadDetail(id!),
    enabled: !!id,
  });
}

export function useUpdateLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) => api.updateLead(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useBulkUpdateLeadsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: Partial<Lead> }) => api.bulkUpdateLeads(ids, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useTriggerAuditMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api.triggerAudit(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useTriggerCloserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api.triggerCloser(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

/* ═══════════════════════════════════════════════════════
   Reports
   ═══════════════════════════════════════════════════════ */

export function useReports(params?: { limit?: number; offset?: number; lead_id?: string }) {
  return useQuery<ReportListResponse>({
    queryKey: queryKeys.reports.list(params),
    queryFn: () => api.listReports(params),
  });
}

export function useReport(id: string | undefined) {
  return useQuery<ReportRead>({
    queryKey: queryKeys.reports.detail(id!),
    queryFn: () => api.getReport(id!),
    enabled: !!id,
  });
}

export function useGenerateReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api.generateReport(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useResendReportMutation() {
  return useMutation({
    mutationFn: (reportId: string) => api.resendReport(reportId),
  });
}

export function useDeleteReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => api.deleteReport(reportId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

/* ═══════════════════════════════════════════════════════
   Outreach
   ═══════════════════════════════════════════════════════ */

export function useOutreach(leadId?: string) {
  return useQuery<{ items: OutreachMessage[]; total: number; limit: number; offset: number }>({
    queryKey: queryKeys.outreach.list({ lead_id: leadId }),
    queryFn: () => api.listOutreach({ lead_id: leadId }),
    enabled: !!leadId,
  });
}

export function useSendOutreachMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      subject,
      body,
      attachReportId,
      toEmail,
    }: {
      leadId: string;
      subject?: string;
      body?: string;
      attachReportId?: string;
      toEmail?: string;
    }) => api.sendOutreachEmail(leadId, subject, body, attachReportId, toEmail),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["leads", "detail", variables.leadId] });
      qc.invalidateQueries({ queryKey: ["outreach"] });
    },
  });
}

/* ═══════════════════════════════════════════════════════
   Follow-ups
   ═══════════════════════════════════════════════════════ */

export function useFollowUps(leadId: string | undefined) {
  return useQuery<FollowUpListResponse>({
    queryKey: queryKeys.followUps.list(leadId!),
    queryFn: () => api.listFollowUps(leadId!),
    enabled: !!leadId,
  });
}

export function useScheduleFollowUpMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      steps,
      sequenceName,
    }: {
      leadId: string;
      steps: FollowUpSequenceStep[];
      sequenceName: string;
    }) => api.scheduleFollowUp(leadId, steps, sequenceName),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.followUps.list(variables.leadId) });
    },
  });
}

export function useCancelFollowUpMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (followUpId: string) => api.cancelFollowUp(followUpId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["follow-ups"] }),
  });
}

export function useCancelAllFollowUpsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api.cancelAllFollowUps(leadId),
    onSuccess: (_data, leadId) => {
      qc.invalidateQueries({ queryKey: queryKeys.followUps.list(leadId) });
    },
  });
}

/* ═══════════════════════════════════════════════════════
   Campaigns (client-side for now, API later)
   ═══════════════════════════════════════════════════════ */

type CampaignStatus = "active" | "paused" | "completed";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  lead_count: number;
  sent_count: number;
  opened_count: number;
  replied_count: number;
  bounced_count: number;
  created_at: string;
}

// Campaigns are client-state only for MVP — no backend endpoint yet
let campaignsCache: Campaign[] = [];

export async function fetchCampaigns(): Promise<Campaign[]> {
  return campaignsCache;
}

export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: queryKeys.campaigns.all,
    queryFn: fetchCampaigns,
    staleTime: 60_000,
  });
}

export function useCreateCampaignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaign: Omit<Campaign, "id" | "created_at">) => {
      const newCampaign: Campaign = {
        ...campaign,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      campaignsCache = [...campaignsCache, newCampaign];
      return Promise.resolve(newCampaign);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns.all }),
  });
}

export function useUpdateCampaignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Campaign> }) => {
      campaignsCache = campaignsCache.map((c) => (c.id === id ? { ...c, ...data } : c));
      return Promise.resolve(campaignsCache.find((c) => c.id === id)!);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns.all }),
  });
}

/* ═══════════════════════════════════════════════════════
   Monitor
   ═══════════════════════════════════════════════════════ */

export function useMonitorStatus() {
  return useQuery<MonitorStatus>({
    queryKey: queryKeys.monitor.status,
    queryFn: () => api.getMonitorStatus(),
    refetchInterval: 5_000,
  });
}

/* ═══════════════════════════════════════════════════════
   Sender Profile
   ═══════════════════════════════════════════════════════ */

export function useSenderProfile() {
  return useQuery({
    queryKey: queryKeys.senderProfile,
    queryFn: () => api.getSenderProfile(),
  });
}
