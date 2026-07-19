import { describe, expect, it } from "vitest";
import { formatDateKey } from "@/lib/format";

describe("formatDateKey", () => {
  it("formats Seoul date keys independently of the process timezone", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";

    try {
      expect(formatDateKey("2026-07-19")).toBe("2026년 7월 19일");
      expect(formatDateKey(null)).toBe("-");
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    }
  });
});
