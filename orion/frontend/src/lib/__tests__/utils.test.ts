import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn() utility", () => {
  it("combines class names with clsx", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", true && "visible")).toBe(
      "base visible"
    );
  });

  it("resolves tailwind conflicts with twMerge", () => {
    // p-4 and p-2 conflict — twMerge keeps the last one
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("resolves bg color conflicts", () => {
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("handles undefined and null values", () => {
    expect(cn("base", undefined, null, "extra")).toBe("base extra");
  });

  it("handles object syntax", () => {
    expect(cn("base", { hidden: false, visible: true })).toBe("base visible");
  });

  it("handles arrays of class names", () => {
    expect(cn(["px-4", "py-2"], "text-sm")).toBe("px-4 py-2 text-sm");
  });
});
