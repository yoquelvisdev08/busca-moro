import { useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  MoreVertical,
  Play,
  Pause,
  XCircle,
  BarChart3,
} from "lucide-react";
import {
  useCampaigns,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  type Campaign,
} from "@/lib/hooks";
import { Card } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Select } from "@/design-system/components/Select";
import { Modal } from "@/design-system/components/Modal";
import { Spinner } from "@/design-system/components/Spinner";
import { EmptyState } from "@/design-system/components/EmptyState";
import { colors } from "@/design-system/tokens";

export function CampaignsPage() {
  const { data: campaigns, isLoading } = useCampaigns();
  const createCampaign = useCreateCampaignMutation();
  const updateCampaign = useUpdateCampaignMutation();

  const [createModalOpen, setCreateModalOpen] = useState(false);
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
          setCreateModalOpen(false);
          setNewName("");
          setNewSegment("");
        },
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      },
    );
  };

  const handleStatusChange = (id: string, status: Campaign["status"]) => {
    updateCampaign.mutate(
      { id, data: { status } },
      {
        onSuccess: () => toast.success(`Campaign ${status}`),
        onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
      },
    );
  };

  const statusBadgeVariant = (status: Campaign["status"]): "success" | "warning" | "neutral" => {
    return status === "active" ? "success" : status === "paused" ? "warning" : "neutral";
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>Campaigns</h1>
          <p style={{ fontSize: "13px", color: colors.textMuted }}>Create and manage outreach campaigns</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} /> New Campaign
        </Button>
      </div>

      {isLoading ? (
        <Spinner style={{ padding: "60px" }} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first outreach campaign to start contacting leads."
          icon={<BarChart3 size={48} />}
          actionLabel="Create Campaign"
          onAction={() => setCreateModalOpen(true)}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {items.map((campaign) => (
            <Card key={campaign.id} hover padding="20px">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>{campaign.name}</h3>
                  <Badge variant={statusBadgeVariant(campaign.status)} dot>
                    {campaign.status}
                  </Badge>
                </div>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = colors.primary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
                >
                  <MoreVertical size={18} />
                </button>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, marginBottom: "4px" }}>
                    Leads
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.text }}>
                    {campaign.lead_count}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, marginBottom: "4px" }}>
                    Sent
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.text }}>
                    {campaign.sent_count}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, marginBottom: "4px" }}>
                    Opened
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.success }}>
                    {campaign.opened_count}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, marginBottom: "4px" }}>
                    Replied
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "var(--font-mono)", color: colors.primary }}>
                    {campaign.replied_count}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: "4px", borderRadius: "2px", background: colors.surfaceHigh, marginBottom: "16px" }}>
                {campaign.sent_count > 0 && (
                  <div
                    style={{
                      height: "100%",
                      borderRadius: "2px",
                      background: colors.primaryContainer,
                      width: `${Math.min(100, (campaign.opened_count / Math.max(1, campaign.sent_count)) * 100)}%`,
                      transition: "width 300ms",
                    }}
                  />
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px" }}>
                {campaign.status === "paused" && (
                  <Button size="sm" variant="primary" onClick={() => handleStatusChange(campaign.id, "active")}>
                    <Play size={14} /> Start
                  </Button>
                )}
                {campaign.status === "active" && (
                  <Button size="sm" variant="warning" onClick={() => handleStatusChange(campaign.id, "paused")}>
                    <Pause size={14} /> Pause
                  </Button>
                )}
                {campaign.status !== "completed" && (
                  <Button size="sm" variant="danger" onClick={() => handleStatusChange(campaign.id, "completed")}>
                    <XCircle size={14} /> Complete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Campaign"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()} loading={createCampaign.isPending}>
              <Plus size={14} /> Create Campaign
            </Button>
          </>
        }
      >
        <Input
          label="Campaign Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g., Q2 Enterprise Outreach"
        />
        <Select
          label="Target Segment (optional)"
          options={[
            { value: "", label: "All segments" },
            { value: "A", label: "Segment A" },
            { value: "B", label: "Segment B" },
            { value: "C", label: "Segment C" },
            { value: "D", label: "Segment D" },
          ]}
          value={newSegment}
          onChange={setNewSegment}
        />
      </Modal>
    </section>
  );
}
