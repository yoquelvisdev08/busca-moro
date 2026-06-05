import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Inbox, CheckCircle2 } from "lucide-react";

const TABS = [
  {
    to: "/leads",
    label: "Nuevos",
    description: "Sin mensaje enviado",
    icon: Inbox,
    end: true,
  },
  {
    to: "/leads/revisados",
    label: "Leads revisados",
    description: "Ya contactados",
    icon: CheckCircle2,
    end: true,
  },
] as const;

export function LeadsPipelineTabs() {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-xl border border-border/70 bg-surface-high/50 p-1"
      role="tablist"
      aria-label="Pipeline de leads"
    >
      {TABS.map(({ to, label, description, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          role="tab"
          className={({ isActive }) =>
            cn(
              "inline-flex min-w-[10rem] items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-surface text-text shadow-sm ring-1 ring-border/80"
                : "text-text-muted hover:bg-surface/60 hover:text-text",
            )
          }
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              "bg-primary-soft text-primary",
            )}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
          <span className="leading-tight">
            {label}
            <span className="mt-0.5 block text-[11px] font-normal text-text-muted">
              {description}
            </span>
          </span>
        </NavLink>
      ))}
    </div>
  );
}
