import { describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_VIEWER_STORAGE_KEY,
  getDashboardViewerProfilePath,
  getStoredDashboardViewerId,
  saveStoredDashboardViewerId,
} from "@/lib/dashboard-viewer";

const users = [
  { id: "ada", displayName: "Ada Lovelace" },
  { id: "grace", displayName: "Grace Hopper" },
  { id: "katherine", displayName: "Katherine Johnson" },
];

describe("dashboard viewer preference", () => {
  it("returns a profile path only for a registered stored viewer", () => {
    expect(getDashboardViewerProfilePath(users, "grace")).toBe("/users/grace#first-unsolved-problem");
    expect(getDashboardViewerProfilePath(users, "unknown")).toBeNull();
    expect(getDashboardViewerProfilePath(users, null)).toBeNull();
  });

  it("reads, writes, and clears the viewer id from browser storage", () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
    };

    saveStoredDashboardViewerId(localStorage, "grace");

    expect(localStorage.setItem).toHaveBeenCalledWith(DASHBOARD_VIEWER_STORAGE_KEY, "grace");
    expect(getStoredDashboardViewerId(localStorage)).toBe("grace");

    saveStoredDashboardViewerId(localStorage, null);

    expect(localStorage.removeItem).toHaveBeenCalledWith(DASHBOARD_VIEWER_STORAGE_KEY);
    expect(getStoredDashboardViewerId(localStorage)).toBeNull();
  });
});
