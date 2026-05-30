import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, BarChart3 } from "lucide-react";
import {
  useCampaigns,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  type Campaign,
} from "@/lib/hooks";
import { CampaignCard } from "@/components/domain/CampaignCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function CampaignsPage() {
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaignMutation();
  const updateCampaign = useUpdateCampaignMutation();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSegment, setNewSegment] = useState("");

  const items = campaigns ?? [];

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCampaign.mutate(
      {
        name: newName.trim(),
        status: "paused",
        lead_count: 0,
        sent_count: 0,
        opened_count: 0,
        replied_count: 0,
        bounced_count: 0,
      },
      {
        onSuccess: () => {
          toast.success("Campaign created");
          setCreateDialogOpen(false);
          setNewName("");
          setNewSegment("");
        },
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      }
    );
  };

  const handlePause = (campaign: Campaign) => {
    updateCampaign.mutate(
      { id: campaign.id, data: { status: "paused" } },
      {
        onSuccess: () => toast.success("Campaign paused"),
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      }
    );
  };

  const handleResume = (campaign: Campaign) => {
    updateCampaign.mutate(
      { id: campaign.id, data: { status: "active" } },
      {
        onSuccess: () => toast.success("Campaign resumed"),
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      }
    );
  };

  const activeCount = items.filter((c) => c.status === "active").length;
  const completedCount = items.filter((c) => c.status === "completed").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-headline font-semibold text-text">
            Campaigns
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Create and manage outreach campaigns
            {items.length > 0 && (
              <span className="ml-3">
                <span className="text-success">● {activeCount} Active</span>
                <span className="text-text-dim ml-2">
                  ○ {completedCount} Completed
                </span>
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} aria-label="Create new campaign">
          <Plus className="size-4 mr-1.5" aria-hidden="true" /> New Campaign
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[240px] rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <BarChart3 className="size-12 text-text-dim" aria-hidden="true" />
          <div>
            <h3 className="text-base font-headline font-medium text-text">
              No campaigns yet
            </h3>
            <p className="text-sm text-text-muted mt-1">
              Create your first outreach campaign to start contacting leads.
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4 mr-1.5" aria-hidden="true" /> Create Campaign
          </Button>
        </div>
      )}

      {/* Campaign Grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((campaign) => (
            <div key={campaign.id} className="relative">
              <CampaignCard
                campaign={campaign}
                onPause={handlePause}
                onResume={handleResume}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Set up a new outreach campaign. You can add leads and configure
              follow-ups after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Campaign Name
              </Label>
              <Input
                placeholder="e.g., Q2 Enterprise Outreach"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Target Segment (optional)
              </Label>
              <Select
                value={newSegment || "__all__"}
                onValueChange={(v) => setNewSegment(v === "__all__" ? "" : v ?? "")}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="All segments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All segments</SelectItem>
                  <SelectItem value="A">Segment A</SelectItem>
                  <SelectItem value="B">Segment B</SelectItem>
                  <SelectItem value="C">Segment C</SelectItem>
                  <SelectItem value="D">Segment D</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createCampaign.isPending}
            >
              <Plus className="size-4 mr-1.5" aria-hidden="true" />
              {createCampaign.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
