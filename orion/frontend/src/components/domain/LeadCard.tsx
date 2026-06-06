import { Eye, Pencil, Trash2, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { StatusLED, type StatusLEDVariant } from "./StatusLED"
import type { Lead, LeadStatus } from "@/lib/api"

const statusToLED: Record<LeadStatus, StatusLEDVariant> = {
  new: "info",
  queued: "info",
  auditing: "info",
  audited: "success",
  enriched: "success",
  contacted: "success",
  interested: "success",
  negotiation: "warning",
  closed_won: "success",
  closed_lost: "danger",
  replied: "success",
  won: "success",
  rejected: "danger",
  error: "danger",
}

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}K`
  return String(Math.round(score))
}

function getInitials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export interface LeadCardProps {
  lead: Lead
  onView?: (lead: Lead) => void
  onEdit?: (lead: Lead) => void
  onDelete?: (lead: Lead) => void
  className?: string
}

function LeadCard({ lead, onView, onEdit, onDelete, className }: LeadCardProps) {
  const displayName = lead.company_name ?? lead.normalized_domain ?? lead.url
  const initials = getInitials(displayName)
  const statusText = lead.status.replace(/_/g, " ")
  const revenue = lead.revenue_signal

  return (
    <Card
      data-slot="lead-card"
      size="default"
      className={cn("hover:border-primary-container/40 transition-colors", className)}
    >
      <CardHeader className="flex-row items-start gap-3">
        <Avatar size="lg" className="bg-primary-container/20 ring-2 ring-primary-container/30">
          <AvatarFallback className="text-primary text-sm font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-headline font-medium text-text truncate">
            {displayName}
          </h3>
          <div className="flex items-center gap-2 mt-1 min-w-0">
            <StatusLED
              variant={statusToLED[lead.status] ?? "neutral"}
              size="sm"
              label={statusText}
              pulse={lead.status === "auditing"}
            />
            <span className="text-xs text-text-dim truncate inline-block min-w-0">
              {lead.normalized_domain && (
                <span className="inline-flex items-center gap-1">
                  <Globe className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{lead.normalized_domain}</span>
                </span>
              )}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <span className="block text-xs text-text-muted">Score</span>
              <span className="text-sm font-mono font-semibold tabular-nums text-text">
                {formatScore(lead.score ?? 0)}
              </span>
            </div>
            {revenue && (
              <div className="text-center">
                <span className="block text-xs text-text-muted">Revenue</span>
                <span className="text-sm font-mono font-semibold tabular-nums text-success">
                  {revenue}
                </span>
              </div>
            )}
            {lead.segment && (
              <div className="text-center">
                <span className="block text-xs text-text-muted">Segment</span>
                <span className={cn(
                  "text-sm font-mono font-semibold tabular-nums",
                  lead.segment === "A" && "text-success",
                  lead.segment === "B" && "text-info",
                  lead.segment === "C" && "text-warning",
                  lead.segment === "D" && "text-danger"
                )}>
                  {lead.segment}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(lead)}
                aria-label={`View ${displayName}`}
                className="h-7 w-7 p-0"
              >
                <Eye className="size-3.5" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(lead)}
                aria-label={`Edit ${displayName}`}
                className="h-7 w-7 p-0"
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(lead)}
                aria-label={`Delete ${displayName}`}
                className="h-7 w-7 p-0 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { LeadCard, statusToLED }
