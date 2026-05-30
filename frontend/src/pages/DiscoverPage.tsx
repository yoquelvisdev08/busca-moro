import { useState } from "react";
import toast from "react-hot-toast";
import { Search, Rocket, TrendingUp, Cpu, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useLeads } from "@/lib/hooks";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/charts/MetricCard";

const INDUSTRIES = [
  "Software Development",
  "Financial Services",
  "Healthcare Tech",
  "E-commerce",
  "Logistics",
  "Real Estate",
  "Education",
  "Marketing & Advertising",
];

const LOCATIONS = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Global",
];

export function DiscoverPage() {
  const navigate = useNavigate();
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(2500);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const { data: leadsData } = useLeads({ limit: 5 });

  const recentLeads = (leadsData?.items ?? []).slice(0, 5);

  const handleStartDiscovery = async () => {
    if (!industry.trim()) {
      toast.error("Please select an industry");
      return;
    }
    setIsDiscovering(true);
    try {
      const result = await api.startDiscovery({
        industry,
        location: location || undefined,
      });
      toast.success(
        `${result.dorks_generated} dorks generated. Discovery started.`
      );
    } catch (e) {
      toast.error(`Discovery failed: ${(e as Error).message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-headline font-semibold text-text">
          Discover
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Search and discover new leads
        </p>
      </div>

      {/* Target Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Search className="size-5" aria-hidden="true" />
            <h2 className="text-lg font-headline font-semibold text-text">
              Target Configuration
            </h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {/* Keywords */}
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Keywords
              </Label>
              <Input
                placeholder="e.g., SaaS, Fintech"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>

            {/* Industry Select */}
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Industry
              </Label>
              <Select value={industry} onValueChange={(v) => setIndustry(v ?? "")}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select industry..." />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Geography */}
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider">
                Geography
              </Label>
              <Select
                value={location || "__all__"}
                onValueChange={(v) => setLocation(v === "__all__" || !v ? "" : v)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All locations</SelectItem>
                  {LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleStartDiscovery}
            disabled={isDiscovering}
            className="w-full sm:w-auto"
          >
            <Rocket className="size-4 mr-1.5" aria-hidden="true" />
            {isDiscovering ? "Starting..." : "Start Discovery"}
            {isDiscovering ? "Starting..." : "Start Discovery"}
          </Button>

          {/* Max Results Slider */}
          <div className="pt-4 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] uppercase tracking-wider">
                Max Results
              </Label>
              <span className="text-sm font-mono font-bold text-primary">
                {maxResults.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={10000}
              step={100}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-full h-2 rounded-full bg-surface-high accent-primary-container cursor-pointer"
              aria-label={`Maximum results: ${maxResults.toLocaleString()} leads`}
            />
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted">
              <span>100 leads</span>
              <span>10,000 leads</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Discoveries */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <h2 className="text-base font-headline font-semibold text-text">
            Recent Discoveries
          </h2>
          <Button
            variant="link"
            size="sm"
            className="text-xs"
            onClick={() => navigate("/leads")}
          >
            View All →
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {recentLeads.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">
              No leads discovered yet. Start a discovery above.
            </p>
          ) : (
            <div className="space-y-1 min-w-[500px]">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center px-3 py-2.5 rounded-md hover:bg-surface-high/60 transition-colors border-b border-border-subtle last:border-b-0"
                >
                  <span className="text-sm font-mono text-primary font-medium truncate">
                    {lead.normalized_domain}
                  </span>
                  <span className="text-sm text-text truncate">
                    {lead.company_name || "—"}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted shrink-0">
                    {lead.discovered_at
                      ? new Date(lead.discovered_at).toLocaleDateString()
                      : "—"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Success Rate"
          value={94.2}
          formattedValue="94.2%"
          trend={{ direction: "up", value: 2.1 }}
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Active Crawlers"
          value={12}
          formattedValue="12"
          icon={<Cpu className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Leads Found (24h)"
          value={1800}
          formattedValue="1.8k"
          trend={{ direction: "up", value: 12.5 }}
          icon={<Users className="size-4" aria-hidden="true" />}
        />
      </div>
    </div>
  );
}
