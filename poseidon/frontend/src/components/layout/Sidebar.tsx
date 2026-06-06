import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  PanelLeftClose,
  PanelLeft,
  X,
  Waves,
  Settings,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Inbox", icon: Inbox, end: true },
  { to: "/settings", label: "Configuración", icon: Settings, end: true },
] as const;

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const closeSidebarMobile = useUIStore((s) => s.closeSidebarMobile);

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r border-border bg-bg transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16",
      )}
      aria-label="Navegación Poseidon"
    >
      <div className="flex items-center justify-between px-4 py-5">
        {sidebarOpen && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 shrink-0">
              <Waves className="size-4 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-headline font-semibold text-primary truncate">Poseidon</h1>
              <p className="text-[10px] uppercase tracking-widest text-text-muted">Leads calientes</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "hidden md:flex p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-surface transition-colors",
            !sidebarOpen && "mx-auto",
          )}
          aria-label={sidebarOpen ? "Contraer menú" : "Expandir menú"}
        >
          {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
        </button>
        <button
          type="button"
          className="md:hidden p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-surface"
          onClick={closeSidebarMobile}
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeSidebarMobile}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                  sidebarOpen ? "justify-start" : "justify-center",
                  isActive
                    ? "bg-primary-soft text-primary border-r-2 border-primary"
                    : "text-text-secondary hover:text-text hover:bg-surface",
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {sidebarOpen && (
        <div className="mt-auto p-4 border-t border-border">
          <a
            href="/"
            className="text-[11px] text-text-muted hover:text-primary transition-colors"
          >
            ← Volver a Olimpo
          </a>
        </div>
      )}
    </aside>
  );
}
