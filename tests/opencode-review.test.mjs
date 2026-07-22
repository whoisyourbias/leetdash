import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const { reviewPullRequest } = await import("../scripts/opencode-review.mjs");
const { GitHubDeliveryFailure } = await import("../scripts/opencode-review-clients.mjs");
const { ReviewFailure } = await import("../scripts/opencode-review-core.mjs");
const { isSubmissionArtifactName } = await import("../scripts/validate-submission-pr.mjs");
const execFileAsync = promisify(execFile);
const scriptPath = path.resolve("scripts/opencode-review.mjs");

const firstPath = "submissions/ada/top-interview-easy/1/solution.java";
const secondPath = "submissions/grace/top-interview-easy/1/solution.java";

const catalog = {
  lists: [{ key: "top-interview-easy", items: [{ submissionKey: "1", slug: "two-sum" }] }],
  problems: [{ slug: "two-sum", leetcodeId: 1, title: "Two Sum", difficulty: "Easy" }],
};
const question = {
  content: "Find two numbers.",
  exampleTestcases: "[2,7,11,15]\n9",
  metaData: JSON.stringify({ name: "twoSum" }),
  codeSnippets: [{ langSlug: "java", code: "class Solution {}" }],
  topicTags: [],
};
function passResult(path) {
  return JSON.stringify({
    schema_version: 1,
    verdict: "PASS",
    path,
    summary: "Correct.",
    correctness: { status: "PASS", reason: "Matches the contract." },
    complexity: { time: "O(n)", space: "O(n)", acceptable: true, reason: "Within limits." },
    blocking_findings: [],
    non_blocking_suggestions: [],
  });
}

function failResult(path) {
  return JSON.stringify({
    schema_version: 1,
    verdict: "FAIL",
    path,
    summary: "The duplicate is returned twice.",
    correctness: { status: "FAIL", reason: "The same index is reused." },
    complexity: { time: "O(n)", space: "O(n)", acceptable: true, reason: "Within limits." },
    blocking_findings: [{
      category: "correctness",
      reason: "Returns one index twice.",
      evidence: "The second lookup accepts the current element.",
      counterexample: { input: "[3,3]\n6", expected: "[0,1]", actual: "[0,0]" },
    }],
    non_blocking_suggestions: [],
  });
}

function reviewOptions(overrides = {}) {
  const completed = [];
  const comments = [];
  return {
    completed,
    comments,
    options: {
      githubClient: {
        createCheck: async () => ({ id: 17 }),
        completeCheck: async (value) => { completed.push(value); },
        upsertReviewComment: async (value) => { comments.push(value); },
      },
      leetcodeClient: { getQuestion: async () => question },
      openCodeClient: { review: async () => passResult(firstPath) },
      readFile: async () => "class Solution {}",
      catalog,
      changedFiles: [{ status: "A", path: firstPath }],
      headSha: "head-sha-123",
      pullNumber: 42,
      runUrl: "https://github.example/actions/runs/9",
      apiKey: "test-api-key",
      model: "opencode-go/kimi-k2.7-code",
      submissionOnly: true,
      ...overrides,
    },
  };
}

describe("reviewPullRequest", () => {
  it("reviews each changed solution while sharing the LeetCode request for its slug", async () => {
    const checks = [];
    const completed = [];
    const comments = [];
    const requestedSlugs = [];
    const reviews = [];
    const sources = new Map([[firstPath, "class Solution { int first; }"], [secondPath, "class Solution { int second; }"]]);

    const result = await reviewPullRequest({
      githubClient: {
        createCheck: async (value) => { checks.push(value); return { id: 17 }; },
        completeCheck: async (value) => { completed.push(value); },
        upsertReviewComment: async (value) => { comments.push(value); },
      },
      leetcodeClient: { getQuestion: async (slug) => { requestedSlugs.push(slug); return question; } },
      openCodeClient: { review: async (value) => { reviews.push(value); return passResult(value.prompt.includes(firstPath) ? firstPath : secondPath); } },
      readFile: async (filePath) => sources.get(filePath),
      catalog,
      changedFiles: [{ status: "A", path: firstPath }, { status: "M", path: secondPath }],
      headSha: "head-sha-123",
      pullNumber: 42,
      runUrl: "https://github.example/actions/runs/9",
      apiKey: "test-api-key",
      model: "opencode-go/kimi-k2.7-code",
      submissionOnly: true,
    });

    expect(checks).toHaveLength(1);
    expect(checks[0].headSha).toBe("head-sha-123");
    expect(requestedSlugs).toEqual(["two-sum"]);
    expect(reviews).toHaveLength(2);
    expect(reviews.map(({ prompt }) => prompt.includes("class Solution { int first; }"))).toEqual([true, false]);
    expect(reviews.map(({ prompt }) => prompt.includes("class Solution { int second; }"))).toEqual([false, true]);
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toContain("<!-- leetdash-opencode-review -->");
    expect(completed).toHaveLength(1);
    expect(completed[0].conclusion).toBe("success");
    expect(result.results).toHaveLength(2);
    expect(result.results.map(({ verdict }) => verdict)).toEqual(["PASS", "PASS"]);
  });

  it("fails the check and comment with a model blocking counterexample", async () => {
    const { options, completed, comments } = reviewOptions({
      openCodeClient: { review: async () => failResult(firstPath) },
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("failure");
    expect(completed[0].conclusion).toBe("failure");
    expect(comments[0].body).toContain("Input: [3,3]");
    expect(comments[0].body).toContain("Expected: [0,1]");
    expect(comments[0].body).toContain("Actual: [0,0]");
  });

  it("renders a sanitized infrastructure failure and completes the check", async () => {
    const { options, completed, comments } = reviewOptions({
      leetcodeClient: { getQuestion: async () => { throw new ReviewFailure({ stage: "problem-fetch", reason: "PROBLEM_FETCH_FAILED", detail: "LeetCode request failed.", retryable: true, httpStatus: 503 }); } },
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("failure");
    expect(completed[0].conclusion).toBe("failure");
    expect(comments[0].body).toContain("## OpenCode review infrastructure failure (issue #33)");
    expect(comments[0].body).toContain("Stage: problem-fetch");
    expect(comments[0].body).toContain("HTTP status: 503");
  });

  it("turns invalid model JSON into a sanitized model-response failure", async () => {
    const rawModelOutput = "model secret output";
    const { options, completed, comments } = reviewOptions({
      openCodeClient: { review: async () => rawModelOutput },
    });

    const result = await reviewPullRequest(options);

    expect(result.failure).toMatchObject({ stage: "model-response", reason: "MODEL_RESPONSE_INVALID" });
    expect(completed[0].summary).not.toContain(rawModelOutput);
    expect(comments[0].body).not.toContain(rawModelOutput);
  });

  it("turns invalid review invariants into a result-validation failure", async () => {
    const { options, completed } = reviewOptions({
      openCodeClient: { review: async () => passResult(secondPath) },
    });

    const result = await reviewPullRequest(options);

    expect(result.failure).toMatchObject({ stage: "result-validation", reason: "REVIEW_RESULT_INVALID" });
    expect(completed[0].conclusion).toBe("failure");
  });

  it("updates a prior managed failure body with a later passing review", async () => {
    const { options } = reviewOptions();
    let storedBody = "<!-- leetdash-opencode-review -->\\n## OpenCode review infrastructure failure (issue #33)";
    options.githubClient.upsertReviewComment = async ({ body }) => { storedBody = body; };

    await reviewPullRequest(options);

    expect(storedBody).toContain("Verdict: PASS");
    expect(storedBody).not.toContain("infrastructure failure");
  });

  it("preserves a passing verdict when comment delivery fails", async () => {
    const { options, completed } = reviewOptions();
    options.githubClient.upsertReviewComment = async () => { throw new GitHubDeliveryFailure({ httpStatus: 503, requestId: "delivery-1" }); };

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(completed[0].summary).toContain("GitHub review comment delivery failed");
    expect(completed[0].summary).not.toContain("delivery-1");
  });

  it("emits a successful not-applicable check without review service or comment calls", async () => {
    const { options, completed } = reviewOptions({ submissionOnly: false });
    let requests = 0;
    options.leetcodeClient.getQuestion = async () => { requests += 1; };
    options.openCodeClient.review = async () => { requests += 1; };
    options.githubClient.upsertReviewComment = async () => { requests += 1; };

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].summary).toContain("not applicable");
    expect(requests).toBe(0);
  });

  it("posts a managed no-solutions summary for submission-only PRs without changed solutions", async () => {
    const { options, completed, comments } = reviewOptions({
      changedFiles: [{ status: "M", path: "submissions/ada/top-interview-easy/1/README.md" }],
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(comments[0].body).toContain("No changed solution.* files require review.");
  });
});

describe("opencode-review CLI", () => {
  it("exports the submission artifact predicate without changing supported solution names", () => {
    expect(isSubmissionArtifactName("solution.java")).toBe(true);
    expect(isSubmissionArtifactName("README.md")).toBe(true);
    expect(isSubmissionArtifactName("notes.txt")).toBe(false);
  });

  it("reports only missing configuration names without dumping environment values", async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), "opencode-review-"));
    const changedFiles = path.join(fixture, "changed-files.txt");
    await writeFile(changedFiles, `A\t${firstPath}\n`);
    const secret = "environment-secret-value";

    const failure = await execFileAsync(process.execPath, [scriptPath, "--changed-files", changedFiles], {
      env: { PATH: process.env.PATH, UNRELATED_SECRET: secret },
    }).then(
      () => undefined,
      (error) => error,
    );

    expect(failure.stderr).toContain("GITHUB_REPOSITORY");
    expect(failure.stderr).toContain("GITHUB_TOKEN");
    expect(failure.stderr).toContain("--pull-number");
    expect(failure.stderr).toContain("--head");
    expect(failure.stderr).not.toContain(secret);
  });

  it("requires OpenCode configuration only for submission-only reviews", async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), "opencode-review-"));
    const changedFiles = path.join(fixture, "changed-files.txt");
    await writeFile(changedFiles, `A\t${firstPath}\n`);
    const failure = await execFileAsync(process.execPath, [scriptPath, "--changed-files", changedFiles, "--submission-only", "--pull-number", "42", "--head", "head-sha"], {
      env: {
        PATH: process.env.PATH,
        GITHUB_REPOSITORY: "example/leetdash",
        GITHUB_TOKEN: "github-secret",
        GITHUB_SERVER_URL: "https://github.example",
        GITHUB_RUN_ID: "9",
      },
    }).then(
      () => undefined,
      (error) => error,
    );

    expect(failure.stderr).toContain("OPENCODE_API_KEY");
    expect(failure.stderr).toContain("OPENCODE_REVIEW_MODEL");
    expect(failure.stderr).not.toContain("github-secret");
  });
});
