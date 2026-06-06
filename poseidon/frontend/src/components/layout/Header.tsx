import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Sidebar } from "./Sidebar";

function getPageTitle(pathname: string): { title: string; subtitle?: string } {
  if (pathname.startsWith("/inbox")) {
    return { title: "Inbox", subtitle: "Señales en español" };
  }
  return { title: "Dashboard", subtitle: "Radar de intención" };
}

export function Header() {
  const { pathname } = useLocation();
  const { title, subtitle } = getPageTitle(pathname);
  const toggleSidebarMobile = useUIStore((s) => s.toggleSidebarMobile);

  return (
    <header className="relative z-40 h-14 border-b border-border bg-bg flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <a
          href="/"
          className="hidden sm:inline-flex text-[11px] font-medium text-text-muted hover:text-primary transition-colors"
          title="Volver a Olimpo"
        >
          Olimpo
        </a>
        <button
          type="button"
          className="md:hidden p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-surface"
          onClick={toggleSidebarMobile}
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0">
          <span className="text-lg font-headline font-semibold text-primary truncate block">
            {title}
          </span>
          {subtitle && (
            <span className="hidden md:block text-[10px] uppercase tracking-widest text-text-muted">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <p className="hidden sm:block text-[11px] text-text-dim font-mono">poseidon.local</p>
    </header>
  );
}

export function MobileSidebarOverlay() {
  const sidebarMobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const closeSidebarMobile = useUIStore((s) => s.closeSidebarMobile);

  if (!sidebarMobileOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        aria-hidden
        onClick={closeSidebarMobile}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-bg w-64 md:hidden">
        <Sidebar />
      </aside>
    </>
  );
}
