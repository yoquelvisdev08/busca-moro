import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { notify } from "@/lib/notify";
import {
  Key,
  Mail,
  Building,
  Shield,
  Copy,
  RefreshCw,
  Save,
  type LucideIcon,
} from "lucide-react";
import { useSenderProfile } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

const SECTION_ITEMS = [
  { key: "profile", label: "Perfil", icon: Building },
  { key: "email", label: "Email", icon: Mail },
  { key: "followups", label: "Seguimientos", icon: Shield },
  { key: "apikeys", label: "API Keys", icon: Key },
] as const;

type SectionKey = (typeof SECTION_ITEMS)[number]["key"];

const agencyProfileSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  company: z.string().optional(),
  website: z.union([z.literal(""), z.string().url("URL inválida")]),
  title: z.string().optional(),
  emailSignature: z.string().optional(),
});

const emailSchema = z.object({
  resendKey: z.string().optional(),
  senderEmail: z.union([z.literal(""), z.string().email("Email inválido")]),
});

const followUpDefaultsSchema = z.object({
  step1Subject: z.string().min(1, "Asunto obligatorio"),
  step1Body: z.string().min(1, "Cuerpo obligatorio"),
  step2Subject: z.string().min(1, "Asunto obligatorio"),
  step2Body: z.string().min(1, "Cuerpo obligatorio"),
  step3Subject: z.string().min(1, "Asunto obligatorio"),
  step3Body: z.string().min(1, "Cuerpo obligatorio"),
});

type AgencyProfileForm = z.infer<typeof agencyProfileSchema>;
type EmailForm = z.infer<typeof emailSchema>;
type FollowUpDefaultsForm = z.infer<typeof followUpDefaultsSchema>;

function SectionNav({
  activeSection,
  onSelect,
  className,
}: {
  activeSection: SectionKey;
  onSelect: (key: SectionKey) => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex gap-1", className)} aria-label="Secciones de configuración">
      {SECTION_ITEMS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold transition-all duration-150 text-left",
            activeSection === key
              ? "bg-primary-container/10 text-primary-container border-l-2 border-primary-container"
              : "text-text-muted hover:text-text-secondary border-l-2 border-transparent bg-surface border border-border md:border-0 md:bg-transparent",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">{label}</span>
        </button>
      ))}
    </nav>
  );
}

function PanelHeader({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-primary">
      <Icon className="size-[18px]" aria-hidden="true" />
      <h2 className="text-base font-headline font-semibold text-text">{title}</h2>
    </div>
  );
}

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const { data: senderProfile, isLoading: profileLoading } = useSenderProfile();

  const profileForm = useForm<AgencyProfileForm>({
    resolver: zodResolver(agencyProfileSchema),
    defaultValues: {
      name: "",
      company: "",
      website: "",
      title: "",
      emailSignature: "",
    },
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { resendKey: "", senderEmail: "" },
  });

  const followUpForm = useForm<FollowUpDefaultsForm>({
    resolver: zodResolver(followUpDefaultsSchema),
    defaultValues: {
      step1Subject: "Propuesta inicial",
      step1Body: "Hola, revisé tu sitio y quiero compartirte algunas ideas...",
      step2Subject: "Seguimiento",
      step2Body: "Te escribo de nuevo por si tienes dudas sobre mi mensaje anterior.",
      step3Subject: "Último seguimiento",
      step3Body: "Un último mensaje; me encantaría conversar contigo.",
    },
  });

  useEffect(() => {
    if (!senderProfile) return;
    profileForm.reset({
      name: senderProfile.name ?? "",
      company: senderProfile.company ?? "",
      website: senderProfile.website ?? "",
      title: senderProfile.title ?? "",
      emailSignature: senderProfile.email_signature ?? "",
    });
  }, [senderProfile, profileForm]);

  const [deepseekKey, setDeepseekKey] = useState("");
  const [braveKey, setBraveKey] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");

  const handleSave = (section: string) => {
    notify.success(`Ajustes de ${section} guardados`);
  };

  const apiKeys = [
    { name: "DeepSeek", key: deepseekKey, setter: setDeepseekKey, status: "Active" as const },
    { name: "Brave Search", key: braveKey, setter: setBraveKey, status: "Pending" as const },
    {
      name: "Resend",
      key: resendApiKey,
      setter: setResendApiKey,
      status: senderProfile ? ("Active" as const) : ("Pending" as const),
    },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <Card>
            <CardHeader>
              <PanelHeader icon={Building} title="Perfil del consultor" />
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <p className="text-sm text-text-muted">Cargando perfil...</p>
              ) : (
                <form
                  onSubmit={profileForm.handleSubmit(() => handleSave("perfil"))}
                  className="flex flex-col gap-4"
                >
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">Tu nombre</Label>
                    <Input placeholder="Yoquelvis ..." {...profileForm.register("name")} />
                    {profileForm.formState.errors.name && (
                      <p className="text-xs text-danger">{profileForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">Empresa / marca</Label>
                    <Input placeholder="Tu agencia" {...profileForm.register("company")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">Cargo</Label>
                    <Input placeholder="Consultor web" {...profileForm.register("title")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">Sitio web</Label>
                    <Input placeholder="https://tu-sitio.com" {...profileForm.register("website")} />
                    {profileForm.formState.errors.website && (
                      <p className="text-xs text-danger">{profileForm.formState.errors.website.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider">Firma de email</Label>
                    <Textarea rows={3} {...profileForm.register("emailSignature")} />
                  </div>
                  <Button type="submit" size="sm" className="self-start">
                    <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Guardar perfil
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        );

      case "email":
        return (
          <Card>
            <CardHeader>
              <PanelHeader icon={Mail} title="Configuración de email" />
            </CardHeader>
            <CardContent>
              <form
                onSubmit={emailForm.handleSubmit(() => handleSave("email"))}
                className="flex flex-col gap-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider">Resend API Key</Label>
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
                      aria-label="Copiar API key"
                      onClick={() =>
                        navigator.clipboard.writeText(emailForm.getValues("resendKey") ?? "")
                      }
                    >
                      <Copy className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider">Email remitente</Label>
                  <Input
                    placeholder="outreach@tu-agencia.com"
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
                    <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Guardar email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => notify.success("Email de prueba enviado")}
                  >
                    <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" /> Probar email
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        );

      case "followups":
        return (
          <Card>
            <CardHeader>
              <PanelHeader icon={Shield} title="Plantillas de seguimiento" />
            </CardHeader>
            <CardContent>
              <form
                onSubmit={followUpForm.handleSubmit(() => handleSave("seguimientos"))}
                className="flex flex-col gap-4"
              >
                <p className="text-xs text-text-secondary">
                  Valores por defecto al programar seguimientos desde un lead.
                </p>
                {[0, 3, 7].map((day, i) => (
                  <div
                    key={day}
                    className="rounded-lg bg-bg border border-border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Paso {i + 1}</Badge>
                      <span className="text-xs font-mono text-text-muted">Día {day}</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider">Asunto</Label>
                      <Input
                        {...followUpForm.register(
                          `step${i + 1}Subject` as keyof FollowUpDefaultsForm,
                        )}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider">Cuerpo</Label>
                      <Textarea
                        rows={3}
                        {...followUpForm.register(
                          `step${i + 1}Body` as keyof FollowUpDefaultsForm,
                        )}
                      />
                    </div>
                  </div>
                ))}
                <Button type="submit" size="sm" className="self-start">
                  <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Guardar plantillas
                </Button>
              </form>
            </CardContent>
          </Card>
        );

      case "apikeys":
        return (
          <Card>
            <CardHeader>
              <PanelHeader icon={Key} title="Claves API" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {apiKeys.map((api) => (
                  <div
                    key={api.name}
                    className="rounded-lg bg-bg border border-border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text">{api.name}</span>
                      <Badge variant={api.status === "Active" ? "default" : "secondary"}>
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
                        type="button"
                        aria-label={`Copiar clave ${api.name}`}
                        onClick={() => navigator.clipboard.writeText(api.key)}
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  type="button"
                  className="self-start"
                  onClick={() => handleSave("API Keys")}
                >
                  <Save className="size-3.5 mr-1.5" aria-hidden="true" /> Guardar claves
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <PageContainer className="max-w-4xl">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-headline font-semibold text-text">Configuración</h1>
          <p className="text-sm text-text-muted mt-1">
            Perfil de consultor, email y plantillas para informes y outreach
          </p>
        </div>

        <div className="flex flex-col md:grid md:grid-cols-[200px_minmax(0,1fr)] gap-4 md:gap-6">
          <SectionNav
            activeSection={activeSection}
            onSelect={setActiveSection}
            className="flex-row overflow-x-auto pb-1 md:flex-col md:overflow-visible md:rounded-lg md:bg-surface md:border md:border-border md:p-2 md:h-fit"
          />

          <div className="min-w-0">{renderSection()}</div>
        </div>
      </div>
    </PageContainer>
  );
}
