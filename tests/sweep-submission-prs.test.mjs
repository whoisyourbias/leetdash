import { describe, expect, it } from "vitest";

import { GitHubClient, evaluatePullRequest, sweepSubmissionPullRequests } from "../scripts/sweep-submission-prs.mjs";

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
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("rejects another user's submission path", () => {
    const decision = evaluatePullRequest({
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
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [{ ...validFile, status: "removed" }],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({
      eligible: false,
      reason: "submissions/ada/top-interview-easy/1/Solution.java: submission-only PRs may add or update files, not delete them or rename them.",
    });
  });

  it("rejects renamed files even under the author path", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [{ ...validFile, status: "renamed", previous_filename: "submissions/ada/top-interview-easy/1/solution.jvaa" }],
      checkRuns: successfulChecks,
      users,
      catalog,
    });

    expect(decision).toEqual({
      eligible: false,
      reason: "submissions/ada/top-interview-easy/1/Solution.java: submission-only PRs may add or update files, not delete them or rename them.",
    });
  });

  it("requires a successful validate check", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [{ name: "validate", conclusion: "failure" }],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "validate check is not successful for abc123." });
  });

  it("requires an opencode-review check", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0]],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review check is not successful for abc123." });
  });

  it("requires the opencode-review check to complete successfully", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0], { name: "opencode-review", status: "in_progress", conclusion: null }],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review check is not successful for abc123." });
  });

  it("rejects a failed opencode-review check", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0], { name: "opencode-review", status: "completed", conclusion: "failure" }],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review check is not successful for abc123." });
  });

  it.each([
    ["failed", { status: "completed", conclusion: "failure" }],
    ["in progress", { status: "in_progress", conclusion: null }],
  ])("lets a newer %s run mask an older successful run", (_name, newestState) => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [
        successfulChecks[0],
        successfulChecks[1],
        { ...successfulChecks[1], id: 202, ...newestState },
      ],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review check is not successful for abc123." });
  });

  it("does not accept a successful exact-name run from another GitHub App", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [
        successfulChecks[0],
        { ...successfulChecks[1], app: { slug: "untrusted-review-app" } },
      ],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review check is not successful for abc123." });
  });

  it.each([
    ["missing app provenance", { ...successfulChecks[1], app: undefined }],
    ["ambiguous latest run", [successfulChecks[1], { ...successfulChecks[1], conclusion: "failure" }]],
  ])("rejects %s", (_name, reviewRuns) => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulChecks[0], ...(Array.isArray(reviewRuns) ? reviewRuns : [reviewRuns])],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "opencode-review check is not successful for abc123." });
  });

  it("normalizes comma-separated required check names while preserving their order", () => {
    const decision = evaluatePullRequest({
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
    const decision = evaluatePullRequest({
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
    const decision = evaluatePullRequest({
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
  constructor({ pullRequests, filesByNumber, checkRunsBySha, failedMerges = new Set() }) {
    this.pullRequests = pullRequests;
    this.filesByNumber = filesByNumber;
    this.checkRunsBySha = checkRunsBySha;
    this.failedMerges = failedMerges;
    this.pullRequestCalls = [];
    this.fileCalls = [];
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
    expect(client.mergeCalls).toEqual([{ number: 7, sha: "sha-8" }]);
  });
});

describe("GitHubClient check-run retrieval", () => {
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

  it("re-fetches checks immediately before merge and stops when a rerun starts", async () => {
    const client = new FakeGitHubClient({
      pullRequests: [makePullRequest({ number: 7, head: { sha: "sha-7" } })],
      filesByNumber: { 7: [validFile] },
      checkRunsBySha: { "sha-7": successfulChecks },
    });
    let checkCalls = 0;
    client.listCheckRuns = async (sha) => {
      client.checkRunCalls ??= [];
      client.checkRunCalls.push(sha);
      checkCalls += 1;
      return checkCalls === 1
        ? successfulChecks
        : [...successfulChecks, { ...successfulChecks[1], id: 202, status: "in_progress", conclusion: null }];
    };

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result).toEqual({
      mergedCount: 0,
      results: [{ number: 7, status: "skipped", reason: "opencode-review check is not successful for sha-7." }],
    });
    expect(client.checkRunCalls).toEqual(["sha-7", "sha-7"]);
    expect(client.mergeCalls).toEqual([]);
  });
});
