import { useState, useMemo } from "react";
import { notify } from "@/lib/notify";
import { FileText, Download, Mail, Trash2, Eye } from "lucide-react";
import {
  useReports,
  useResendReportMutation,
  useDeleteReportMutation,
} from "@/lib/hooks";
import { api, type ReportRead } from "@/lib/api";
import { DataTable } from "@/components/tables/DataTable";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportPdfPreviewDialog } from "@/components/domain/ReportPdfPreviewDialog";

export function ReportsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);

  const { data, isLoading, error } = useReports({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });

  const resendReport = useResendReportMutation();
  const deleteReport = useDeleteReportMutation();

  const reports = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  const handleResend = (reportId: string) => {
    notify.promise(resendReport.mutateAsync(reportId), {
      loading: "Resending report...",
      success: "Report queued for resend",
      error: "Failed to resend report",
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTargetId) return;
    notify.promise(deleteReport.mutateAsync(deleteTargetId), {
      loading: "Deleting report...",
      success: "Report deleted",
      error: "Failed to delete report",
    });
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  const downloadUrl = (id: string) => api.getReportDownloadUrl(id);

  const columns = useMemo<ColumnDef<ReportRead, unknown>[]>(
    () => [
      {
        id: "lead",
        header: "Lead",
        accessorFn: (row) => row.lead_domain ?? row.lead_id,
        cell: ({ row }) => {
          const report = row.original;
          return (
            <div className="flex items-center gap-2 max-w-[240px]">
                <FileText className="size-4 text-primary opacity-60 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-text truncate">
                  {report.lead_domain || report.lead_id.slice(0, 8)}
                </div>
                {report.lead_company_name && (
                  <div className="text-[11px] text-text-muted truncate">
                    {report.lead_company_name}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "generated_at",
        header: "Generated",
        accessorFn: (row) => row.generated_at ?? "",
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return (
            <span className="text-xs font-mono text-text-muted">
              {val ? new Date(val).toLocaleDateString() : "—"}
            </span>
          );
        },
      },
      {
        id: "file_size",
        header: "Size",
        accessorFn: (row) => row.file_size,
        cell: ({ getValue }) => {
          const size = getValue() as number;
          return (
            <span className="text-xs font-mono text-text-muted">
              {(size / 1024).toFixed(0)} KB
            </span>
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
          <span className="text-xs font-mono text-text-muted text-center block">
            {String(getValue())}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const report = row.original;
          const ready = report.status === "completed";
          return (
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!ready}
                aria-label="Vista previa del PDF"
                onClick={() => setPreviewReportId(report.id)}
              >
                <Eye className="size-3.5" aria-hidden="true" />
              </Button>
              {ready ? (
                <a
                  href={downloadUrl(report.id)}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleResend(report.id)}
                disabled={resendReport.isPending}
                aria-label="Resend report"
              >
                  <Mail className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:text-danger"
                aria-label="Delete report"
                onClick={() => {
                  setDeleteTargetId(report.id);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resendReport.isPending]
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-headline font-semibold text-text">
            Reports
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Generated PDF reports and delivery management
          </p>
        </div>
      </div>

      <ReportPdfPreviewDialog
        reportId={previewReportId}
        open={previewReportId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewReportId(null);
        }}
      />

      <DataTable<ReportRead>
        data={reports}
        columns={columns}
        loading={isLoading}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Filter reports...",
        }}
        density="compact"
        getRowId={(row) => row.id}
      />

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
          Error loading reports: {(error as Error).message}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              This will permanently delete the report and its PDF file. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteReport.isPending}
            >
              <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
