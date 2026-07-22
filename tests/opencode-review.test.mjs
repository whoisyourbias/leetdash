import { describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const { defaultSourceReader, loadTrustedPullRequestScope, main, reviewPullRequest } = await import("../scripts/opencode-review.mjs");
const { GitHubDeliveryFailure, LeetCodeClient, OpenCodeClient } = await import("../scripts/opencode-review-clients.mjs");
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
const users = {
  users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
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

  it("redacts multiline Markdown-significant submitted source before rendering model fields", async () => {
    const source = "class Solution {\n  // submitted-source-sentinel | <script>\n}";
    const { options, comments, completed } = reviewOptions({
      readFile: async () => source,
      openCodeClient: { review: async () => JSON.stringify({ ...JSON.parse(passResult(firstPath)), summary: source }) },
    });

    const result = await reviewPullRequest(options);
    const output = [result.markdown, comments[0].body, completed[0].summary].join("\n");

    expect(output).not.toContain("submitted-source-sentinel");
    expect(output).toContain("[submitted source redacted]");
  });

  it.each([
    ["PASS", "Verdict: PASS"],
    ["<!-- leetdash-opencode-review -->", "<!-- leetdash-opencode-review -->"],
  ])("preserves trusted review framing when submitted source equals %s", async (source, requiredValue) => {
    const { options, comments, completed } = reviewOptions({
      readFile: async () => source,
      openCodeClient: { review: async () => JSON.stringify({ ...JSON.parse(passResult(firstPath)), summary: source }) },
    });

    await reviewPullRequest(options);

    const output = [comments[0].body, completed[0].summary].join("\n");
    expect(output).toContain(requiredValue);
    expect(output).toContain("Commit: head-sha-123");
    expect(output).toContain(firstPath);
    expect(output).toContain("https://github.example/actions/runs/9");
  });

  it("pairs each parsed review with only its own submitted source", async () => {
    const sources = new Map([[firstPath, "e"], [secondPath, "class Solution {}"]]);
    const firstResult = { ...JSON.parse(passResult(firstPath)), summary: "e" };
    const secondResult = { ...JSON.parse(passResult(secondPath)), summary: "Every edge case is handled." };
    const responses = [firstResult, secondResult];
    const { options, comments, completed } = reviewOptions({
      changedFiles: [{ status: "A", path: firstPath }, { status: "M", path: secondPath }],
      readFile: async (filePath) => sources.get(filePath),
      openCodeClient: { review: async () => JSON.stringify(responses.shift()) },
    });

    const result = await reviewPullRequest(options);
    const output = [comments[0].body, completed[0].summary].join("\n");

    expect(result.results.map(({ summary }) => summary)).toEqual(["[submitted source redacted]", secondResult.summary]);
    expect(output).toContain(`Summary: ${secondResult.summary}`);
  });

  it.each([
    ["e", "Every edge case is handled."],
    [" ", "Every edge case is handled."],
  ])("does not redact embedded text for a trivial or whitespace-only source %j", async (source, summary) => {
    const { options, comments, completed } = reviewOptions({
      readFile: async () => source,
      openCodeClient: { review: async () => JSON.stringify({ ...JSON.parse(passResult(firstPath)), summary }) },
    });

    const result = await reviewPullRequest(options);
    const output = [result.markdown, comments[0].body, completed[0].summary].join("\n");

    expect(output).toContain(`Summary: ${summary}`);
  });

  it("keeps every redaction sentinel out of managed outputs on real client-to-orchestrator paths", async () => {
    const sentinels = {
      apiKey: "secret-api-key",
      authorization: "Bearer secret-token",
      modelBody: "raw-model-body",
      graphqlBody: "raw-graphql-body",
      source: "submitted-source-sentinel",
    };
    const headers = [];
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const captured = [];

    const capture = async ({ apiKey, source = "class Solution {}", leetcodeClient, openCodeClient }) => {
      const summaryPath = path.join(await mkdtemp(path.join(tmpdir(), "opencode-review-")), "summary.md");
      const { options, comments } = reviewOptions({ apiKey, summaryPath, readFile: async () => source, leetcodeClient, openCodeClient });
      const checks = [];
      options.githubClient.createCheck = async (value) => { checks.push(value); return { id: 17 }; };
      options.githubClient.completeCheck = async (value) => { checks.push(value); };
      await reviewPullRequest(options);
      captured.push(
        ...comments.map(({ body }) => body),
        ...checks.flatMap((check) => [check.title, check.summary]),
        await readFile(summaryPath, "utf8"),
      );
    };
    const successfulQuestionClient = () => new LeetCodeClient({
      fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: { question } }) }),
    });

    try {
      await capture({
        apiKey: sentinels.apiKey,
        source: sentinels.source,
        leetcodeClient: successfulQuestionClient(),
        openCodeClient: new OpenCodeClient({
          fetchImpl: async (_url, request) => {
            headers.push(request.headers.Authorization);
            return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { role: "assistant", content: JSON.stringify({ ...JSON.parse(passResult(firstPath)), summary: sentinels.source }) } }] }) };
          },
        }),
      });
      await capture({
        apiKey: "secret-token",
        leetcodeClient: successfulQuestionClient(),
        openCodeClient: new OpenCodeClient({
          fetchImpl: async (_url, request) => {
            headers.push(request.headers.Authorization);
            return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { role: "assistant", content: sentinels.modelBody } }] }) };
          },
        }),
      });
      await capture({
        apiKey: sentinels.apiKey,
        leetcodeClient: new LeetCodeClient({
          fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ errors: [{ message: sentinels.graphqlBody }] }) }),
        }),
        openCodeClient: { review: async () => { throw new Error("must not run"); } },
      });

      const output = [...logSpy.mock.calls.flat(), ...captured].join("\n");
      expect(headers).toEqual([`Bearer ${sentinels.apiKey}`, sentinels.authorization]);
      Object.values(sentinels).forEach((sentinel) => expect(output).not.toContain(sentinel));
    } finally {
      logSpy.mockRestore();
    }
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

  it("completes the check when changed-file input is malformed", async () => {
    const { options, completed } = reviewOptions({ changedFiles: [null] });

    const result = await reviewPullRequest(options);

    expect(result.failure).toMatchObject({ stage: "catalog-resolve", reason: "CATALOG_MAPPING_FAILED" });
    expect(completed[0].conclusion).toBe("failure");
  });

  it("creates a check before lazily loading a malformed catalog and completes the failure", async () => {
    const calls = [];
    const { options, completed } = reviewOptions({
      catalog: undefined,
      loadCatalog: async () => { calls.push("catalog"); throw new SyntaxError("raw catalog contents"); },
    });
    options.githubClient.createCheck = async () => { calls.push("check"); return { id: 17 }; };

    const result = await reviewPullRequest(options);

    expect(calls).toEqual(["check", "catalog"]);
    expect(result.failure).toMatchObject({ stage: "catalog-resolve", reason: "CATALOG_MAPPING_FAILED" });
    expect(completed[0].conclusion).toBe("failure");
    expect(completed[0].summary).not.toContain("raw catalog contents");
  });

  it("does not discover changed files for a not-applicable review", async () => {
    const { options, completed } = reviewOptions({
      submissionOnly: false,
      changedFiles: undefined,
      loadChangedFiles: async () => { throw new Error("must not run"); },
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].summary).toContain("not applicable");
  });
});

describe("trusted pull-request scope", () => {
  it("derives submission-only applicability from GitHub API file data", async () => {
    const calls = [];
    const scope = await loadTrustedPullRequestScope({
      githubClient: {
        getPullRequest: async (number) => {
          calls.push(["pull", number]);
          return { number, changed_files: 1, user: { login: "ada" }, base: { sha: "base-sha" }, head: { sha: "head-sha", repo: { full_name: "fork-user/leetdash" } } };
        },
        listPullRequestFiles: async (number) => {
          calls.push(["files", number]);
          return [{ status: "added", filename: firstPath }];
        },
      },
      pullNumber: 42,
      baseSha: "base-sha",
      headSha: "head-sha",
      catalog,
      users,
    });

    expect(calls).toEqual([["pull", 42], ["files", 42]]);
    expect(scope).toEqual({
      submissionOnly: true,
      changedFiles: [{ status: "A", path: firstPath }],
      headRepository: "fork-user/leetdash",
    });
  });

  it.each([
    ["base", { base: { sha: "other-base" }, head: { sha: "head-sha" } }],
    ["head", { base: { sha: "base-sha" }, head: { sha: "other-head" } }],
  ])("fails closed when the pull-request %s SHA no longer matches the triggering run", async (_name, refs) => {
    await expect(loadTrustedPullRequestScope({
      githubClient: {
        getPullRequest: async () => ({ number: 42, changed_files: 1, user: { login: "ada" }, ...refs }),
        listPullRequestFiles: async () => { throw new Error("must not list mismatched PR files"); },
      },
      pullNumber: 42,
      baseSha: "base-sha",
      headSha: "head-sha",
      catalog,
      users,
    })).rejects.toMatchObject({ stage: "catalog-resolve", reason: "CATALOG_MAPPING_FAILED" });
  });

  it("classifies ordinary application changes as not applicable without submission validation", async () => {
    await expect(loadTrustedPullRequestScope({
      githubClient: {
        getPullRequest: async () => ({ number: 42, changed_files: 1, user: { login: "ada" }, base: { sha: "base-sha" }, head: { sha: "head-sha", repo: { full_name: "example/leetdash" } } }),
        listPullRequestFiles: async () => [{ status: "modified", filename: "app/page.tsx" }],
      },
      pullNumber: 42,
      baseSha: "base-sha",
      headSha: "head-sha",
      catalog,
      users,
    })).resolves.toEqual({
      submissionOnly: false,
      changedFiles: [{ status: "M", path: "app/page.tsx" }],
      headRepository: "example/leetdash",
    });
  });

  it.each([
    ["missing count", undefined, [{ status: "modified", filename: "app/page.tsx" }]],
    ["non-numeric count", "1", [{ status: "modified", filename: "app/page.tsx" }]],
    ["negative count", -1, [{ status: "modified", filename: "app/page.tsx" }]],
    ["fractional count", 1.5, [{ status: "modified", filename: "app/page.tsx" }]],
    ["unsafe integer count", Number.MAX_SAFE_INTEGER + 1, [{ status: "modified", filename: "app/page.tsx" }]],
    ["mismatched count", 2, [{ status: "modified", filename: "app/page.tsx" }]],
    ["count beyond the GitHub Files API limit", 3001, Array.from({ length: 3000 }, () => ({ status: "modified", filename: "app/page.tsx" }))],
  ])("fails closed with a sanitized infrastructure failure for %s", async (_name, changedFilesCount, files) => {
    await expect(loadTrustedPullRequestScope({
      githubClient: {
        getPullRequest: async () => ({
          number: 42,
          changed_files: changedFilesCount,
          user: { login: "ada" },
          base: { sha: "base-sha" },
          head: { sha: "head-sha", repo: { full_name: "example/leetdash" } },
        }),
        listPullRequestFiles: async () => files,
      },
      pullNumber: 42,
      baseSha: "base-sha",
      headSha: "head-sha",
      catalog,
      users,
    })).rejects.toMatchObject({
      stage: "catalog-resolve",
      reason: "CATALOG_MAPPING_FAILED",
      detail: "변경된 제출 파일 목록을 가져오지 못했습니다.",
    });
  });
});

describe("defaultSourceReader", () => {
  it.each([
    ["symbolic link", () => ({ isSymbolicLink: () => true, isFile: () => true })],
    ["non-file", () => ({ isSymbolicLink: () => false, isFile: () => false })],
  ])("rejects a %s before invoking the source read callback", async (_name, makeStats) => {
    let reads = 0;

    await expect(defaultSourceReader("submissions/ada/top-interview-easy/1/solution.java", {
      checkoutRoot: "C:\\checkout",
      lstat: async () => makeStats(),
      readFile: async () => { reads += 1; return "source"; },
    })).rejects.toMatchObject({ stage: "catalog-resolve", reason: "CATALOG_MAPPING_FAILED" });

    expect(reads).toBe(0);
  });

  it("rejects a checkout-escaping path before invoking filesystem callbacks", async () => {
    let stats = 0;
    let reads = 0;

    await expect(defaultSourceReader("../outside/solution.java", {
      checkoutRoot: "C:\\checkout",
      lstat: async () => { stats += 1; return { isSymbolicLink: () => false, isFile: () => true }; },
      readFile: async () => { reads += 1; return "source"; },
    })).rejects.toMatchObject({ stage: "catalog-resolve", reason: "CATALOG_MAPPING_FAILED" });

    expect(stats).toBe(0);
    expect(reads).toBe(0);
  });

  it("reads an in-root regular source file as UTF-8", async () => {
    const reads = [];

    await expect(defaultSourceReader("submissions/ada/top-interview-easy/1/solution.java", {
      checkoutRoot: "C:\\checkout",
      lstat: async () => ({ isSymbolicLink: () => false, isFile: () => true }),
      readFile: async (...args) => { reads.push(args); return "class Solution {}"; },
    })).resolves.toBe("class Solution {}");

    expect(reads).toHaveLength(1);
    expect(reads[0][1]).toBe("utf8");
  });
});

describe("opencode-review CLI", () => {
  it("exports the submission artifact predicate without changing supported solution names", () => {
    expect(isSubmissionArtifactName("solution.java")).toBe(true);
    expect(isSubmissionArtifactName("README.md")).toBe(true);
    expect(isSubmissionArtifactName("notes.txt")).toBe(false);
  });

  it("reports only missing configuration names without dumping environment values", async () => {
    const secret = "environment-secret-value";

    const failure = await execFileAsync(process.execPath, [scriptPath], {
      env: { PATH: process.env.PATH, UNRELATED_SECRET: secret },
    }).then(
      () => undefined,
      (error) => error,
    );

    expect(failure.stderr).toContain("GITHUB_REPOSITORY");
    expect(failure.stderr).toContain("GITHUB_TOKEN");
    expect(failure.stderr).toContain("--pull-number");
    expect(failure.stderr).toContain("--base");
    expect(failure.stderr).toContain("--head");
    expect(failure.stderr).not.toContain(secret);
  });

  it("derives applicability from GitHub and reads submitted source only at the exact head SHA", async () => {
    const checks = [];
    const sourceReads = [];
    const prompts = [];
    const source = "class Solution { int fetchedAsData; }";
    const githubClient = {
      createCheck: async (value) => { checks.push(value); return { id: 17 }; },
      completeCheck: async (value) => { checks.push(value); },
      upsertReviewComment: async () => {},
      getPullRequest: async () => ({ number: 42, changed_files: 1, user: { login: "ada" }, base: { sha: "base-sha" }, head: { sha: "head-sha", repo: { full_name: "fork-user/leetdash" } } }),
      listPullRequestFiles: async () => [{ status: "modified", filename: firstPath }],
      getFileContent: async (value) => { sourceReads.push(value); return source; },
    };

    const outcome = await main({
      argv: ["--base", "base-sha", "--head", "head-sha", "--pull-number", "42"],
      env: {
        GITHUB_REPOSITORY: "example/leetdash",
        GITHUB_TOKEN: "github-secret",
        GITHUB_SERVER_URL: "https://github.example",
        GITHUB_RUN_ID: "9",
        OPENCODE_API_KEY: "opencode-secret",
        OPENCODE_REVIEW_MODEL: "opencode-go/kimi-k2.7-code",
      },
      githubClient,
      leetcodeClient: { getQuestion: async () => question },
      openCodeClient: { review: async ({ prompt }) => { prompts.push(prompt); return passResult(firstPath); } },
      catalog,
      users,
    });

    expect(outcome.exitCode).toBe(0);
    expect(sourceReads).toEqual([{ path: firstPath, ref: "head-sha", repository: "fork-user/leetdash" }]);
    expect(prompts[0]).toContain(source);
    expect(checks[0]).toMatchObject({ headSha: "head-sha" });
    expect(checks.at(-1)).toMatchObject({ conclusion: "success" });
  });

  it("derives not-applicable status from ordinary GitHub file data without OpenCode configuration", async () => {
    const completed = [];
    let reviewCalls = 0;
    const githubClient = {
      createCheck: async () => ({ id: 17 }),
      completeCheck: async (value) => { completed.push(value); },
      upsertReviewComment: async () => { reviewCalls += 1; },
      getPullRequest: async () => ({ number: 42, changed_files: 1, user: { login: "ada" }, base: { sha: "base-sha" }, head: { sha: "head-sha", repo: { full_name: "example/leetdash" } } }),
      listPullRequestFiles: async () => [{ status: "modified", filename: "app/page.tsx" }],
      getFileContent: async () => { reviewCalls += 1; },
    };

    const outcome = await main({
      argv: ["--base", "base-sha", "--head", "head-sha", "--pull-number", "42"],
      env: {
        GITHUB_REPOSITORY: "example/leetdash",
        GITHUB_TOKEN: "github-secret",
        GITHUB_SERVER_URL: "https://github.example",
        GITHUB_RUN_ID: "9",
      },
      githubClient,
      leetcodeClient: { getQuestion: async () => { reviewCalls += 1; } },
      openCodeClient: { review: async () => { reviewCalls += 1; } },
      catalog,
      users,
    });

    expect(outcome.exitCode).toBe(0);
    expect(completed[0].summary).toContain("not applicable");
    expect(reviewCalls).toBe(0);
  });

  it("fails closed with a completed check when a submission review lacks OpenCode configuration", async () => {
    const completed = [];
    const githubClient = {
      createCheck: async () => ({ id: 17 }),
      completeCheck: async (value) => { completed.push(value); },
      upsertReviewComment: async () => {},
      getPullRequest: async () => ({ number: 42, changed_files: 1, user: { login: "ada" }, base: { sha: "base-sha" }, head: { sha: "head-sha", repo: { full_name: "example/leetdash" } } }),
      listPullRequestFiles: async () => [{ status: "modified", filename: firstPath }],
      getFileContent: async () => { throw new Error("source must not be fetched without review configuration"); },
    };

    const outcome = await main({
      argv: ["--base", "base-sha", "--head", "head-sha", "--pull-number", "42"],
      env: {
        GITHUB_REPOSITORY: "example/leetdash",
        GITHUB_TOKEN: "github-secret",
        GITHUB_SERVER_URL: "https://github.example",
        GITHUB_RUN_ID: "9",
      },
      githubClient,
      leetcodeClient: { getQuestion: async () => { throw new Error("must not run"); } },
      openCodeClient: { review: async () => { throw new Error("must not run"); } },
      catalog,
      users,
    });

    expect(outcome.exitCode).toBe(1);
    expect(completed[0]).toMatchObject({ conclusion: "failure" });
    expect(completed[0].summary).toContain("MODEL_REQUEST_FAILED");
  });

  it.each(["true", "false", "yes"])("rejects the deprecated --submission-only %s path", async (value) => {
    let calls = 0;
    const env = { GITHUB_REPOSITORY: "example/leetdash", GITHUB_TOKEN: "github-secret", GITHUB_SERVER_URL: "https://github.example", GITHUB_RUN_ID: "9" };

    await expect(main({
      argv: ["--base", "base", "--head", "head", "--pull-number", "42", "--submission-only", value],
      env,
      githubClient: { createCheck: async () => { calls += 1; } },
    })).resolves.toMatchObject({ exitCode: 1 });
    expect(calls).toBe(0);
  });

  it.each([
    ["code failure", { review: async () => failResult(firstPath) }],
    ["infrastructure failure", { review: async () => { throw new ReviewFailure({ stage: "model-request", reason: "MODEL_REQUEST_FAILED", detail: "safe" }); } }],
  ])("returns nonzero after completing a %s check", async (_name, openCodeClient) => {
    const { options, completed } = reviewOptions();

    const outcome = await main({
      argv: ["--base", "base", "--head", "head", "--pull-number", "42"],
      env: {
        GITHUB_REPOSITORY: "example/leetdash",
        GITHUB_TOKEN: "github-secret",
        GITHUB_SERVER_URL: "https://github.example",
        GITHUB_RUN_ID: "9",
        OPENCODE_API_KEY: "opencode-secret",
        OPENCODE_REVIEW_MODEL: "opencode-go/kimi-k2.7-code",
      },
      loadReviewScope: async () => ({ submissionOnly: true, changedFiles: [{ status: "A", path: firstPath }] }),
      githubClient: options.githubClient,
      leetcodeClient: options.leetcodeClient,
      openCodeClient,
      catalog,
      readFile: options.readFile,
    });

    expect(outcome.exitCode).toBe(1);
    expect(completed[0].conclusion).toBe("failure");
  });

  it("exits nonzero after safely completing a changed-file discovery failure", async () => {
    const { options, completed } = reviewOptions();
    const calls = [];
    const rawFailure = "changed-files-secret";
    options.githubClient.createCheck = async () => { calls.push("check"); return { id: 17 }; };

    const outcome = await main({
      argv: ["--base", "base", "--head", "head", "--pull-number", "42"],
      env: {
        GITHUB_REPOSITORY: "example/leetdash",
        GITHUB_TOKEN: "github-secret",
        GITHUB_SERVER_URL: "https://github.example",
        GITHUB_RUN_ID: "9",
        OPENCODE_API_KEY: "opencode-secret",
        OPENCODE_REVIEW_MODEL: "opencode-go/kimi-k2.7-code",
      },
      loadReviewScope: async () => { calls.push("changed-files"); throw new Error(rawFailure); },
      githubClient: options.githubClient,
      leetcodeClient: options.leetcodeClient,
      openCodeClient: options.openCodeClient,
      catalog,
    });

    expect(calls).toEqual(["check", "changed-files"]);
    expect(outcome.exitCode).toBe(1);
    expect(completed[0].conclusion).toBe("failure");
    expect(completed[0].summary).toContain("변경된 제출 파일 목록을 가져오지 못했습니다.");
    expect(completed[0].summary).not.toContain(rawFailure);
  });
});
