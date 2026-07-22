import { describe, expect, it } from "vitest";
import { buildRecentSolvedSubmissions, getDashboardData, getUserDetail } from "@/lib/progress";
import { SubmissionStatus, type Submission } from "@/lib/types";

function submission(overrides: Partial<Submission>): Submission {
  return {
    id: `ada:${overrides.problemKey}`,
    userId: "ada",
    problemKey: "leetcode:1",
    sourceKey: "top-interview-easy",
    submissionKey: "1",
    status: SubmissionStatus.SOLVED,
    source: "solution-file",
    generatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dashboard progress helpers", () => {
  it("returns ten recent solved submissions by default", () => {
    const problemKeys = [
      "leetcode:26",
      "leetcode:122",
      "leetcode:189",
      "leetcode:217",
      "leetcode:136",
      "leetcode:350",
      "leetcode:66",
      "leetcode:283",
      "leetcode:1",
      "leetcode:36",
      "leetcode:48",
    ];
    const rows = [
      {
        id: "ada",
        displayName: "Ada Lovelace",
        githubUsername: "ada",
        submissions: problemKeys.map((problemKey, index) =>
          submission({
            id: `ada:${problemKey}`,
            problemKey,
            sourceKey: "top-interview-easy",
            submissionKey: String(index + 1),
            submittedAt: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
          }),
        ),
      },
    ];

    const recentSubmissions = buildRecentSolvedSubmissions(rows);

    expect(recentSubmissions).toHaveLength(10);
    expect(recentSubmissions[0]?.problemKey).toBe("leetcode:48");
    expect(recentSubmissions.at(-1)?.problemKey).toBe("leetcode:122");
  });

  it("exposes each user's solved count for the last 35 days", async () => {
    const dashboard = await getDashboardData();

    expect(dashboard.users[0]).toEqual(
      expect.objectContaining({
        solvedLast7Days: expect.any(Number),
        solvedLast35Days: dashboard.users[0]?.activityCalendar.totalSolved,
        activityStatusLabel: expect.any(String),
      }),
    );
    expect(dashboard.users[0]).toHaveProperty("daysSinceLastSolved");
  });

  it("summarizes overall completion and recent activity windows", async () => {
    const dashboard = await getDashboardData();
    const solvedProgress = dashboard.users.reduce(
      (sum, user) => sum + user.progress.reduce((userSum, progress) => userSum + progress.solved, 0),
      0,
    );
    const totalProgress = dashboard.users.reduce(
      (sum, user) => sum + user.progress.reduce((userSum, progress) => userSum + progress.total, 0),
      0,
    );

    expect(dashboard.totals.overallCompletionPercent).toBe(totalProgress === 0 ? 0 : (solvedProgress / totalProgress) * 100);
    expect(dashboard.totals.solvedLast7Days).toBe(
      dashboard.users.reduce((sum, user) => sum + user.solvedLast7Days, 0),
    );
    expect(dashboard.totals.solvedLast35Days).toBe(
      dashboard.users.reduce((sum, user) => sum + user.solvedLast35Days, 0),
    );
  });

  it("identifies the first unsolved problem in user detail order", async () => {
    const detail = await getUserDetail("mygo");

    expect(detail).not.toBeNull();
    if (!detail) {
      return;
    }

    const expected = detail.lists
      .flatMap((list) => list.items.map((item) => ({ listKey: list.key, problemKey: item.problemKey, submission: item.submission })))
      .find((item) => item.submission?.status !== SubmissionStatus.SOLVED);

    expect(detail.firstUnsolvedProblemTarget).toEqual({
      elementId: "first-unsolved-problem",
      listKey: expected?.listKey,
      problemKey: expected?.problemKey,
    });
  });

  it("returns the five most recent solved submissions with user and problem labels", () => {
    const rows = [
      {
        id: "ada",
        displayName: "Ada Lovelace",
        githubUsername: "ada",
        submissions: [
          submission({
            problemKey: "leetcode:1",
            sourceKey: "top-interview-easy",
            submissionKey: "1",
            submittedAt: "2024-01-06T00:00:00.000Z",
          }),
          submission({
            problemKey: "leetcode:20",
            sourceKey: "top-interview-easy",
            submissionKey: "20",
            submittedAt: "2024-01-02T00:00:00.000Z",
          }),
          submission({
            problemKey: "leetcode:1768",
            sourceKey: "leetcode-75",
            submissionKey: "1768",
            status: SubmissionStatus.REVIEWING,
            submittedAt: "2024-01-07T00:00:00.000Z",
          }),
        ],
      },
      {
        id: "grace",
        displayName: "Grace Hopper",
        githubUsername: "grace",
        submissions: [
          submission({
            id: "grace:merge-sorted-array",
            userId: "grace",
            problemKey: "leetcode:88",
            sourceKey: "top-interview-150",
            submissionKey: "88",
            submittedAt: "2024-01-05T00:00:00.000Z",
          }),
          submission({
            id: "grace:remove-duplicates-from-sorted-array",
            userId: "grace",
            problemKey: "leetcode:26",
            sourceKey: "top-interview-150",
            submissionKey: "26",
            submittedAt: "2024-01-04T00:00:00.000Z",
          }),
          submission({
            id: "grace:search-insert-position",
            userId: "grace",
            problemKey: "leetcode:35",
            sourceKey: "top-interview-easy",
            submissionKey: "35",
            submittedAt: "2024-01-03T00:00:00.000Z",
          }),
          submission({
            id: "grace:plus-one",
            userId: "grace",
            problemKey: "leetcode:66",
            sourceKey: "top-interview-easy",
            submissionKey: "66",
            submittedAt: "2024-01-01T00:00:00.000Z",
          }),
        ],
      },
    ];

    expect(buildRecentSolvedSubmissions(rows, 5)).toEqual([
      expect.objectContaining({
        displayName: "Ada Lovelace",
        problemTitle: "Two Sum",
        problemKey: "leetcode:1",
        submittedAt: "2024-01-06T00:00:00.000Z",
      }),
      expect.objectContaining({
        displayName: "Grace Hopper",
        problemTitle: "Merge Sorted Array",
        problemKey: "leetcode:88",
        submittedAt: "2024-01-05T00:00:00.000Z",
      }),
      expect.objectContaining({ problemKey: "leetcode:26" }),
      expect.objectContaining({ problemKey: "leetcode:35" }),
      expect.objectContaining({ problemKey: "leetcode:20" }),
    ]);
  });
});
