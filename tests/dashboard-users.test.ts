import { describe, expect, it } from "vitest";
import { DASHBOARD_USER_SORT_KEYS, getDashboardProgressSortKey, sortDashboardUsers } from "@/lib/dashboard-users";

const users = [
  {
    id: "ada",
    displayName: "Ada Lovelace",
    solvedTotal: 8,
    solvedLast7Days: 1,
    solvedLast35Days: 2,
    daysSinceLastSolved: 2,
    activityStatusRank: 3,
    recentSolvedAt: "2024-01-08T00:00:00.000Z",
    progress: [
      { key: "top-interview-easy", solved: 4, percent: 40 },
      { key: "leetcode-75", solved: 3, percent: 30 },
    ],
  },
  {
    id: "grace",
    displayName: "Grace Hopper",
    solvedTotal: 12,
    solvedLast7Days: 0,
    solvedLast35Days: 1,
    daysSinceLastSolved: null,
    activityStatusRank: 1,
    recentSolvedAt: null,
    progress: [
      { key: "top-interview-easy", solved: 6, percent: 60 },
      { key: "leetcode-75", solved: 1, percent: 10 },
    ],
  },
  {
    id: "katherine",
    displayName: "Katherine Johnson",
    solvedTotal: 12,
    solvedLast7Days: 3,
    solvedLast35Days: 5,
    daysSinceLastSolved: 8,
    activityStatusRank: 2,
    recentSolvedAt: "2024-01-07T00:00:00.000Z",
    progress: [
      { key: "top-interview-easy", solved: 5, percent: 50 },
      { key: "leetcode-75", solved: 7, percent: 70 },
    ],
  },
];

describe("dashboard user sorting", () => {
  it("does not expose display name as a user-selected sort key", () => {
    expect(DASHBOARD_USER_SORT_KEYS).not.toContain("displayName");
  });

  it("sorts users by recent 35-day solved count with name tie-breaks", () => {
    expect(sortDashboardUsers(users, "solvedLast35Days", "desc").map((user) => user.id)).toEqual([
      "katherine",
      "ada",
      "grace",
    ]);
  });

  it("sorts users by recent 7-day solved count", () => {
    expect(sortDashboardUsers(users, "solvedLast7Days", "desc").map((user) => user.id)).toEqual([
      "katherine",
      "ada",
      "grace",
    ]);
  });

  it("sorts users by days since last solved while keeping missing values last", () => {
    expect(sortDashboardUsers(users, "daysSinceLastSolved", "desc").map((user) => user.id)).toEqual([
      "katherine",
      "ada",
      "grace",
    ]);
  });

  it("sorts users by activity status", () => {
    expect(sortDashboardUsers(users, "activityStatusRank", "desc").map((user) => user.id)).toEqual([
      "ada",
      "katherine",
      "grace",
    ]);
  });

  it("sorts users by total solved count and then display name", () => {
    expect(sortDashboardUsers(users, "solvedTotal", "desc").map((user) => user.id)).toEqual([
      "grace",
      "katherine",
      "ada",
    ]);
  });

  it("keeps users with no recent solved date last when sorting by recent solved date", () => {
    expect(sortDashboardUsers(users, "recentSolvedAt", "desc").map((user) => user.id)).toEqual([
      "ada",
      "katherine",
      "grace",
    ]);
  });

  it("sorts users by a problem list progress column", () => {
    expect(sortDashboardUsers(users, getDashboardProgressSortKey("leetcode-75"), "desc").map((user) => user.id)).toEqual([
      "katherine",
      "ada",
      "grace",
    ]);
  });
});
