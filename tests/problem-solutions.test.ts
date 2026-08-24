import { describe, expect, it } from "vitest";
import { catalog, type CatalogProblem } from "@/lib/catalog";
import {
  getProblemSolutionDetail,
  listComparableProblemParams,
} from "@/lib/problem-solutions";
import { SubmissionStatus, type ProgressData, type ProgressUser, type Submission } from "@/lib/types";
import type { ProblemCatalog } from "@/lib/catalog";

const fixtureCatalog: ProblemCatalog = {
  generatedAt: "2024-01-01T00:00:00.000Z",
  sources: [],
  lists: [],
  problems: [
    fixtureProblem("leetcode", "1", "Two Sum", "Easy"),
    fixtureProblem("programmers", "1", "폰켓몬", "Lv.1"),
    fixtureProblem("leetcode", "26", "Remove Duplicates from Sorted Array", "Easy"),
    fixtureProblem("swea", "26", "간단한 369게임", "D2"),
  ],
};

function fixtureProblem(
  provider: CatalogProblem["provider"],
  problemId: string,
  title: string,
  difficulty: string,
): CatalogProblem {
  return {
    provider,
    problemId,
    problemKey: `${provider}:${problemId}`,
    title,
    difficulty,
    sourceUrl: `https://example.com/${provider}/${problemId}`,
  };
}

function user(id: string, submissions: Submission[], overrides: Partial<ProgressUser> = {}): ProgressUser {
  return {
    id,
    displayName: id,
    githubUsername: id,
    active: true,
    submissionsPath: `submissions/${id}`,
    submissions,
    activity: [],
    ...overrides,
  };
}

function submission(overrides: Partial<Submission>): Submission {
  return {
    id: `s:${overrides.problemKey}`,
    userId: "user",
    problemKey: "leetcode:1",
    sourceKey: "top-interview-easy",
    submissionKey: "1",
    status: SubmissionStatus.SOLVED,
    solutionPath: `submissions/user/top-interview-easy/1/Solution.java`,
    source: "solution-file",
    generatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function progressData(users: ProgressUser[]): ProgressData {
  return { generatedAt: "2024-01-01T00:00:00.000Z", users };
}

describe("comparable problem index", () => {
  it("includes dynamic SWEA problems discovered from progress data", () => {
    const data: ProgressData = {
      ...progressData([
        user("mygo", [
          submission({
            id: "mygo:swea:25006",
            userId: "mygo",
            problemKey: "swea:25006",
            sourceKey: "swea",
            submissionKey: "25006",
            solutionPath: "submissions/whoisyourbias/swea/25006/Solution.java",
          }),
        ]),
      ]),
      dynamicProblems: [
        {
          provider: "swea",
          problemId: "25006",
          problemKey: "swea:25006",
          title: "[Pro] 전기차충전소",
          difficulty: "D6",
          sourceUrl: "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do",
        },
      ],
    };

    expect(listComparableProblemParams(data)).toEqual([{ provider: "swea", problemId: "25006" }]);
    expect(getProblemSolutionDetail("swea", "25006", data)).toMatchObject({
      problem: {
        problemKey: "swea:25006",
        title: "[Pro] 전기차충전소",
        difficulty: "D6",
      },
      solvers: [{ user: { id: "mygo" } }],
    });
  });

  it("lists only submitted catalog problems with a current solution", () => {
    const data = progressData([
      user("ada", [
        submission({ userId: "ada", id: "ada:leetcode:1", problemKey: "leetcode:1" }),
        submission({ userId: "ada", id: "ada:programmers:999999", problemKey: "programmers:999999" }),
        submission({
          userId: "ada",
          id: "ada:leetcode:26",
          problemKey: "leetcode:26",
          status: SubmissionStatus.SKIPPED,
          solutionPath: undefined,
        }),
      ]),
    ]);

    const params = listComparableProblemParams(data, fixtureCatalog);

    expect(params).toEqual([{ provider: "leetcode", problemId: "1" }]);
  });

  it("keeps identical numeric ids provider-distinct", () => {
    const data = progressData([
      user("ada", [
        submission({ userId: "ada", id: "ada:leetcode:1", problemKey: "leetcode:1" }),
        submission({ userId: "ada", id: "ada:programmers:1", problemKey: "programmers:1", submissionKey: "1" }),
      ]),
    ]);

    const params = listComparableProblemParams(data, fixtureCatalog);

    expect(params).toEqual([
      { provider: "leetcode", problemId: "1" },
      { provider: "programmers", problemId: "1" },
    ]);
    const leetCode = getProblemSolutionDetail("leetcode", "1", data, fixtureCatalog);
    const programmers = getProblemSolutionDetail("programmers", "1", data, fixtureCatalog);
    expect(leetCode?.problem.title).toBe("Two Sum");
    expect(programmers?.problem.title).toBe("폰켓몬");
    expect(leetCode?.problem.problemKey).not.toBe(programmers?.problem.problemKey);
  });

  it("collapses duplicate-list submissions to one solver per user", () => {
    const data = progressData([
      user("ada", [
        submission({
          userId: "ada",
          id: "ada:leetcode:1:skipped",
          problemKey: "leetcode:1",
          sourceKey: "top-interview-easy",
          submissionKey: "1",
          status: SubmissionStatus.SKIPPED,
          solutionPath: undefined,
        }),
        submission({
          userId: "ada",
          id: "ada:leetcode:1:solved",
          problemKey: "leetcode:1",
          sourceKey: "top-interview-150",
          submissionKey: "1",
        }),
      ]),
      user("bob", [
        submission({ userId: "bob", id: "bob:leetcode:1", problemKey: "leetcode:1" }),
      ]),
    ]);

    const params = listComparableProblemParams(data, fixtureCatalog);
    const detail = getProblemSolutionDetail("leetcode", "1", data, fixtureCatalog);

    expect(params).toEqual([{ provider: "leetcode", problemId: "1" }]);
    expect(detail?.solvers.map((solver) => solver.user.id).sort()).toEqual(["ada", "bob"]);
    expect(detail?.solvers.find((solver) => solver.user.id === "ada")?.submission.id).toBe("ada:leetcode:1:solved");
  });

  it("includes inactive registered users when their public solution exists", () => {
    const data = progressData([
      user(
        "ada",
        [submission({ userId: "ada", id: "ada:leetcode:1", problemKey: "leetcode:1" })],
        { active: false },
      ),
    ]);

    const detail = getProblemSolutionDetail("leetcode", "1", data, fixtureCatalog);

    expect(detail?.solvers.map((solver) => solver.user.id)).toEqual(["ada"]);
    expect(detail?.users.map((item) => item.id)).toContain("ada");
    expect(detail?.users.find((item) => item.id === "ada")?.active).toBe(false);
  });

  it("keeps unsolved registered users identifiable in the identity list", () => {
    const data = progressData([
      user("ada", [submission({ userId: "ada", id: "ada:leetcode:1", problemKey: "leetcode:1" })]),
      user("grace", [
        submission({
          userId: "grace",
          id: "grace:leetcode:1",
          problemKey: "leetcode:1",
          status: SubmissionStatus.REVIEWING,
          solutionPath: undefined,
        }),
      ]),
      user("kate", []),
    ]);

    const detail = getProblemSolutionDetail("leetcode", "1", data, fixtureCatalog);

    expect(detail?.solvers.map((solver) => solver.user.id)).toEqual(["ada"]);
    expect(detail?.users.map((item) => item.id).sort()).toEqual(["ada", "grace", "kate"]);
  });

  it("returns null for unknown providers, unknown ids, and zero-solver problems", () => {
    const data = progressData([
      user("ada", [submission({ userId: "ada", id: "ada:leetcode:1", problemKey: "leetcode:1" })]),
    ]);

    expect(getProblemSolutionDetail("unknown", "1", data, fixtureCatalog)).toBeNull();
    expect(getProblemSolutionDetail("leetcode", "999", data, fixtureCatalog)).toBeNull();
    expect(getProblemSolutionDetail("swea", "26", data, fixtureCatalog)).toBeNull();
  });

  it("passes through lazy asset metadata without any source or review bodies", () => {
    const data = progressData([
      user("ada", [
        submission({
          userId: "ada",
          id: "ada:leetcode:1",
          problemKey: "leetcode:1",
          language: "Java",
          submittedAt: "2024-01-06T00:00:00.000Z",
          solutionRawUrl: "https://raw.githubusercontent.com/owner/repo/abc123def/Solution.java",
          solutionPermalink: "https://github.com/owner/repo/blob/abc123def/Solution.java",
          solutionPathKey: "a".repeat(64),
          solutionContentKey: "b".repeat(64),
          notes: "hash map",
          githubUrl: "https://github.com/owner/repo/blob/master/Solution.java",
        }),
      ]),
    ]);

    const solver = getProblemSolutionDetail("leetcode", "1", data, fixtureCatalog)?.solvers[0];

    expect(solver?.user).toEqual({ id: "ada", displayName: "ada", githubUsername: "ada", active: true });
    expect(solver?.submission).toEqual({
      id: "ada:leetcode:1",
      status: SubmissionStatus.SOLVED,
      language: "Java",
      submittedAt: "2024-01-06T00:00:00.000Z",
      solutionRawUrl: "https://raw.githubusercontent.com/owner/repo/abc123def/Solution.java",
      solutionPermalink: "https://github.com/owner/repo/blob/abc123def/Solution.java",
      solutionPathKey: "a".repeat(64),
      solutionContentKey: "b".repeat(64),
    });
    expect(solver?.submission).not.toHaveProperty("notes");
    expect(solver?.submission).not.toHaveProperty("githubUrl");
    expect(solver?.submission).not.toHaveProperty("solutionPath");
    expect(solver?.submission).not.toHaveProperty("readmePath");
    expect(solver?.submission).not.toHaveProperty("source");
    expect(solver?.submission).not.toHaveProperty("rawMeta");
  });

  it("omits absent optional solver fields entirely", () => {
    const data = progressData([
      user("ada", [submission({ userId: "ada", id: "ada:leetcode:1", problemKey: "leetcode:1" })]),
    ]);

    const solver = getProblemSolutionDetail("leetcode", "1", data, fixtureCatalog)?.solvers[0];

    expect(solver?.submission).not.toHaveProperty("language");
    expect(solver?.submission).not.toHaveProperty("submittedAt");
    expect(solver?.submission).not.toHaveProperty("solutionRawUrl");
    expect(solver?.submission).not.toHaveProperty("solutionPermalink");
    expect(solver?.submission).not.toHaveProperty("solutionPathKey");
    expect(solver?.submission).not.toHaveProperty("solutionContentKey");
  });
});

describe("comparable problem index over current progress data", () => {
  it("derives far fewer params than the full catalog without hard-coding counts", () => {
    const params = listComparableProblemParams();

    expect(params.length).toBeGreaterThan(0);
    expect(params.length).toBeLessThan(catalog.problems.length);
    expect(new Set(params.map((param) => `${param.provider}:${param.problemId}`)).size).toBe(params.length);
  });

  it("returns a multi-solver detail with minimal metadata and no bodies", () => {
    const params = listComparableProblemParams();
    const multiSolver = params.find((param) => {
      const detail = getProblemSolutionDetail(param.provider, param.problemId);
      return (detail?.solvers.length ?? 0) >= 2;
    });

    expect(multiSolver).toBeDefined();
    if (!multiSolver) {
      return;
    }

    const detail = getProblemSolutionDetail(multiSolver.provider, multiSolver.problemId);
    expect(detail?.problem.problemKey).toBe(`${multiSolver.provider}:${multiSolver.problemId}`);
    expect(detail?.users.length).toBeGreaterThan(0);
    for (const solver of detail?.solvers ?? []) {
      expect(solver.user.id).toBeTruthy();
      expect(solver.submission.id).toBeTruthy();
      expect(solver.submission).not.toHaveProperty("solutionPath");
      expect(solver.submission).not.toHaveProperty("notes");
      expect(solver.submission).not.toHaveProperty("source");
    }
  });

  it("returns null for a real catalog problem with zero submissions", () => {
    const submittedKeys = new Set(
      listComparableProblemParams().map((param) => `${param.provider}:${param.problemId}`),
    );
    const unsubmitted = catalog.problems.find(
      (problem) => !submittedKeys.has(`${problem.provider}:${problem.problemId}`),
    );

    expect(unsubmitted).toBeDefined();
    if (!unsubmitted) {
      return;
    }

    expect(getProblemSolutionDetail(unsubmitted.provider, unsubmitted.problemId)).toBeNull();
  });
});
