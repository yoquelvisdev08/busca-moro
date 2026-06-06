import { useLocation } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { NotificationsMenu } from "@/components/layout/NotificationsMenu";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

function getPageTitle(pathname: string): { title: string; subtitle?: string } {
  const pages: Record<string, { title: string; subtitle?: string }> = {
    "/": { title: "Command Center", subtitle: "System Active" },
    "/discover": { title: "Discover", subtitle: "Búsqueda de leads" },
    "/leads": { title: "Leads nuevos", subtitle: "Sin mensaje enviado aún" },
    "/leads/revisados": {
      title: "Leads revisados",
      subtitle: "Ya contactados por email",
    },
    "/mensajeria": { title: "Mensajería", subtitle: "Enviados y recibidos" },
    "/monitor": { title: "Monitor", subtitle: "System health and uptime" },
    "/settings": { title: "Configuración", subtitle: "Perfil, email y plantillas" },
    "/reports": { title: "Reports", subtitle: "Generated reports and exports" },
  };
  return pages[pathname] ?? { title: "Orion" };
}

export function Header() {
  const { pathname } = useLocation();
  const { title, subtitle } = getPageTitle(pathname);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebarMobile = useUIStore((s) => s.toggleSidebarMobile);

  return (
    <header
      className={cn(
        "relative z-40 h-14 border-b border-border bg-bg flex items-center justify-between px-4 md:px-6",
        "transition-all duration-300",
      )}
    >
      {/* Left: Mobile hamburger + Page context */}
      <div className="flex items-center gap-3">
        <a
          href="/"
          className="hidden sm:inline-flex text-[11px] font-medium text-text-muted hover:text-primary transition-colors"
          title="Volver a Olimpo"
        >
          Olimpo
        </a>
        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-surface transition-colors"
          onClick={toggleSidebarMobile}
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="text-lg font-headline font-semibold tracking-tight text-primary truncate">
          {title}
        </span>
        {subtitle && (
          <span className="hidden md:inline text-xs uppercase tracking-widest text-text-muted">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right: Search + Notifications + Status */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* System Status */}
        <div
          className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-1 rounded border text-[11px] font-semibold uppercase tracking-tighter",
            sidebarOpen ? "bg-surface border-border" : "bg-transparent border-transparent"
          )}
        >
          <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse-glow" />
          {sidebarOpen && (
            <span className="text-text-secondary">System: Stable</span>
          )}
        </div>

        {/* Search */}
        <button
          className="p-2 rounded text-text-muted hover:text-primary hover:bg-surface transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        <NotificationsMenu />
      </div>
    </header>
  );
}
