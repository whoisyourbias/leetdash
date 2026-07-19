export type DashboardProgressSortKey = `progress:${string}`;
export type DashboardBaseSortKey =
  | "solvedTotal"
  | "solvedLast7Days"
  | "solvedLast35Days"
  | "daysSinceLastSolved"
  | "activityStatusRank"
  | "recentSolvedAt";
export type DashboardUserSortKey = DashboardBaseSortKey | DashboardProgressSortKey;
export type DashboardUserSortDirection = "asc" | "desc";

export const DASHBOARD_USER_SORT_KEYS = [
  "solvedTotal",
  "solvedLast7Days",
  "solvedLast35Days",
  "daysSinceLastSolved",
  "activityStatusRank",
  "recentSolvedAt",
] as const satisfies readonly DashboardBaseSortKey[];

export type SortableDashboardUser = {
  displayName: string;
  solvedTotal: number;
  solvedLast7Days: number;
  solvedLast35Days: number;
  daysSinceLastSolved: number | null;
  activityStatusRank: number;
  recentSolvedAt: string | null;
  progress: Array<{
    key: string;
    percent: number;
    solved: number;
  }>;
};

export function getDashboardProgressSortKey(listKey: string): DashboardProgressSortKey {
  return `progress:${listKey}`;
}

function isProgressSortKey(sortKey: DashboardUserSortKey): sortKey is DashboardProgressSortKey {
  return sortKey.startsWith("progress:");
}

function getProgressSortValue(user: SortableDashboardUser, sortKey: DashboardProgressSortKey) {
  const listKey = sortKey.replace(/^progress:/, "");
  return user.progress.find((progress) => progress.key === listKey)?.percent ?? 0;
}

function compareNullableDates(left: string | null, right: string | null, direction: DashboardUserSortDirection) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const dateComparison = new Date(left).getTime() - new Date(right).getTime();
  return direction === "asc" ? dateComparison : dateComparison * -1;
}

function compareUsers<T extends SortableDashboardUser>(
  left: T,
  right: T,
  sortKey: DashboardUserSortKey,
  direction: DashboardUserSortDirection,
) {
  if (sortKey === "recentSolvedAt") {
    return compareNullableDates(left.recentSolvedAt, right.recentSolvedAt, direction);
  }

  if (sortKey === "daysSinceLastSolved") {
    if (left.daysSinceLastSolved === null && right.daysSinceLastSolved === null) {
      return 0;
    }

    if (left.daysSinceLastSolved === null) {
      return 1;
    }

    if (right.daysSinceLastSolved === null) {
      return -1;
    }

    const daysComparison = left.daysSinceLastSolved - right.daysSinceLastSolved;
    return direction === "asc" ? daysComparison : daysComparison * -1;
  }

  if (isProgressSortKey(sortKey)) {
    return getProgressSortValue(left, sortKey) - getProgressSortValue(right, sortKey);
  }

  return left[sortKey] - right[sortKey];
}

export function sortDashboardUsers<T extends SortableDashboardUser>(
  users: T[],
  sortKey: DashboardUserSortKey,
  direction: DashboardUserSortDirection,
) {
  const directionMultiplier = direction === "asc" ? 1 : -1;

  return [...users].sort((left, right) => {
    const primaryComparison = compareUsers(left, right, sortKey, direction);
    if (primaryComparison !== 0) {
      if (sortKey === "recentSolvedAt" || sortKey === "daysSinceLastSolved") {
        return primaryComparison;
      }

      return primaryComparison * directionMultiplier;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}
