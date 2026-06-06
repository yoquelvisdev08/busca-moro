import { cn } from "@/lib/utils";
import type { PoseidonScanStatus } from "@/lib/api";

function scanProgressPercent(status: PoseidonScanStatus | undefined): number {
  if (!status?.active) return 0;
  const current = status.progress_current ?? 0;
  const total = Math.max(status.progress_total ?? 1, 1);
  const phase = status.phase ?? "discovery";
  if (phase === "discovery") return Math.min(45, Math.round((current / total) * 45));
  if (phase === "classify") return Math.min(98, 45 + Math.round((current / total) * 53));
  return 100;
}

function scanPhaseLabel(phase: string | null | undefined): string {
  switch (phase) {
    case "discovery":
      return "Buscando en Reddit";
    case "classify":
      return "Clasificando señales";
    case "done":
      return "Completado";
    case "error":
      return "Error";
    default:
      return "Escaneando";
  }
}

type ScanProgressPanelProps = {
  scanStatus?: PoseidonScanStatus;
  scanning?: boolean;
  className?: string;
};

export function ScanProgressPanel({ scanStatus, scanning, className }: ScanProgressPanelProps) {
  if (!scanning) return null;

  const progress = scanProgressPercent(scanStatus);

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-2",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-text">{scanPhaseLabel(scanStatus?.phase)}</span>
        <span className="font-mono text-xs tabular-nums text-text-muted">
          {scanStatus?.progress_current ?? 0}/{scanStatus?.progress_total ?? "?"}
        </span>
      </div>
      {scanStatus?.status_message && (
        <p className="text-xs text-text-muted">{scanStatus.status_message}</p>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-high">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
