import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import { Sidebar, Header } from "@/components/layout/index";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

// Lazy-loaded pages for code splitting
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const DiscoverPage = lazy(() =>
  import("@/pages/DiscoverPage").then((m) => ({ default: m.DiscoverPage }))
);
const LeadsPage = lazy(() =>
  import("@/pages/LeadsPage").then((m) => ({ default: m.LeadsPage }))
);
const LeadDetailPage = lazy(() =>
  import("@/pages/LeadDetailPage").then((m) => ({ default: m.LeadDetailPage }))
);
const CampaignsPage = lazy(() =>
  import("@/pages/CampaignsPage").then((m) => ({ default: m.CampaignsPage }))
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const MonitorPage = lazy(() =>
  import("@/pages/MonitorPage").then((m) => ({ default: m.MonitorPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

function PageFallback() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

export function App() {
  const sidebarMobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const closeSidebarMobile = useUIStore((s) => s.closeSidebarMobile);

  // Close mobile sidebar on route change
  useEffect(() => {
    const handleRouteChange = () => closeSidebarMobile();
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, [closeSidebarMobile]);

  return (
    <BrowserRouter>
      <TooltipProvider>
        {/* Skip-to-content accessibility link */}
        <a
          href="#main-content"
          className="skip-to-content sr-only"
        >
          Skip to content
        </a>

        <div
          className="grid h-screen"
          style={{
            gridTemplateColumns: "1fr",
            gridTemplateRows: "56px 1fr",
            gridTemplateAreas: '"header" "main"',
          }}
        >
          {/* Header spans full width */}
          <div style={{ gridArea: "header" }}>
            <Header />
          </div>

          {/* Sidebar: desktop (inline) + mobile (overlay) */}
          <div className="hidden md:block">
            <div
              className="grid h-full"
              style={{
                gridTemplateColumns: "auto 1fr",
                gridTemplateRows: "1fr",
              }}
            >
              <Sidebar />
              <main
                id="main-content"
                className="overflow-y-auto bg-bg"
                tabIndex={-1}
              >
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/discover" element={<DiscoverPage />} />
                    <Route path="/leads" element={<LeadsPage />} />
                    <Route path="/leads/:id" element={<LeadDetailPage />} />
                    <Route path="/campaigns" element={<CampaignsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/monitor" element={<MonitorPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </div>

          {/* Mobile: full-width main + overlay sidebar */}
          <div className="md:hidden relative" style={{ gridArea: "main" }}>
            <main
              id="main-content"
              className="h-full overflow-y-auto bg-bg"
              tabIndex={-1}
            >
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/discover" element={<DiscoverPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/leads/:id" element={<LeadDetailPage />} />
                  <Route path="/campaigns" element={<CampaignsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/monitor" element={<MonitorPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>

            {/* Mobile sidebar overlay */}
            {sidebarMobileOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-black/50"
                  aria-hidden="true"
                  onClick={closeSidebarMobile}
                />
                {/* Sidebar overlay */}
                <aside
                  className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-bg w-64",
                    "transition-transform duration-300 ease-in-out",
                    "animate-in slide-in-from-left"
                  )}
                  aria-label="Navigation sidebar"
                  role="navigation"
                >
                  <Sidebar />
                </aside>
              </>
            )}
          </div>
        </div>
      </TooltipProvider>
    </BrowserRouter>
  );
}
