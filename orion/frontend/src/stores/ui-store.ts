import { create } from "zustand";

export type Theme = "dark" | "light";

export interface UIState {
  /** Sidebar collapsed state (desktop icon-only mode) */
  sidebarOpen: boolean;
  /** Toggle sidebar open/closed */
  toggleSidebar: () => void;
  /** Set sidebar state directly */
  setSidebarOpen: (open: boolean) => void;

  /** Mobile sidebar visibility (overlay mode) */
  sidebarMobileOpen: boolean;
  /** Toggle mobile sidebar */
  toggleSidebarMobile: () => void;
  /** Close mobile sidebar */
  closeSidebarMobile: () => void;

  /** Current theme — always "dark" per Kinetic Ledger spec */
  theme: Theme;
  /** Set theme (currently only dark is used per design spec) */
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  sidebarMobileOpen: false,
  toggleSidebarMobile: () =>
    set((state) => ({ sidebarMobileOpen: !state.sidebarMobileOpen })),
  closeSidebarMobile: () => set({ sidebarMobileOpen: false }),

  theme: "dark",
  setTheme: (theme) => set({ theme }),
}));
