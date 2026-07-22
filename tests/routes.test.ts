import { describe, expect, it } from "vitest";
import { getUserProfileHref } from "@/lib/routes";

describe("user profile routes", () => {
  it("builds a root-relative profile URL for local hosting", () => {
    expect(getUserProfileHref("mygo", "")).toBe("/users/mygo/");
  });

  it("keeps the deployment base path for static hosting", () => {
    expect(getUserProfileHref("yeochang", "/leetdash")).toBe("/leetdash/users/yeochang/");
  });

  it("encodes user IDs before placing them in the URL", () => {
    expect(getUserProfileHref("user/name", "/leetdash/")).toBe("/leetdash/users/user%2Fname/");
  });
});
