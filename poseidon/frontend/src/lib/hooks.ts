import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PoseidonSignalStatus } from "@/lib/api";

const keys = {
  signals: (params?: object) => ["poseidon", "signals", params] as const,
  stats: ["poseidon", "stats"] as const,
  scanStatus: ["poseidon", "scan-status"] as const,
};

export function usePoseidonRecentSignals() {
  return useQuery({
    queryKey: ["poseidon", "signals", "recent"],
    queryFn: () => api.listPoseidonSignals({ limit: 200, min_score: 0 }),
    refetchInterval: 30_000,
  });
}

export function usePoseidonSignals(params?: {
  status?: PoseidonSignalStatus;
  min_score?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: keys.signals(params),
    queryFn: () => api.listPoseidonSignals(params),
    refetchInterval: 30_000,
  });
}

export function usePoseidonStats() {
  return useQuery({
    queryKey: keys.stats,
    queryFn: () => api.getPoseidonStats(),
    refetchInterval: 30_000,
  });
}

export function usePoseidonScanStatus() {
  return useQuery({
    queryKey: keys.scanStatus,
    queryFn: () => api.getPoseidonScanStatus(),
    refetchInterval: (query) => (query.state.data?.active ? 2_000 : 15_000),
  });
}

export function useUpdatePoseidonSignalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { status?: PoseidonSignalStatus; notes?: string };
    }) => api.updatePoseidonSignal(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["poseidon"] });
    },
  });
}

export function useConvertPoseidonSignalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.convertPoseidonSignal(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["poseidon"] });
    },
  });
}

export function useTriggerPoseidonScanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.triggerPoseidonScan(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.scanStatus });
    },
  });
}
