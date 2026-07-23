import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  assertNoMergeFailures,
  GitHubClient,
  evaluatePullRequest,
  main,
  sweepSubmissionPullRequests,
} from "../scripts/sweep-submission-prs.mjs";

const validFile = {
  filename: "submissions/ada/top-interview-easy/1/Solution.java",
  status: "modified",
};

const users = {
  users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
};

const catalog = {
  lists: [{ key: "top-interview-easy", items: [{ slug: "two-sum", submissionKey: "1" }] }],
};

const successfulChecks = [
  { id: 101, name: "validate", status: "completed", conclusion: "success", app: { slug: "github-actions" } },
  { id: 201, name: "opencode-review", status: "completed", conclusion: "success", app: { slug: "github-actions" } },
];

function makeSuccessfulReviewRun(sha = "abc123", id = 901, runAttempt = 1) {
  return {
    id,
    run_attempt: runAttempt,
    display_title: `opencode-review:${sha}`,
    status: "completed",
    conclusion: "success",
    html_url: `https://github.com/leetdash/test/actions/runs/${id}`,
    run_started_at: new Date(Date.UTC(2026, 0, 1) + id * 1000).toISOString(),
  };
}

function makeSuccessfulStatus(reviewRun = makeSuccessfulReviewRun(), id = 301) {
  return {
    id,
    context: "opencode-review-gate",
    state: "success",
    creator: { login: "github-actions[bot]" },
    target_url: `${reviewRun.html_url}?attempt=${reviewRun.run_attempt}`,
  };
}

const successfulReviewRuns = [makeSuccessfulReviewRun()];
const successfulStatuses = [
  makeSuccessfulStatus(successfulReviewRuns[0]),
];

function evaluate(options) {
  return evaluatePullRequest({
    commitStatuses: successfulStatuses,
    reviewWorkflowRuns: successfulReviewRuns,
    ...options,
  });
}

function makePullRequest(overrides = {}) {
  return {
    number: 42,
    changed_files: 1,
    user: { login: "ada" },
    draft: false,
    base: { ref: "master" },
    head: { sha: "abc123" },
    mergeable_state: "clean",
    ...overrides,
  };
}

describe("submission PR sweeper eligibility", () => {
  it("marks an author-owned submission PR with successful required checks as eligible", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("does not require the detailed opencode-review Check Run", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("rejects another user's submission path", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [{ filename: "submissions/grace/top-interview-easy/1/Solution.java", status: "modified" }],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({
      eligible: false,
      reason: "submissions/grace/top-interview-easy/1/Solution.java: submission path must belong to a registered user in data/users.json.",
    });
  });

  it("rejects removed files even under the author path", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [{ ...validFile, status: "removed" }],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({
      eligible: false,
      reason: "submissions/ada/top-interview-easy/1/Solution.java: submission-only PRs may add, update, or rename files, not delete them.",
    });
  });

  it("accepts renamed files with a valid destination under the author path", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [{ ...validFile, status: "renamed", previous_filename: "submissions/ada/top-interview-easy/1/solution.jvaa" }],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("rejects a renamed file whose destination belongs to another user", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [{
        filename: "submissions/grace/top-interview-easy/1/Solution.java",
        status: "renamed",
        previous_filename: "submissions/ada/top-interview-easy/1/Solution.java",
      }],
      checkRuns: successfulChecks,
      users: {
        users: [
          ...users.users,
          { id: "grace", displayName: "Grace Hopper", githubUsername: "grace" },
        ],
      },
      catalog,
    });

    expect(decision).toEqual({
      eligible: false,
      reason: "submissions/grace/top-interview-easy/1/Solution.java: belongs to grace, not pull request author ada.",
    });
  });

  it("requires a successful validate check", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [{ name: "validate", conclusion: "failure" }],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "validate check is not successful for abc123." });
  });

  it.each([
    ["missing", []],
    ["pending", [{ ...successfulStatuses[0], state: "pending" }]],
    ["failed", [{ ...successfulStatuses[0], state: "failure" }]],
    ["malformed ID", [{ ...successfulStatuses[0], id: "301" }]],
    ["wrong creator", [{ ...successfulStatuses[0], creator: { login: "untrusted-bot" } }]],
    ["ambiguous latest status", [successfulStatuses[0], { ...successfulStatuses[0], state: "failure" }]],
  ])("rejects a %s OpenCode review gate", (_name, commitStatuses) => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      commitStatuses,
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review-gate status is not successful for abc123." });
  });

  it("lets a newer pending gate mask an older successful gate", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      commitStatuses: [successfulStatuses[0], { ...successfulStatuses[0], id: 302, state: "pending" }],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review-gate status is not successful for abc123." });
  });

  it("rejects an old successful gate when a newer review workflow run failed before publishing pending", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      reviewWorkflowRuns: [
        successfulReviewRuns[0],
        { ...makeSuccessfulReviewRun("abc123", 902), conclusion: "failure" },
      ],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review-gate status is not successful for abc123." });
  });

  it("rejects an old successful gate when the latest workflow rerun has a newer attempt", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      reviewWorkflowRuns: [{
        ...makeSuccessfulReviewRun("abc123", 901, 2),
        conclusion: "failure",
        run_started_at: "2026-01-02T00:00:00.000Z",
      }],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review-gate status is not successful for abc123." });
  });

  it("rejects a newer attempt of an older run ID when its pending status was not published", () => {
    const successfulRun = makeSuccessfulReviewRun("abc123", 902, 1);
    const rerun = {
      ...makeSuccessfulReviewRun("abc123", 901, 2),
      conclusion: "failure",
      run_started_at: "2026-01-02T00:00:00.000Z",
    };
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      commitStatuses: [makeSuccessfulStatus(successfulRun)],
      reviewWorkflowRuns: [successfulRun, rerun],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review-gate status is not successful for abc123." });
  });

  it("accepts a successful rerun when the status targets the same run attempt", () => {
    const rerun = {
      ...makeSuccessfulReviewRun("abc123", 901, 2),
      run_started_at: "2026-01-02T00:00:00.000Z",
    };
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      commitStatuses: [makeSuccessfulStatus(rerun)],
      reviewWorkflowRuns: [rerun],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: true });
  });

  it.each([
    ["queued latest run", successfulStatuses, [{ ...successfulReviewRuns[0], status: "queued", conclusion: null }]],
    ["failed latest run", successfulStatuses, [{ ...successfulReviewRuns[0], conclusion: "failure" }]],
    ["mismatched target URL", [{ ...successfulStatuses[0], target_url: `${successfulReviewRuns[0].html_url}?attempt=2` }], successfulReviewRuns],
    ["malformed run attempt", successfulStatuses, [{ ...successfulReviewRuns[0], run_attempt: "1" }]],
    ["malformed run start time", successfulStatuses, [{ ...successfulReviewRuns[0], run_started_at: "not-a-date" }]],
    ["ambiguous latest run", successfulStatuses, [successfulReviewRuns[0], { ...successfulReviewRuns[0] }]],
  ])("rejects a gate with %s", (_name, commitStatuses, reviewWorkflowRuns) => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      commitStatuses,
      reviewWorkflowRuns,
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review-gate status is not successful for abc123." });
  });

  it.each([
    ["older", { ...successfulStatuses[0], id: 300, creator: { login: "foreign-bot" } }],
    ["newer", { ...successfulStatuses[0], id: 302, creator: { login: "foreign-bot" } }],
  ])("ignores a well-formed %s foreign status when the trusted gate succeeds", (_name, foreignStatus) => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      commitStatuses: [foreignStatus, successfulStatuses[0]],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("falls back to the default review gate for a blank required-status configuration", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      users,
      catalog,
      requiredStatuses: " , ",
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("normalizes comma-separated required check names while preserving their order", () => {
    const decision = evaluate({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[1]],
      users,
      catalog,
      requiredChecks: " opencode-review, , ",
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("skips draft pull requests", () => {
    const decision = evaluate({
      pullRequest: makePullRequest({ draft: true }),
      files: [validFile],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "pull request is a draft." });
  });

  it.each([
    ["missing count", undefined, [validFile]],
    ["non-numeric count", "1", [validFile]],
    ["negative count", -1, [validFile]],
    ["fractional count", 1.5, [validFile]],
    ["unsafe integer count", Number.MAX_SAFE_INTEGER + 1, [validFile]],
    ["mismatched count", 2, [validFile]],
    ["count beyond the GitHub Files API limit", 3001, Array.from({ length: 3000 }, () => validFile)],
  ])("rejects %s when the fetched PR file list cannot be complete", (_name, changedFilesCount, files) => {
    const decision = evaluate({
      pullRequest: makePullRequest({ changed_files: changedFilesCount }),
      files,
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({
      eligible: false,
      reason: "pull request file list is incomplete.",
    });
  });
});

class FakeGitHubClient {
  constructor({ pullRequests, filesByNumber, checkRunsBySha, statusesBySha, reviewWorkflowRuns, failedMerges = new Set() }) {
    this.pullRequests = pullRequests;
    this.filesByNumber = filesByNumber;
    this.checkRunsBySha = checkRunsBySha;
    const runsBySha = Object.fromEntries(
      Object.keys(checkRunsBySha).map((sha, index) => [sha, makeSuccessfulReviewRun(sha, 901 + index)]),
    );
    this.reviewWorkflowRuns = reviewWorkflowRuns ?? Object.values(runsBySha);
    this.workflowRunsById = Object.fromEntries(this.reviewWorkflowRuns.map((run) => [run.id, run]));
    this.statusesBySha = statusesBySha ?? Object.fromEntries(
      Object.entries(runsBySha).map(([sha, reviewRun]) => [sha, [makeSuccessfulStatus(reviewRun)]]),
    );
    this.failedMerges = failedMerges;
    this.pullRequestCalls = [];
    this.fileCalls = [];
    this.statusCalls = [];
    this.workflowRunCalls = [];
    this.workflowRunDetailCalls = [];
    this.mergeCalls = [];
    this.dispatchCalls = [];
  }

  async listOpenPullRequests() {
    return this.pullRequests.map((pullRequest) => ({ number: pullRequest.number }));
  }

  async getPullRequest(number) {
    this.pullRequestCalls.push(number);
    return this.pullRequests.find((pullRequest) => pullRequest.number === number);
  }

  async listPullRequestFiles(number) {
    this.fileCalls.push(number);
    return this.filesByNumber[number] ?? [];
  }

  async listCheckRuns(sha) {
    this.checkRunCalls ??= [];
    this.checkRunCalls.push(sha);
    return this.checkRunsBySha[sha] ?? [];
  }

  async listCommitStatuses(sha) {
    this.statusCalls.push(sha);
    return this.statusesBySha[sha] ?? [];
  }

  async listWorkflowRuns(workflowFile) {
    this.workflowRunCalls.push(workflowFile);
    return this.reviewWorkflowRuns;
  }

  async getWorkflowRun(runId) {
    this.workflowRunDetailCalls.push(runId);
    return this.workflowRunsById[runId];
  }

  async mergePullRequest(number, sha) {
    this.mergeCalls.push({ number, sha });
    if (this.failedMerges.has(number)) {
      throw new Error("Head branch was modified.");
    }
  }

  async dispatchWorkflow(workflowFile, ref) {
    this.dispatchCalls.push({ workflowFile, ref });
  }
}

describe("submission PR sweeper orchestration", () => {
  it("merges eligible PRs with the exact head SHA and dispatches deploy once", async () => {
    const client = new FakeGitHubClient({
      pullRequests: [makePullRequest({ number: 7, head: { sha: "sha-7" } })],
      filesByNumber: { 7: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks },
    });

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result.mergedCount).toBe(1);
    expect(client.pullRequestCalls).toEqual([7, 7]);
    expect(client.fileCalls).toEqual([7, 7]);
    expect(client.mergeCalls).toEqual([{ number: 7, sha: "sha-7" }]);
    expect(client.checkRunCalls).toEqual(["sha-7", "sha-7"]);
    expect(client.statusCalls).toEqual(["sha-7", "sha-7"]);
    expect(client.dispatchCalls).toEqual([{ workflowFile: "deploy-pages.yml", ref: "master" }]);
  });

  it("continues scanning after a merge failure and deploys when another PR merges", async () => {
    const firstPullRequest = makePullRequest({ number: 7, head: { sha: "sha-7" } });
    const secondPullRequest = makePullRequest({ number: 8, head: { sha: "sha-8" } });
    const client = new FakeGitHubClient({
      pullRequests: [firstPullRequest, secondPullRequest],
      filesByNumber: { 7: [validFile], 8: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks, "sha-8": successfulChecks },
      failedMerges: new Set([7]),
    });

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result.mergedCount).toBe(1);
    expect(result.results).toEqual([
      { number: 7, status: "merge_failed", reason: expect.stringContaining("Head branch was modified.") },
      { number: 8, status: "merged" },
    ]);
    expect(client.mergeCalls).toEqual([
      { number: 7, sha: "sha-7" },
      { number: 8, sha: "sha-8" },
    ]);
    expect(client.dispatchCalls).toEqual([{ workflowFile: "deploy-pages.yml", ref: "master" }]);
  });

  it("does not dispatch deploy when no PRs are merged", async () => {
    const client = new FakeGitHubClient({
      pullRequests: [makePullRequest({ number: 7, head: { sha: "sha-7" } })],
      filesByNumber: { 7: [validFile] },
      checkRunsBySha: { "sha-7": [{ name: "validate", status: "completed", conclusion: "failure" }] },
    });

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result.mergedCount).toBe(0);
    expect(client.mergeCalls).toEqual([]);
    expect(client.dispatchCalls).toEqual([]);
  });

  it.each([
    [
      "draft status",
      makePullRequest({ number: 7, draft: true, head: { sha: "sha-7", repo: { full_name: "fork-user/leetdash" } } }),
      [validFile],
      "pull request is a draft.",
    ],
    [
      "base branch",
      makePullRequest({ number: 7, base: { ref: "release" }, head: { sha: "sha-7", repo: { full_name: "fork-user/leetdash" } } }),
      [validFile],
      "base branch is release, not master.",
    ],
    [
      "author ownership and repository",
      makePullRequest({ number: 7, user: { login: "grace" }, head: { sha: "sha-7", repo: { full_name: "grace/leetdash" } } }),
      [validFile],
      "pull request author grace is not registered in data/users.json.",
    ],
    [
      "file-count metadata",
      makePullRequest({ number: 7, changed_files: 2, head: { sha: "sha-7", repo: { full_name: "fork-user/leetdash" } } }),
      [validFile],
      "pull request file list is incomplete.",
    ],
    [
      "changed file ownership",
      makePullRequest({ number: 7, head: { sha: "sha-7", repo: { full_name: "fork-user/leetdash" } } }),
      [{ ...validFile, filename: "submissions/grace/top-interview-easy/1/Solution.java" }],
      "submissions/grace/top-interview-easy/1/Solution.java: submission path must belong to a registered user in data/users.json.",
    ],
  ])("does not let the initial snapshot authorize merge after refreshed %s changes", async (_name, refreshedPullRequest, refreshedFiles, reason) => {
    const initialPullRequest = makePullRequest({ number: 7, head: { sha: "sha-7", repo: { full_name: "ada/leetdash" } } });
    const client = new FakeGitHubClient({
      pullRequests: [initialPullRequest],
      filesByNumber: { 7: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks },
    });
    let pullRequestReads = 0;
    client.getPullRequest = async (number) => {
      client.pullRequestCalls.push(number);
      pullRequestReads += 1;
      return pullRequestReads === 1 ? initialPullRequest : refreshedPullRequest;
    };
    let fileReads = 0;
    client.listPullRequestFiles = async (number) => {
      client.fileCalls.push(number);
      fileReads += 1;
      return fileReads === 1 ? [validFile] : refreshedFiles;
    };

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result).toEqual({
      mergedCount: 0,
      results: [{ number: 7, status: "skipped", reason }],
    });
    expect(client.pullRequestCalls).toEqual([7, 7]);
    expect(client.fileCalls).toEqual([7, 7]);
    expect(client.mergeCalls).toEqual([]);
  });

  it("uses the refreshed head SHA for refreshed files, checks, and the exact merge", async () => {
    const initialPullRequest = makePullRequest({ number: 7, head: { sha: "sha-7", repo: { full_name: "ada/leetdash" } } });
    const refreshedPullRequest = makePullRequest({ number: 7, head: { sha: "sha-8", repo: { full_name: "ada/leetdash" } } });
    const client = new FakeGitHubClient({
      pullRequests: [initialPullRequest],
      filesByNumber: { 7: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks, "sha-8": successfulChecks },
    });
    let pullRequestReads = 0;
    client.getPullRequest = async (number) => {
      client.pullRequestCalls.push(number);
      pullRequestReads += 1;
      return pullRequestReads === 1 ? initialPullRequest : refreshedPullRequest;
    };

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result.mergedCount).toBe(1);
    expect(client.pullRequestCalls).toEqual([7, 7]);
    expect(client.fileCalls).toEqual([7, 7]);
    expect(client.checkRunCalls).toEqual(["sha-7", "sha-8"]);
    expect(client.statusCalls).toEqual(["sha-7", "sha-8"]);
    expect(client.mergeCalls).toEqual([{ number: 7, sha: "sha-8" }]);
  });
});

describe("submission PR sweeper CLI outcome", () => {
  it("rejects only after scanning remaining PRs and dispatching deploy for successful merges", async () => {
    const client = new FakeGitHubClient({
      pullRequests: [
        makePullRequest({ number: 7, head: { sha: "sha-7" } }),
        makePullRequest({ number: 8, head: { sha: "sha-8" } }),
      ],
      filesByNumber: { 7: [validFile], 8: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks, "sha-8": successfulChecks },
      failedMerges: new Set([7]),
    });

    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "sweep-cli-"));
    const summaryPath = path.join(temporaryDirectory, "summary.md");
    try {
      await expect(main({
        env: {
          GITHUB_TOKEN: "test-token",
          GITHUB_REPOSITORY: "leetdash/test",
          GITHUB_STEP_SUMMARY: summaryPath,
        },
        client,
        users,
        catalog,
      })).rejects.toThrow("1 pull request failed to merge.");

      const summary = await readFile(summaryPath, "utf8");
      expect(summary).toContain("| #7 | merge_failed | Head branch was modified. |");
      expect(summary).toContain("| #8 | merged |  |");
      expect(client.mergeCalls).toEqual([
        { number: 7, sha: "sha-7" },
        { number: 8, sha: "sha-8" },
      ]);
      expect(client.dispatchCalls).toEqual([{ workflowFile: "deploy-pages.yml", ref: "master" }]);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("throws a sanitized aggregate error after one merge failure", () => {
    expect(() => assertNoMergeFailures({
      mergedCount: 1,
      results: [
        { number: 7, status: "merge_failed", reason: "sensitive upstream detail" },
        { number: 8, status: "merged" },
      ],
    })).toThrow("1 pull request failed to merge.");

    try {
      assertNoMergeFailures({
        mergedCount: 0,
        results: [{ number: 7, status: "merge_failed", reason: "sensitive upstream detail" }],
      });
    } catch (error) {
      expect(error.message).not.toContain("sensitive upstream detail");
    }
  });

  it("does not throw when all pull requests merge or skip normally", () => {
    expect(() => assertNoMergeFailures({
      mergedCount: 1,
      results: [
        { number: 7, status: "merged" },
        { number: 8, status: "skipped", reason: "review pending" },
      ],
    })).not.toThrow();
  });
});

describe("GitHubClient check-run retrieval", () => {
  it("preserves safe GitHub response headers when a request fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({ message: "Resource not accessible by personal access token" }),
      {
        status: 403,
        headers: {
          "retry-after": "60",
          "x-github-request-id": "REQ-123",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1784820000",
        },
      },
    );

    try {
      const client = new GitHubClient({ repository: "leetdash/test", token: "test-token" });
      await expect(client.getPullRequest(58)).rejects.toThrow(
        "request_id=REQ-123 retry_after=60 rate_limit_remaining=0 rate_limit_reset=1784820000",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetches all check runs once from the exact head SHA without filtering by name", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url) => {
      requests.push(new URL(url));
      return new Response(JSON.stringify({ check_runs: successfulChecks }), { status: 200 });
    };

    try {
      const client = new GitHubClient({ repository: "leetdash/test", token: "test-token" });
      await expect(client.listCheckRuns("abc123")).resolves.toEqual(successfulChecks);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toBe("/repos/leetdash/test/commits/abc123/check-runs");
    expect(requests[0].searchParams.get("check_name")).toBeNull();
  });

  it("fetches all commit statuses from the exact head SHA without filtering by context", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url) => {
      const requestUrl = new URL(url);
      requests.push(requestUrl);
      const page = Number(requestUrl.searchParams.get("page"));
      const statuses = page === 1
        ? Array.from({ length: 100 }, (_, index) => ({ ...successfulStatuses[0], id: index + 1 }))
        : [{ ...successfulStatuses[0], id: 101 }];
      return new Response(JSON.stringify(statuses), { status: 200 });
    };

    try {
      const client = new GitHubClient({ repository: "leetdash/test", token: "test-token" });
      const statuses = await client.listCommitStatuses("abc123");
      expect(statuses).toHaveLength(101);
      expect(statuses.at(-1)).toMatchObject({ id: 101, context: "opencode-review-gate" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requests).toHaveLength(2);
    requests.forEach((request, index) => {
      expect(request.pathname).toBe("/repos/leetdash/test/commits/abc123/statuses");
      expect(request.searchParams.get("context")).toBeNull();
      expect(request.searchParams.get("page")).toBe(String(index + 1));
      expect(request.searchParams.get("per_page")).toBe("100");
    });
  });

  it("fetches all OpenCode review workflow runs with pagination", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url) => {
      const requestUrl = new URL(url);
      requests.push(requestUrl);
      const page = Number(requestUrl.searchParams.get("page"));
      const workflowRuns = page === 1
        ? Array.from({ length: 100 }, (_, index) => makeSuccessfulReviewRun(`sha-${index}`, index + 1))
        : [makeSuccessfulReviewRun("sha-100", 101)];
      return new Response(JSON.stringify({ workflow_runs: workflowRuns }), { status: 200 });
    };

    try {
      const client = new GitHubClient({ repository: "leetdash/test", token: "test-token" });
      const workflowRuns = await client.listWorkflowRuns("opencode-review.yml");
      expect(workflowRuns).toHaveLength(101);
      expect(workflowRuns.at(-1)).toMatchObject({ id: 101, display_title: "opencode-review:sha-100" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requests).toHaveLength(2);
    requests.forEach((request, index) => {
      expect(request.pathname).toBe("/repos/leetdash/test/actions/workflows/opencode-review.yml/runs");
      expect(request.searchParams.get("event")).toBe("workflow_run");
      expect(request.searchParams.get("page")).toBe(String(index + 1));
      expect(request.searchParams.get("per_page")).toBe("100");
    });
  });

  it("rejects a malformed OpenCode workflow-runs response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ workflow_runs: null }), { status: 200 });

    try {
      const client = new GitHubClient({ repository: "leetdash/test", token: "test-token" });
      await expect(client.listWorkflowRuns("opencode-review.yml")).rejects.toThrow("GitHub workflow runs response is malformed.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetches an exact workflow run by ID", async () => {
    const originalFetch = globalThis.fetch;
    const reviewRun = makeSuccessfulReviewRun("sha-7", 901, 2);
    let requestUrl;
    globalThis.fetch = async (url) => {
      requestUrl = new URL(url);
      return new Response(JSON.stringify(reviewRun), { status: 200 });
    };

    try {
      const client = new GitHubClient({ repository: "leetdash/test", token: "test-token" });
      await expect(client.getWorkflowRun(901)).resolves.toEqual(reviewRun);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requestUrl.pathname).toBe("/repos/leetdash/test/actions/runs/901");
  });

  it("re-fetches statuses immediately before merge and stops when a review rerun starts", async () => {
    const client = new FakeGitHubClient({
      pullRequests: [makePullRequest({ number: 7, head: { sha: "sha-7" } })],
      filesByNumber: { 7: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks },
    });
    let statusCalls = 0;
    client.listCommitStatuses = async (sha) => {
      client.statusCalls.push(sha);
      statusCalls += 1;
      return statusCalls === 1
        ? successfulStatuses
        : [...successfulStatuses, { ...successfulStatuses[0], id: 302, state: "pending" }];
    };

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result).toEqual({
      mergedCount: 0,
      results: [{ number: 7, status: "skipped", reason: "opencode-review-gate status is not successful for sha-7." }],
    });
    expect(client.checkRunCalls).toEqual(["sha-7", "sha-7"]);
    expect(client.statusCalls).toEqual(["sha-7", "sha-7"]);
    expect(client.mergeCalls).toEqual([]);
  });

  it("re-fetches workflow attempts immediately before merge and rejects a stale successful gate", async () => {
    const initialRun = makeSuccessfulReviewRun("sha-7", 901, 1);
    const client = new FakeGitHubClient({
      pullRequests: [makePullRequest({ number: 7, head: { sha: "sha-7" } })],
      filesByNumber: { 7: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks },
      statusesBySha: { "sha-7": [makeSuccessfulStatus(initialRun)] },
      reviewWorkflowRuns: [initialRun],
    });
    let workflowRunCalls = 0;
    client.listWorkflowRuns = async (workflowFile) => {
      client.workflowRunCalls.push(workflowFile);
      workflowRunCalls += 1;
      return workflowRunCalls === 1
        ? [initialRun]
        : [];
    };
    client.getWorkflowRun = async (runId) => {
      client.workflowRunDetailCalls.push(runId);
      return {
        ...initialRun,
        run_attempt: 2,
        conclusion: "failure",
        run_started_at: "2026-01-02T00:00:00.000Z",
      };
    };

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result).toEqual({
      mergedCount: 0,
      results: [{ number: 7, status: "skipped", reason: "opencode-review-gate status is not successful for sha-7." }],
    });
    expect(client.workflowRunCalls).toEqual(["opencode-review.yml", "opencode-review.yml"]);
    expect(client.workflowRunDetailCalls).toEqual([901]);
    expect(client.mergeCalls).toEqual([]);
  });
});
