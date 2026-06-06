import { create } from "zustand";

export interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  sidebarMobileOpen: boolean;
  toggleSidebarMobile: () => void;
  closeSidebarMobile: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  sidebarMobileOpen: false,
  toggleSidebarMobile: () =>
    set((state) => ({ sidebarMobileOpen: !state.sidebarMobileOpen })),
  closeSidebarMobile: () => set({ sidebarMobileOpen: false }),
}));
