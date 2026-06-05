import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import { Sidebar, Header } from "@/components/layout/index";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

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
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const MonitorPage = lazy(() =>
  import("@/pages/MonitorPage").then((m) => ({ default: m.MonitorPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const MensajeriaPage = lazy(() =>
  import("@/pages/MensajeriaPage").then((m) => ({ default: m.MensajeriaPage }))
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/leads/revisados" element={<LeadsPage pipeline="reviewed" />} />
      <Route path="/leads" element={<LeadsPage pipeline="new" />} />
      <Route path="/leads/:id" element={<LeadDetailPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/mensajeria" element={<MensajeriaPage />} />
      <Route path="/ensaria" element={<Navigate to="/mensajeria" replace />} />
      <Route path="/monitor" element={<MonitorPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/campaigns" element={<Navigate to="/leads" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function MobileSidebarOverlay() {
  const sidebarMobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const closeSidebarMobile = useUIStore((s) => s.closeSidebarMobile);

  if (!sidebarMobileOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        aria-hidden="true"
        onClick={closeSidebarMobile}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-bg w-64 md:hidden",
          "transition-transform duration-300 ease-in-out",
          "animate-in slide-in-from-left",
        )}
        aria-label="Navigation sidebar"
        role="navigation"
      >
        <Sidebar />
      </aside>
    </>
  );
}

function RouteChangeCloser() {
  const closeSidebarMobile = useUIStore((s) => s.closeSidebarMobile);
  const location = useLocation();

  useEffect(() => {
    closeSidebarMobile();
  }, [location.pathname, closeSidebarMobile]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <RouteChangeCloser />
        <a href="#main-content" className="skip-to-content sr-only">
          Skip to content
        </a>

        <div className="grid h-screen grid-rows-[56px_minmax(0,1fr)]">
          <Header />

          <div className="relative flex min-h-0 overflow-hidden">
            <div className="hidden md:block shrink-0 h-full">
              <Sidebar />
            </div>

            <main
              id="main-content"
              className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-bg"
              tabIndex={-1}
            >
              <Suspense fallback={<PageFallback />}>
                <AppRoutes />
              </Suspense>
            </main>

            <MobileSidebarOverlay />
          </div>
        </div>
      </TooltipProvider>
    </BrowserRouter>
  );
}
