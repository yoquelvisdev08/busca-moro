export type LeadDeleteReasonCode =
  | "no_email"
  | "no_phone"
  | "not_contactable"
  | "no_fit"
  | "duplicate"
  | "big_brand"
  | "bad_domain"
  | "low_quality"
  | "already_contacted"
  | "other";

export const LEAD_DELETE_REASONS: {
  value: LeadDeleteReasonCode;
  label: string;
}[] = [
  { value: "no_email", label: "Sin email para contactar" },
  { value: "no_phone", label: "Sin teléfono / canal de contacto" },
  { value: "not_contactable", label: "No contactable (datos incompletos)" },
  { value: "no_fit", label: "No encaja con mi ICP" },
  { value: "duplicate", label: "Duplicado" },
  { value: "big_brand", label: "Marca grande / no prospectable" },
  { value: "bad_domain", label: "Dominio inválido o sitio caído" },
  { value: "low_quality", label: "Calidad baja / sin señal comercial" },
  { value: "already_contacted", label: "Ya contactado o descartado" },
  { value: "other", label: "Otro (especificar)" },
];

export function suggestDeleteReason(lead: {
  email?: string | null;
  secondary_emails?: string[];
  phone?: string | null;
  segment?: string | null;
}): LeadDeleteReasonCode {
  const hasEmail =
    Boolean(lead.email?.trim()) ||
    Boolean(lead.secondary_emails?.length);
  if (!hasEmail) return "no_email";
  if (!lead.phone?.trim()) return "not_contactable";
  if (lead.segment === "D") return "low_quality";
  return "no_fit";
}
