import { describe, expect, it } from "vitest";

import { evaluatePullRequest, sweepSubmissionPullRequests } from "../scripts/sweep-submission-prs.mjs";

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

const successfulValidateCheck = { name: "validate", status: "completed", conclusion: "success" };

function makePullRequest(overrides = {}) {
  return {
    number: 42,
    user: { login: "ada" },
    draft: false,
    base: { ref: "master" },
    head: { sha: "abc123" },
    mergeable_state: "clean",
    ...overrides,
  };
}

describe("submission PR sweeper eligibility", () => {
  it("marks an author-owned submission PR with a successful validate check as eligible", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [validFile],
      checkRuns: [successfulValidateCheck],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: true });
  });

  it("rejects another user's submission path", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest(),
      files: [{ filename: "submissions/grace/top-interview-easy/1/Solution.java", status: "modified" }],
      checkRuns: [successfulValidateCheck],
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
      checkRuns: [successfulValidateCheck],
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
      checkRuns: [successfulValidateCheck],
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

  it("skips draft pull requests", () => {
    const decision = evaluatePullRequest({
      pullRequest: makePullRequest({ draft: true }),
      files: [validFile],
      checkRuns: [successfulValidateCheck],
      users,
      catalog,
    });

    expect(decision).toEqual({ eligible: false, reason: "pull request is a draft." });
  });
});

class FakeGitHubClient {
  constructor({ pullRequests, filesByNumber, checkRunsBySha, failedMerges = new Set() }) {
    this.pullRequests = pullRequests;
    this.filesByNumber = filesByNumber;
    this.checkRunsBySha = checkRunsBySha;
    this.failedMerges = failedMerges;
    this.mergeCalls = [];
    this.dispatchCalls = [];
  }

  async listOpenPullRequests() {
    return this.pullRequests.map((pullRequest) => ({ number: pullRequest.number }));
  }

  async getPullRequest(number) {
    return this.pullRequests.find((pullRequest) => pullRequest.number === number);
  }

  async listPullRequestFiles(number) {
    return this.filesByNumber[number] ?? [];
  }

  async listCheckRuns(sha) {
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
      checkRunsBySha: { "sha-7": [successfulValidateCheck] },
    });

    const result = await sweepSubmissionPullRequests({ client, users, catalog });

    expect(result.mergedCount).toBe(1);
    expect(client.mergeCalls).toEqual([{ number: 7, sha: "sha-7" }]);
    expect(client.dispatchCalls).toEqual([{ workflowFile: "deploy-pages.yml", ref: "master" }]);
  });

  it("continues scanning after a merge failure and deploys when another PR merges", async () => {
    const firstPullRequest = makePullRequest({ number: 7, head: { sha: "sha-7" } });
    const secondPullRequest = makePullRequest({ number: 8, head: { sha: "sha-8" } });
    const client = new FakeGitHubClient({
      pullRequests: [firstPullRequest, secondPullRequest],
      filesByNumber: { 7: [validFile], 8: [validFile] },
      checkRunsBySha: { "sha-7": [successfulValidateCheck], "sha-8": [successfulValidateCheck] },
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
});
