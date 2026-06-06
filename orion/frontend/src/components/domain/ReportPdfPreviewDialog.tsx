import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Download, ExternalLink } from "lucide-react";

interface ReportPdfPreviewDialogProps {
  reportId: string | null;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportPdfPreviewDialog({
  reportId,
  title = "Vista previa del informe",
  open,
  onOpenChange,
}: ReportPdfPreviewDialogProps) {
  const previewUrl = reportId ? api.getReportPreviewUrl(reportId) : "";
  const downloadUrl = reportId ? api.getReportDownloadUrl(reportId) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl w-[calc(100%-1rem)] h-[min(90vh,820px)] flex flex-col gap-3 p-4"
        showCloseButton
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Revisa el PDF antes de enviarlo. No hace falta descargarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 shrink-0 flex-wrap">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ExternalLink className="size-3.5 mr-1.5" aria-hidden="true" />
            Abrir en pestaña
          </a>
          <a
            href={downloadUrl}
            download
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="size-3.5 mr-1.5" aria-hidden="true" />
            Descargar
          </a>
        </div>

        {reportId ? (
          <iframe
            src={previewUrl}
            title={title}
            className="flex-1 min-h-[60vh] w-full rounded-lg border border-border bg-bg"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
