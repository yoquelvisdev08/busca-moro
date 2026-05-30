import { Pause, Play, Pencil, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusLED, type StatusLEDVariant } from "./StatusLED"
import type { Campaign } from "@/lib/hooks"

const campaignStatusLED: Record<Campaign["status"], StatusLEDVariant> = {
  active: "success",
  paused: "warning",
  completed: "info",
}

function formatCount(n: number): string {
  return n.toLocaleString()
}

function openRate(sent: number, opened: number): string {
  if (sent === 0) return "0%"
  return `${((opened / sent) * 100).toFixed(1)}%`
}

function progressPercent(sent: number, leadCount: number): number {
  if (leadCount === 0) return 0
  return Math.min(100, Math.round((sent / leadCount) * 100))
}

export interface CampaignCardProps {
  campaign: Campaign
  onPause?: (campaign: Campaign) => void
  onResume?: (campaign: Campaign) => void
  onEdit?: (campaign: Campaign) => void
  onView?: (campaign: Campaign) => void
  className?: string
}

function CampaignCard({
  campaign,
  onPause,
  onResume,
  onEdit,
  onView,
  className,
}: CampaignCardProps) {
  const progress = progressPercent(campaign.sent_count, campaign.lead_count)

  return (
    <Card
      data-slot="campaign-card"
      size="default"
      className={cn("hover:border-primary-container/40 transition-colors", className)}
    >
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-headline font-medium text-text truncate">
            {campaign.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <StatusLED
              variant={campaignStatusLED[campaign.status]}
              size="sm"
              label={campaign.status}
            />
            <span className="text-xs text-text-dim">
              Created {new Date(campaign.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {campaign.status === "active" && onPause && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPause(campaign)}
              aria-label={`Pause ${campaign.name}`}
              className="h-7 w-7 p-0"
            >
              <Pause className="size-3.5" />
            </Button>
          )}
          {campaign.status === "paused" && onResume && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResume(campaign)}
              aria-label={`Resume ${campaign.name}`}
              className="h-7 w-7 p-0"
            >
              <Play className="size-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(campaign)}
              aria-label={`Edit ${campaign.name}`}
              className="h-7 w-7 p-0"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(campaign)}
              aria-label={`View ${campaign.name} details`}
              className="h-7 w-7 p-0"
            >
              <Eye className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Metrics row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="block text-xs text-text-muted">Leads</span>
                <span className="text-sm font-mono font-semibold tabular-nums text-text">
                  {formatCount(campaign.lead_count)}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-xs text-text-muted">Sent</span>
                <span className="text-sm font-mono font-semibold tabular-nums text-text">
                  {formatCount(campaign.sent_count)}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-xs text-text-muted">Open Rate</span>
                <span className="text-sm font-mono font-semibold tabular-nums text-info">
                  {openRate(campaign.sent_count, campaign.opened_count)}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-text-muted">
              <span>Progress</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-highest overflow-hidden">
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Campaign progress"
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  campaign.status === "active" && "bg-primary-container",
                  campaign.status === "paused" && "bg-warning",
                  campaign.status === "completed" && "bg-success"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { CampaignCard }
