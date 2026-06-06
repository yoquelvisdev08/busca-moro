import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  Users,
  MessagesSquare,
  ClipboardCheck,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeft,
  X,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Coincidencia exacta de ruta (evita que /leads active en /leads/revisados). */
  end?: boolean;
}[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/discover", label: "Discover", icon: Compass, end: true },
  { to: "/leads", label: "Leads nuevos", icon: Users, end: true },
  { to: "/leads/revisados", label: "Leads revisados", icon: ClipboardCheck, end: true },
  { to: "/mensajeria", label: "Mensajería", icon: MessagesSquare, end: true },
  { to: "/monitor", label: "Monitor", icon: Activity, end: true },
  { to: "/settings", label: "Settings", icon: Settings, end: true },
];

export function Sidebar() {
  const {
    sidebarOpen,
    toggleSidebar,
    closeSidebarMobile,
  } = useUIStore();

  const handleNavClick = () => {
    // Close mobile sidebar on navigation
    closeSidebarMobile();
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r border-border transition-all duration-300",
        "bg-bg",
        sidebarOpen ? "w-64" : "w-16"
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className={cn("flex px-4 py-5", sidebarOpen ? "items-center justify-between" : "flex-col items-center gap-2")}>
        <div className={cn("flex items-center gap-2.5 min-w-0", !sidebarOpen && "justify-center")}>
          <img
            src="/orion/logos/orion.svg"
            alt=""
            className="size-8 shrink-0"
            width={32}
            height={32}
          />
          {sidebarOpen && (
            <div className="min-w-0">
              <h1 className="text-lg font-headline font-semibold tracking-tighter text-primary">
                Orion
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-text-muted mt-0.5">
                Precision Leads
              </p>
            </div>
          )}
        </div>
        {/* Desktop toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "hidden md:flex p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-surface transition-colors",
            !sidebarOpen && "mx-auto"
          )}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </button>
        {/* Mobile close */}
        <button
          className="md:hidden p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-surface transition-colors"
          onClick={closeSidebarMobile}
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2" role="list">
        {!sidebarOpen && (
          <h4 className="hidden md:block text-[10px] font-semibold uppercase tracking-widest text-text-muted px-2 mt-4 mb-2 text-center">
            Nav
          </h4>
        )}
        {sidebarOpen && (
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-3 mt-4 mb-2">
            Navigation
          </h4>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? item.to === "/"}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-150 text-sm font-medium",
                  sidebarOpen ? "justify-start" : "justify-center",
                  isActive
                    ? "bg-primary-soft text-primary border-r-2 border-primary-container"
                    : "text-text-secondary hover:text-text hover:bg-surface"
                )
              }
              role="listitem"
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      {sidebarOpen && (
        <div className="mt-auto p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-border bg-surface-high flex items-center justify-center text-sm font-bold text-primary">
              BR
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text">Broz</span>
              <span className="text-[10px] uppercase tracking-widest text-text-muted">
                Agencia
              </span>
            </div>
          </div>
        </div>
      )}
      {!sidebarOpen && (
        <div className="mt-auto p-2 border-t border-border flex justify-center">
          <div className="w-8 h-8 rounded-full border border-border bg-surface-high flex items-center justify-center text-xs font-bold text-primary">
            BR
          </div>
        </div>
      )}
    </aside>
  );
}
