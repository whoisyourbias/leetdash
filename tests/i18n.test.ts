import { describe, expect, it } from "vitest";
import { formatCatalogSection, formatProblemTitle } from "@/lib/i18n";

describe("dashboard display labels", () => {
  it("keeps original LeetCode problem titles instead of translating them", () => {
    expect(formatProblemTitle("Two Sum")).toBe("Two Sum");
    expect(formatProblemTitle("Koko Eating Bananas")).toBe("Koko Eating Bananas");
  });

  it("still localizes catalog sections", () => {
    expect(formatCatalogSection("Array")).toBe("배열");
  });
});
