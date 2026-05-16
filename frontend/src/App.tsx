import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { LeadDetailPage } from "@/pages/LeadDetailPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SniperPage } from "@/pages/SniperPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="sniper" element={<SniperPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
