import { useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Download,
  Mail,
  Trash2,
  Search,
} from "lucide-react";
import {
  useReports,
  useResendReportMutation,
  useDeleteReportMutation,
} from "@/lib/hooks";
import { Card } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { Modal } from "@/design-system/components/Modal";
import { Spinner } from "@/design-system/components/Spinner";
import { EmptyState } from "@/design-system/components/EmptyState";
import { colors } from "@/design-system/tokens";

export function ReportsPage() {
  const [leadIdFilter, setLeadIdFilter] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);

  const { data, isLoading, error } = useReports({
    limit: pageSize,
    offset: page * pageSize,
    ...(leadIdFilter ? { lead_id: leadIdFilter } : {}),
  });

  const resendReport = useResendReportMutation();
  const deleteReport = useDeleteReportMutation();

  const reports = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleResend = (reportId: string) => {
    toast.promise(resendReport.mutateAsync(reportId), {
      loading: "Resending report...",
      success: "Report queued for resend",
      error: "Failed to resend report",
    });
  };

  const handleDelete = () => {
    if (!deleteTargetId) return;
    toast.promise(deleteReport.mutateAsync(deleteTargetId), {
      loading: "Deleting report...",
      success: "Report deleted",
      error: "Failed to delete report",
    });
    setDeleteModalOpen(false);
    setDeleteTargetId(null);
  };

  const downloadUrl = (id: string) => `/api/v1/reports/${id}/download`;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>Reports</h1>
          <p style={{ fontSize: "13px", color: colors.textMuted }}>Generated PDF reports and delivery management</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: colors.textMuted, pointerEvents: "none" }}
          />
          <input
            type="text"
            placeholder="Filter by lead ID..."
            value={leadIdFilter}
            onChange={(e) => { setLeadIdFilter(e.target.value); setPage(0); }}
            style={{
              width: "100%",
              padding: "10px 14px 10px 38px",
              background: colors.surface,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: "8px",
              fontSize: "13px",
              color: colors.text,
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <Spinner style={{ padding: "60px" }} />
      ) : error ? (
        <div style={{ padding: "32px", color: colors.danger, textAlign: "center" }}>
          Error loading reports: {(error as Error).message}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports found"
          description={leadIdFilter ? "Try a different lead ID filter" : "Generate reports from lead detail pages"}
          icon={<FileText size={48} />}
        />
      ) : (
        <Card padding="0" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: colors.bg }}>
                  {["Lead", "Generated", "Size", "Status", "Sent", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", borderBottom: `1px solid ${colors.border}`, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    style={{ borderBottom: `1px solid ${colors.border}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHigh)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FileText size={16} style={{ color: colors.primary, opacity: 0.6 }} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>
                            {report.lead_domain || report.lead_id.slice(0, 8)}
                          </div>
                          {report.lead_company_name && (
                            <div style={{ fontSize: "11px", color: colors.textMuted }}>{report.lead_company_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted }}>
                      {report.generated_at ? new Date(report.generated_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted }}>
                      {(report.file_size / 1024).toFixed(0)} KB
                    </td>
                    <td style={tdStyle}>
                      <Badge variant={report.status === "completed" ? "success" : report.status === "failed" ? "danger" : "warning"} dot>
                        {report.status}
                      </Badge>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.textMuted, textAlign: "center" }}>
                      {report.sent_count}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
                        <a href={downloadUrl(report.id)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="secondary" title="Download PDF"><Download size={14} /></Button>
                        </a>
                        <Button size="sm" variant="secondary" onClick={() => handleResend(report.id)} title="Resend email" disabled={resendReport.isPending}>
                          <Mail size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => { setDeleteTargetId(report.id); setDeleteModalOpen(true); }}
                          title="Delete report"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", padding: "12px", borderTop: `1px solid ${colors.border}`, background: colors.bg }}>
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: colors.primaryContainer }}>
              Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <Button size="sm" variant="ghost" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Report"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p style={{ color: colors.text, margin: 0 }}>
          This will permanently delete the report and its PDF file. This action cannot be undone.
        </p>
      </Modal>
    </section>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: colors.text,
};
