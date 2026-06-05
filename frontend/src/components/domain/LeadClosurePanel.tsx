import { useState } from "react";
import { AlertTriangle, Calendar, Phone, FileText, Ban } from "lucide-react";
import { notify } from "@/lib/notify";
import { useSetLeadNextStepMutation } from "@/lib/hooks";
import type { Lead } from "@/lib/api";
import {
  LEAD_NEXT_STEP_OPTIONS,
  NEXT_STEP_LABELS,
  type LeadNextStepType,
} from "@/lib/lead-next-step";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeadClosurePanelProps {
  lead: Lead;
  className?: string;
}

export function LeadClosurePanel({ lead, className }: LeadClosurePanelProps) {
  const setNextStep = useSetLeadNextStepMutation();
  const [selected, setSelected] = useState<LeadNextStepType | "">("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");

  const needsAction = lead.needs_next_step ?? false;
  const hasStep = Boolean(lead.next_step_type);

  const handleSubmit = () => {
    if (!selected) return;
    notify.promise(
      setNextStep.mutateAsync({
        id: lead.id,
        step: selected,
        scheduled_at: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
        notes: notes.trim() || undefined,
        close_as_lost: selected === "discard",
      }),
      {
        loading: "Guardando siguiente paso...",
        success: "Siguiente paso registrado",
        error: (err) =>
          err instanceof Error ? err.message : "No se pudo guardar",
      },
    );
    setSelected("");
    setScheduledAt("");
    setNotes("");
  };

  return (
    <Card
      className={cn(
        needsAction ? "border-warning/50 bg-warning/5" : "border-border",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
          {needsAction ? (
            <AlertTriangle className="size-4 text-warning" aria-hidden />
          ) : null}
          Siguiente paso comercial
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {needsAction && (
          <p className="text-sm text-text-secondary">
            Este lead fue contactado y necesita un siguiente paso:{" "}
            <strong>llamada</strong>, <strong>propuesta</strong> o{" "}
            <strong>descarte</strong>.
          </p>
        )}

        {hasStep && lead.next_step_type && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="default">
              {NEXT_STEP_LABELS[lead.next_step_type as LeadNextStepType] ??
                lead.next_step_type}
            </Badge>
            {lead.next_step_at && (
              <span className="text-text-muted font-mono text-xs">
                {new Date(lead.next_step_at).toLocaleString("es-ES")}
              </span>
            )}
            {lead.next_step_notes && (
              <p className="w-full text-xs text-text-secondary mt-1">
                {lead.next_step_notes}
              </p>
            )}
          </div>
        )}

        {needsAction && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {LEAD_NEXT_STEP_OPTIONS.map((opt) => {
              const Icon =
                opt.value === "call"
                  ? Phone
                  : opt.value === "proposal"
                    ? FileText
                    : Ban;
              const active = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelected(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <Icon className="size-4 text-primary" aria-hidden />
                  <span className="text-sm font-medium text-text">
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {needsAction && selected && selected !== "discard" && (
          <div className="space-y-1.5">
            <Label htmlFor="next-step-date" className="flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden />
              Fecha prevista
            </Label>
            <Input
              id="next-step-date"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        )}

        {needsAction && selected && (
          <div className="space-y-1.5">
            <Label htmlFor="next-step-notes">Notas</Label>
            <Textarea
              id="next-step-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                selected === "call"
                  ? "Ej. llamada martes 10:00, interesado en rendimiento"
                  : selected === "proposal"
                    ? "Ej. propuesta 2.400 EUR enviada por email"
                    : "Motivo del descarte"
              }
            />
          </div>
        )}

        {needsAction && (
          <Button
            onClick={handleSubmit}
            disabled={!selected || setNextStep.isPending}
          >
            Confirmar siguiente paso
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
