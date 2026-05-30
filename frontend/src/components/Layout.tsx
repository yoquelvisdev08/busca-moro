import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  Users,
  Activity,
  Settings,
  Bell,
  Search,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/monitor", label: "Monitor", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Command Center";
  if (pathname.startsWith("/discover")) return "Discover";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/monitor")) return "Monitor";
  if (pathname.startsWith("/settings")) return "Settings";
  return "SIPHON-X";
}

export function Layout() {
  const { pathname } = useLocation();
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="shell" style={{ gridTemplateColumns: "256px 1fr" }}>
      {/* Top Bar */}
      <header
        className="topbar"
        style={{
          gridColumn: "1 / -1",
          borderBottom: "1px solid var(--sx-border)",
          background: "var(--sx-bg)",
        }}
      >
        <div className="flex items-center gap-4">
          <span
            className="font-bold text-lg tracking-tight"
            style={{ color: "var(--sx-primary)" }}
          >
            {pageTitle}
          </span>
          {pathname === "/" && (
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--sx-text-muted)" }}>
              System Active
            </span>
          )}
          {pathname === "/discover" && (
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--sx-text-muted)" }}>
              Lead discovery configuration
            </span>
          )}
          {pathname === "/leads" && (
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--sx-text-muted)" }}>
              Manage and qualify prospects
            </span>
          )}
          {pathname === "/monitor" && (
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--sx-text-muted)" }}>
              System health and uptime
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-2 px-3 py-1 rounded border"
            style={{
              background: "var(--sx-surface)",
              borderColor: "var(--sx-border)",
            }}
          >
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "var(--sx-primary-container)" }}
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-tighter"
              style={{ color: "var(--sx-text-secondary)" }}
            >
              System: Stable
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="transition-colors duration-150 active:scale-95"
              style={{ color: "var(--sx-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sx-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sx-text-muted)")}
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              className="transition-colors duration-150 active:scale-95"
              style={{ color: "var(--sx-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sx-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sx-text-muted)")}
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{
          width: 256,
          borderRight: "1px solid var(--sx-border)",
          background: "var(--sx-surface)",
          padding: "24px 16px",
        }}
      >
        <div className="px-2 py-2 mb-8">
          <h1
            className="text-xl font-bold tracking-tighter"
            style={{ color: "var(--sx-primary)" }}
          >
            SIPHON-X
          </h1>
          <p
            className="text-[10px] uppercase tracking-widest mt-1"
            style={{ color: "var(--sx-text-muted)", opacity: 0.7 }}
          >
            Precision Leads
          </p>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  "flex items-center gap-3 px-4 py-3 rounded transition-all duration-200 font-medium text-sm " +
                  (isActive
                    ? ""
                    : "")
                }
                style={({ isActive }) => ({
                  background: isActive
                    ? "rgba(139, 92, 246, 0.1)"
                    : "transparent",
                  color: isActive
                    ? "var(--sx-primary)"
                    : "var(--sx-text-secondary)",
                  borderRight: isActive
                    ? "2px solid var(--sx-primary-container)"
                    : "2px solid transparent",
                  borderRadius: "var(--radius-sm)",
                })}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div
          className="mt-auto pt-4 flex items-center gap-3"
          style={{ borderTop: "1px solid var(--sx-border)" }}
        >
          <div
            className="w-10 h-10 rounded-full border flex items-center justify-center text-sm font-bold"
            style={{
              background: "var(--sx-surface-high)",
              borderColor: "var(--sx-border)",
              color: "var(--sx-primary)",
            }}
          >
            JD
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold" style={{ color: "var(--sx-text)" }}>
              John Doe
            </span>
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--sx-text-muted)" }}
            >
              Admin Privilege
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main" style={{ overflowY: "auto", padding: 32 }}>
        <Outlet />
      </main>
    </div>
  );
}
