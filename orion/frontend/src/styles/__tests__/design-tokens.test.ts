import { describe, it, expect } from "vitest";
import { colors, chartColors, spacing, radii, typography, glow, fonts } from "../design-tokens";

describe("design-tokens", () => {
  describe("colors", () => {
    it("all color values reference CSS variables", () => {
      for (const value of Object.values(colors)) {
        expect(value).toMatch(/^var\(--sx-/);
      }
    });

    it("has required color keys", () => {
      expect(colors).toHaveProperty("bg");
      expect(colors).toHaveProperty("surface");
      expect(colors).toHaveProperty("primary");
      expect(colors).toHaveProperty("primaryContainer");
      expect(colors).toHaveProperty("success");
      expect(colors).toHaveProperty("warning");
      expect(colors).toHaveProperty("danger");
      expect(colors).toHaveProperty("info");
      expect(colors).toHaveProperty("text");
      expect(colors).toHaveProperty("textMuted");
      expect(colors).toHaveProperty("border");
    });
  });

  describe("chartColors", () => {
    it("maps primary to #6366f1", () => {
      expect(chartColors.primary).toBe("#6366f1");
    });

    it("maps secondary to #a855f7", () => {
      expect(chartColors.secondary).toBe("#a855f7");
    });

    it("maps tertiary to #d97721", () => {
      expect(chartColors.tertiary).toBe("#d97721");
    });
  });

  describe("spacing", () => {
    it("all spacing values reference CSS variables", () => {
      for (const value of Object.values(spacing)) {
        expect(value).toMatch(/^var\(--sx-space-/);
      }
    });

    it("has 4px base unit at spacing.1", () => {
      expect(spacing[1]).toBe("var(--sx-space-1)");
    });
  });

  describe("radii", () => {
    it("all radii values reference CSS variables", () => {
      for (const value of Object.values(radii)) {
        expect(value).toMatch(/^var\(--sx-radius-/);
      }
    });
  });

  describe("typography", () => {
    it("headline tokens reference CSS variables", () => {
      expect(typography.headline.lg).toBe("var(--sx-hl-lg)");
      expect(typography.headline.md).toBe("var(--sx-hl-md)");
      expect(typography.headline.sm).toBe("var(--sx-hl-sm)");
    });

    it("body tokens reference CSS variables", () => {
      expect(typography.body.lg).toBe("var(--sx-body-lg)");
      expect(typography.body.md).toBe("var(--sx-body-md)");
      expect(typography.body.sm).toBe("var(--sx-body-sm)");
    });
  });

  describe("glow", () => {
    it("all glow values reference CSS variables", () => {
      for (const value of Object.values(glow)) {
        expect(value).toMatch(/^var\(--sx-glow-/);
      }
    });
  });

  describe("fonts", () => {
    it("font values reference CSS variables", () => {
      expect(fonts.headline).toBe("var(--font-headline)");
      expect(fonts.body).toBe("var(--font-body)");
      expect(fonts.mono).toBe("var(--font-mono)");
    });
  });
});
