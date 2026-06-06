/** Lead con email principal o secundarios utilizables. */
export function leadHasEmail(lead: {
  email?: string | null;
  secondary_emails?: string[];
}): boolean {
  if (lead.email?.trim()) return true;
  return Boolean(lead.secondary_emails?.some((e) => e?.trim()));
}

export function leadPrimaryEmail(lead: {
  email?: string | null;
  secondary_emails?: string[];
}): string | null {
  if (lead.email?.trim()) return lead.email.trim();
  const secondary = lead.secondary_emails?.find((e) => e?.trim());
  return secondary?.trim() ?? null;
}
