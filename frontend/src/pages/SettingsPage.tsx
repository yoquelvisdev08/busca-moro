import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Key,
  Mail,
  Building,
  Shield,
  Copy,
  RefreshCw,
  Save,
} from "lucide-react";
import { useSenderProfile } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SECTION_ITEMS = [
  { key: "profile", label: "Agency Profile", icon: Building },
  { key: "email", label: "Email Config", icon: Mail },
  { key: "followups", label: "Follow-up Defaults", icon: Shield },
  { key: "apikeys", label: "API Keys", icon: Key },
] as const;

type SectionKey = (typeof SECTION_ITEMS)[number]["key"];

// ─── Zod Schemas ───

const agencyProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  website: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color"),
});

const emailSchema = z.object({
  resendKey: z.string().min(1, "Resend API key is required"),
  senderEmail: z.string().email("Must be a valid email"),
});

const followUpDefaultsSchema = z.object({
  step1Subject: z.string().min(1, "Subject is required"),
  step1Body: z.string().min(1, "Body is required"),
  step2Subject: z.string().min(1, "Subject is required"),
  step2Body: z.string().min(1, "Body is required"),
  step3Subject: z.string().min(1, "Subject is required"),
  step3Body: z.string().min(1, "Body is required"),
});

type AgencyProfileForm = z.infer<typeof agencyProfileSchema>;
type EmailForm = z.infer<typeof emailSchema>;
type FollowUpDefaultsForm = z.infer<typeof followUpDefaultsSchema>;

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const { data: senderProfile } = useSenderProfile();

  // ── Agency Profile Form ──
  const profileForm = useForm<AgencyProfileForm>({
    resolver: zodResolver(agencyProfileSchema),
    defaultValues: {
      companyName: senderProfile?.company ?? "",
      website: senderProfile?.website ?? "",
      primaryColor: "#8b5cf6",
    },
  });

  // ── Email Config Form ──
  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { resendKey: "", senderEmail: "" },
  });

  // ── Follow-up Defaults Form ──
  const followUpForm = useForm<FollowUpDefaultsForm>({
    resolver: zodResolver(followUpDefaultsSchema),
    defaultValues: {
      step1Subject: "Initial outreach proposal",
      step1Body:
        "Hi! I noticed your site and wanted to share some insights...",
      step2Subject: "Following up on our conversation",
      step2Body:
        "Just following up on my previous message. Let me know if you have questions.",
      step3Subject: "Last follow-up",
      step3Body:
        "One last follow-up. I'd love to discuss how we can help.",
    },
  });

  // ── API Keys State ──
  const [deepseekKey, setDeepseekKey] = useState("");
  const [braveKey, setBraveKey] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");

  const handleSave = (section: string) => {
    toast.success(`${section} settings saved`);
  };

  const apiKeys = [
    { name: "DeepSeek", key: deepseekKey, setter: setDeepseekKey, status: "Active" as const },
    { name: "Brave Search", key: braveKey, setter: setBraveKey, status: "Pending" as const },
    { name: "Resend", key: resendApiKey, setter: setResendApiKey, status: senderProfile ? ("Active" as const) : ("Pending" as const) },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto p-4 md:p-6">
      <div>
        <h1 className="text-xl font-headline font-semibold text-text">
          Settings
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Configure your agency platform settings
        </p>
      </div>

      {/* Mobile: horizontal section tabs */}
      <nav className="md:hidden flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {SECTION_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0",
              activeSection === key
                ? "bg-primary-container/10 text-primary-container"
                : "text-text-muted hover:text-text-secondary bg-surface border border-border"
            )}
          >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
          </button>
        ))}
      </nav>

      {/* Desktop: side nav + content */}
      <div className="hidden md:grid grid-cols-[180px_1fr] gap-6 min-h-[60vh]">
        <nav className="flex flex-col gap-1 rounded-lg bg-surface border border-border p-2 h-fit">
          {SECTION_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold transition-all duration-150 text-left",
                activeSection === key
                  ? "bg-primary-container/10 text-primary-container border-l-2 border-primary-container"
                  : "text-text-muted hover:text-text-secondary border-l-2 border-transparent"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex flex-col gap-4">
          {/* ── Agency Profile ── */}
          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Building className="size-[18px]" aria-hidden="true" />
                  <h2 className="text-base font-headline font-semibold text-text">
                    Agency Profile
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={profileForm.handleSubmit(() =>
                    handleSave("Profile")
                  )}
                  className="flex flex-col gap-4"
                >
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">
                      Company Name
                    </Label>
                    <Input
                      placeholder="Your Agency"
                      {...profileForm.register("companyName")}
                    />
                    {profileForm.formState.errors.companyName && (
                      <p className="text-xs text-danger">
                        {profileForm.formState.errors.companyName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">
                      Website
                    </Label>
                    <Input
                      placeholder="https://your-agency.com"
                      {...profileForm.register("website")}
                    />
                    {profileForm.formState.errors.website && (
                      <p className="text-xs text-danger">
                        {profileForm.formState.errors.website.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">
                      Primary Color
                    </Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        {...profileForm.register("primaryColor")}
                        className="size-9 border border-border rounded cursor-pointer bg-transparent"
                      />
                      <Input
                        className="font-mono flex-1"
                        {...profileForm.register("primaryColor")}
                      />
                    </div>
                  </div>

                  <Button type="submit" size="sm" className="self-start">
                    <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save Profile
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Email Configuration ── */}
          {activeSection === "email" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="size-[18px]" aria-hidden="true" />
                  <h2 className="text-base font-headline font-semibold text-text">
                    Email Configuration
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={emailForm.handleSubmit(() =>
                    handleSave("Email")
                  )}
                  className="flex flex-col gap-4"
                >
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">
                      Resend API Key
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="re_••••••••••••••••"
                        className="font-mono flex-1"
                        {...emailForm.register("resendKey")}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        aria-label="Copy Resend API key"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            emailForm.getValues("resendKey")
                          )
                        }
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                    {emailForm.formState.errors.resendKey && (
                      <p className="text-xs text-danger">
                        {emailForm.formState.errors.resendKey.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">
                      Sender Email
                    </Label>
                    <Input
                      placeholder="outreach@your-agency.com"
                      {...emailForm.register("senderEmail")}
                    />
                    {emailForm.formState.errors.senderEmail && (
                      <p className="text-xs text-danger">
                        {emailForm.formState.errors.senderEmail.message}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button type="submit" size="sm">
                      <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save Email Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => toast.success("Test email sent")}
                    >
                      <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" /> Test Email
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Follow-up Defaults ── */}
          {activeSection === "followups" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Shield className="size-[18px]" aria-hidden="true" />
                  <h2 className="text-base font-headline font-semibold text-text">
                    Follow-up Defaults
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={followUpForm.handleSubmit(() =>
                    handleSave("Follow-up Defaults")
                  )}
                  className="flex flex-col gap-4"
                >
                  <p className="text-xs text-text-secondary">
                    Configure default follow-up sequence steps. These are applied
                    when scheduling follow-ups from lead detail pages.
                  </p>

                  {[0, 3, 7].map((day, i) => (
                    <div
                      key={day}
                      className="rounded-lg bg-bg border border-border p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">Step {i + 1}</Badge>
                        <span className="text-xs font-mono text-text-muted">
                          Day {day}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider">
                          Subject
                        </Label>
                        <Input
                          {...followUpForm.register(
                            `step${i + 1}Subject` as keyof FollowUpDefaultsForm
                          )}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider">
                          Body Template
                        </Label>
                        <Textarea
                          rows={3}
                          {...followUpForm.register(
                            `step${i + 1}Body` as keyof FollowUpDefaultsForm
                          )}
                        />
                      </div>
                    </div>
                  ))}

                  <Button type="submit" size="sm" className="self-start">
                    <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save Follow-up Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── API Keys ── */}
          {activeSection === "apikeys" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Key className="size-[18px]" aria-hidden="true" />
                  <h2 className="text-base font-headline font-semibold text-text">
                    API Keys
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {apiKeys.map((api) => (
                    <div
                      key={api.name}
                      className="rounded-lg bg-bg border border-border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text">
                          {api.name}
                        </span>
                        <Badge
                          variant={
                            api.status === "Active" ? "default" : "secondary"
                          }
                        >
                          {api.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder={`${api.name.toLowerCase()}_api_key`}
                          className="font-mono text-xs flex-1 h-8"
                          value={api.key}
                          onChange={(e) => api.setter(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Copy ${api.name} API key`}
                          onClick={() =>
                            navigator.clipboard.writeText(api.key)
                          }
                        >
                        <Copy className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button
                    size="sm"
                    className="self-start"
                    onClick={() => handleSave("API Keys")}
                  >
                    <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save API Keys
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile content area */}
      <div className="md:hidden flex flex-col gap-4">
        {activeSection === "profile" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Building className="size-[18px]" aria-hidden="true" />
                <h2 className="text-base font-headline font-semibold text-text">
                  Agency Profile
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={profileForm.handleSubmit(() => handleSave("Profile"))}
                className="flex flex-col gap-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider">Company Name</Label>
                  <Input placeholder="Your Agency" {...profileForm.register("companyName")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider">Website</Label>
                  <Input placeholder="https://your-agency.com" {...profileForm.register("website")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider">Primary Color</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" {...profileForm.register("primaryColor")} className="size-9 border border-border rounded cursor-pointer bg-transparent" />
                    <Input className="font-mono flex-1" {...profileForm.register("primaryColor")} />
                  </div>
                </div>
                <Button type="submit" size="sm" className="self-start">
                  <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        {activeSection === "email" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Mail className="size-[18px]" aria-hidden="true" />
                <h2 className="text-base font-headline font-semibold text-text">Email Configuration</h2>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={emailForm.handleSubmit(() => handleSave("Email"))} className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider">Resend API Key</Label>
                  <Input type="password" placeholder="re_••••••••••••••••" className="font-mono" {...emailForm.register("resendKey")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider">Sender Email</Label>
                  <Input placeholder="outreach@your-agency.com" {...emailForm.register("senderEmail")} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button type="submit" size="sm"><Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save Email</Button>
                  <Button variant="outline" size="sm" type="button" onClick={() => toast.success("Test email sent")}>
                    <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" /> Test Email
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {activeSection === "followups" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Shield className="size-[18px]" aria-hidden="true" />
                <h2 className="text-base font-headline font-semibold text-text">Follow-up Defaults</h2>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={followUpForm.handleSubmit(() => handleSave("Follow-up Defaults"))} className="flex flex-col gap-4">
                <p className="text-xs text-text-secondary">Configure default follow-up sequence steps.</p>
                {[0, 3, 7].map((day, i) => (
                  <div key={day} className="rounded-lg bg-bg border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Step {i + 1}</Badge>
                      <span className="text-xs font-mono text-text-muted">Day {day}</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider">Subject</Label>
                      <Input {...followUpForm.register(`step${i + 1}Subject` as keyof FollowUpDefaultsForm)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider">Body Template</Label>
                      <Textarea rows={3} {...followUpForm.register(`step${i + 1}Body` as keyof FollowUpDefaultsForm)} />
                    </div>
                  </div>
                ))}
                <Button type="submit" size="sm" className="self-start">
                  <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save Follow-up Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        {activeSection === "apikeys" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Key className="size-[18px]" aria-hidden="true" />
                <h2 className="text-base font-headline font-semibold text-text">API Keys</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {apiKeys.map((api) => (
                  <div key={api.name} className="rounded-lg bg-bg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text">{api.name}</span>
                      <Badge variant={api.status === "Active" ? "default" : "secondary"}>{api.status}</Badge>
                    </div>
                    <Input type="password" placeholder={`${api.name.toLowerCase()}_api_key`} className="font-mono text-xs h-8" value={api.key} onChange={(e) => api.setter(e.target.value)} />
                  </div>
                ))}
                <Button size="sm" className="self-start" onClick={() => handleSave("API Keys")}>
                  <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Save API Keys
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
