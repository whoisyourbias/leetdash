import type { ListProgress } from "@/lib/progress";

export type ListUserSortDirection = "asc" | "desc";

export type SortableListUser = {
  displayName: string;
  progress: Pick<ListProgress, "percent" | "reviewing" | "skipped" | "solved" | "total">;
};

export function sortListUsersByProgress<T extends SortableListUser>(users: T[], direction: ListUserSortDirection) {
  const directionMultiplier = direction === "asc" ? 1 : -1;

  return [...users].sort((left, right) => {
    const progressComparison = left.progress.percent - right.progress.percent;
    if (progressComparison !== 0) {
      return progressComparison * directionMultiplier;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}
