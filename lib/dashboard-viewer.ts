import { FIRST_UNSOLVED_PROBLEM_HASH } from "@/lib/user-problem-focus";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const DASHBOARD_VIEWER_STORAGE_KEY = "leetcode-progress-radar:dashboard-viewer-id";

export function getDashboardViewerProfilePath<T extends { id: string }>(
  users: T[],
  viewerId: string | null,
): string | null {
  if (!viewerId || !users.some((user) => user.id === viewerId)) {
    return null;
  }

  return `/users/${viewerId}${FIRST_UNSOLVED_PROBLEM_HASH}`;
}

export function getStoredDashboardViewerId(storage: Pick<StorageLike, "getItem">): string | null {
  try {
    const viewerId = storage.getItem(DASHBOARD_VIEWER_STORAGE_KEY)?.trim();
    return viewerId ? viewerId : null;
  } catch {
    return null;
  }
}

export function saveStoredDashboardViewerId(
  storage: Pick<StorageLike, "removeItem" | "setItem">,
  viewerId: string | null,
) {
  try {
    if (viewerId) {
      storage.setItem(DASHBOARD_VIEWER_STORAGE_KEY, viewerId);
      return;
    }

    storage.removeItem(DASHBOARD_VIEWER_STORAGE_KEY);
  } catch {
    // Browsers may disable storage; the dashboard can still render in default order.
  }
}
