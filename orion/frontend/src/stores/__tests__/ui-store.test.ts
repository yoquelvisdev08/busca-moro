import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui-store";

describe("useUIStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useUIStore.setState({
      sidebarOpen: true,
      theme: "dark",
    });
  });

  describe("sidebar", () => {
    it("starts with sidebar open by default", () => {
      const state = useUIStore.getState();
      expect(state.sidebarOpen).toBe(true);
    });

    it("toggleSidebar flips sidebar state", () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it("setSidebarOpen sets explicit state", () => {
      useUIStore.getState().setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      useUIStore.getState().setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe("theme", () => {
    it("starts with dark theme", () => {
      const state = useUIStore.getState();
      expect(state.theme).toBe("dark");
    });

    it("setTheme updates theme", () => {
      useUIStore.getState().setTheme("dark");
      expect(useUIStore.getState().theme).toBe("dark");
    });
  });
});
