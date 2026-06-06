import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header, MobileSidebarOverlay } from "@/components/layout/Header";
import { useUIStore } from "@/stores/ui-store";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const InboxPage = lazy(() =>
  import("@/pages/InboxPage").then((m) => ({ default: m.InboxPage })),
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

function RouteChangeCloser() {
  const closeSidebarMobile = useUIStore((s) => s.closeSidebarMobile);
  const location = useLocation();
  useEffect(() => {
    closeSidebarMobile();
  }, [location.pathname, closeSidebarMobile]);
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/poseidon">
      <TooltipProvider>
        <RouteChangeCloser />
        <div className="grid h-screen grid-rows-[56px_minmax(0,1fr)] bg-bg">
          <Header />
          <div className="relative flex min-h-0 overflow-hidden">
            <div className="hidden md:block shrink-0 h-full">
              <Sidebar />
            </div>
            <main id="main-content" className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-bg">
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
