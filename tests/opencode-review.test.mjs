import { describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const { defaultSourceReader, loadTrustedPullRequestScope, main, reviewPullRequest } = await import("../scripts/opencode-review.mjs");
const { GitHubDeliveryFailure, OpenCodeClient } = await import("../scripts/opencode-review-clients.mjs");
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
function passResult() {
  return `#### Summary
No visible risk found.

#### Possible risks
- None observed from the submitted code alone.

#### Complexity
- Time: O(n)
- Space: O(n)

#### Readability
- No specific improvement suggested.`;
}

function failResult() {
  return `#### Summary
A visible boundary may need attention.

#### Possible risks
- At line 4, the code reads the next element without a local bounds check when the loop reaches the final element.

#### Complexity
- Time: O(n)
- Space: O(n)

#### Readability
- No specific improvement suggested.`;
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
      openCodeClient: { review: async () => passResult() },
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
  it("reviews each changed solution using only its path, language, and source", async () => {
    const checks = [];
    const completed = [];
    const comments = [];
    const reviews = [];
    const sources = new Map([[firstPath, "class Solution { int first; }"], [secondPath, "class Solution { int second; }"]]);

    const result = await reviewPullRequest({
      githubClient: {
        createCheck: async (value) => { checks.push(value); return { id: 17 }; },
        completeCheck: async (value) => { completed.push(value); },
        upsertReviewComment: async (value) => { comments.push(value); },
      },
      openCodeClient: { review: async (value) => { reviews.push(value); return passResult(); } },
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
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({ model: "opencode-go/kimi-k2.7-code", apiKey: "test-api-key" });
    expect(reviews.map(({ prompt }) => prompt.includes("class Solution { int first; }"))).toEqual([true, false]);
    expect(reviews.map(({ prompt }) => prompt.includes("class Solution { int second; }"))).toEqual([false, true]);
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toContain("<!-- leetdash-opencode-review -->");
    expect(completed).toHaveLength(1);
    expect(completed[0].conclusion).toBe("success");
    expect(result.results).toHaveLength(2);
    expect(result.results.map(({ path }) => path)).toEqual([firstPath, secondPath]);
    expect(result.results.every(({ markdown }) => markdown.includes("#### Summary"))).toBe(true);
  });

  it("keeps a possible code risk informational", async () => {
    const { options, completed, comments } = reviewOptions({
      openCodeClient: { review: async () => failResult() },
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(comments[0].body).toContain("#### Possible risks");
    expect(comments[0].body).toContain("the loop reaches the final element.");
  });

  it("renders a sanitized warning for a model failure and completes the check successfully", async () => {
    const rawSecret = "provider-response-secret";
    const { options, completed, comments } = reviewOptions({
      openCodeClient: { review: async () => { throw new Error(rawSecret); } },
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(comments[0].body).toContain("## OpenCode review warning");
    expect(comments[0].body).toContain("Stage: model-request");
    expect(comments[0].body).not.toContain(rawSecret);
  });

  it("redacts multiline Markdown-significant submitted source before rendering model Markdown", async () => {
    const source = "class Solution {\r\n  // submitted-source-sentinel | <script>\r\n}\r\n";
    const quotedEcho = source
      .trim()
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line, index) => `    - ${index + 1}: ${line}`)
      .join("\n\n");
    const { options, comments, completed } = reviewOptions({
      readFile: async () => source,
      openCodeClient: { review: async () => `#### Summary\n\`\`\`java\n${quotedEcho}\n\`\`\`` },
    });

    const result = await reviewPullRequest(options);
    const output = [result.markdown, comments[0].body, completed[0].summary].join("\n");

    expect(output).not.toContain("submitted-source-sentinel");
    expect(output).toContain("[submitted source redacted]");
  });

  it.each([
    ["No issue found", "[submitted source redacted]"],
    ["<!-- leetdash-opencode-review -->", "<!-- leetdash-opencode-review -->"],
  ])("preserves trusted review framing when submitted source equals %s", async (source, requiredValue) => {
    const { options, comments, completed } = reviewOptions({
      readFile: async () => source,
      openCodeClient: { review: async () => source },
    });

    await reviewPullRequest(options);

    const output = [comments[0].body, completed[0].summary].join("\n");
    expect(output).toContain(requiredValue);
    expect(output).toContain("Commit: head-sha-123");
    expect(output).toContain(firstPath);
    expect(output).toContain("https://github.example/actions/runs/9");
  });

  it("pairs each Markdown review with only its own submitted source", async () => {
    const sources = new Map([[firstPath, "e"], [secondPath, "class Solution {}"]]);
    const firstResult = "e";
    const secondResult = "#### Summary\nEvery edge case is handled.";
    const responses = [firstResult, secondResult];
    const { options, comments, completed } = reviewOptions({
      changedFiles: [{ status: "A", path: firstPath }, { status: "M", path: secondPath }],
      readFile: async (filePath) => sources.get(filePath),
      openCodeClient: { review: async () => responses.shift() },
    });

    const result = await reviewPullRequest(options);
    const output = [comments[0].body, completed[0].summary].join("\n");

    expect(result.results.map(({ markdown }) => markdown)).toEqual(["[submitted source redacted]", secondResult]);
    expect(output).toContain("> #### Summary\n> Every edge case is handled.");
  });

  it.each([
    ["e", "Every edge case is handled."],
    [" ", "Every edge case is handled."],
  ])("does not redact embedded text for a trivial or whitespace-only source %j", async (source, summary) => {
    const { options, comments, completed } = reviewOptions({
      readFile: async () => source,
      openCodeClient: { review: async () => `#### Summary\n${summary}` },
    });

    const result = await reviewPullRequest(options);
    const output = [result.markdown, comments[0].body, completed[0].summary].join("\n");

    expect(output).toContain(`> #### Summary\n> ${summary}`);
  });

  it("keeps every redaction sentinel out of managed outputs on real client-to-orchestrator paths", async () => {
    const sentinels = {
      apiKey: "secret-api-key",
      authorization: "Bearer secret-token",
      modelBody: "raw-model-body",
      source: "submitted-source-sentinel",
    };
    const headers = [];
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const captured = [];

    const capture = async ({ apiKey, source = "class Solution {}", openCodeClient }) => {
      const summaryPath = path.join(await mkdtemp(path.join(tmpdir(), "opencode-review-")), "summary.md");
      const { options, comments } = reviewOptions({ apiKey, summaryPath, readFile: async () => source, openCodeClient });
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
    try {
      await capture({
        apiKey: sentinels.apiKey,
        source: sentinels.source,
        openCodeClient: new OpenCodeClient({
          fetchImpl: async (_url, request) => {
            headers.push(request.headers.Authorization);
            return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { role: "assistant", content: sentinels.source } }] }) };
          },
        }),
      });
      await capture({
        apiKey: "secret-token",
        openCodeClient: new OpenCodeClient({
          fetchImpl: async (_url, request) => {
            headers.push(request.headers.Authorization);
            return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { role: "assistant", content: sentinels.modelBody } }] }) };
          },
        }),
      });
      const output = [...logSpy.mock.calls.flat(), ...captured].join("\n");
      expect(headers).toEqual([`Bearer ${sentinels.apiKey}`, sentinels.authorization]);
      expect(output).toContain(sentinels.modelBody);
      for (const sentinel of [sentinels.apiKey, sentinels.authorization, sentinels.source]) {
        expect(output).not.toContain(sentinel);
      }
    } finally {
      logSpy.mockRestore();
    }
  });

  it("updates a prior managed failure body with a later passing review", async () => {
    const { options } = reviewOptions();
    let storedBody = "<!-- leetdash-opencode-review -->\\n## OpenCode review warning";
    options.githubClient.upsertReviewComment = async ({ body }) => { storedBody = body; };

    await reviewPullRequest(options);

    expect(storedBody).toContain("> #### Summary\n> No visible risk found.");
    expect(storedBody).not.toContain("review warning");
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
    expect(completed[0].conclusion).toBe("success");
  });

  it("renders a path-parse failure safely and completes the check successfully", async () => {
    const unsafePath = "unexpected/<script>/solution.java";
    const { options, completed, comments } = reviewOptions({
      changedFiles: [{ status: "A", path: unsafePath }],
    });

    const result = await reviewPullRequest(options);

    expect(result.failure).toMatchObject({ stage: "path-parse", reason: "SUBMISSION_PATH_INVALID" });
    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(comments[0].body).toContain("## OpenCode review warning");
    expect(comments[0].body).not.toContain("<script>");
  });

  it("does not swallow check creation or completion delivery failures", async () => {
    const creation = reviewOptions();
    creation.options.githubClient.createCheck = async () => { throw new Error("create failed"); };
    await expect(reviewPullRequest(creation.options)).rejects.toThrow("create failed");

    const completion = reviewOptions();
    completion.options.githubClient.completeCheck = async () => { throw new Error("complete failed"); };
    await expect(reviewPullRequest(completion.options)).rejects.toThrow("complete failed");
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

  it.each([
    ["base SHA mismatch", { baseSha: "other-base" }],
    ["head SHA mismatch", { headSha: "other-head" }],
    ["incomplete file list", { changedFilesCount: 2 }],
    ["ownership rejection", { files: [{ status: "added", filename: secondPath }] }],
    ["catalog rejection", { files: [{ status: "added", filename: "submissions/ada/top-interview-easy/999/solution.java" }] }],
  ])("does not turn trusted-scope %s into a successful check", async (_name, override) => {
    const { options, completed } = reviewOptions({ submissionOnly: undefined, changedFiles: undefined });
    const files = override.files ?? [{ status: "added", filename: firstPath }];
    options.loadReviewScope = () => loadTrustedPullRequestScope({
      githubClient: {
        getPullRequest: async () => ({
          number: 42,
          changed_files: override.changedFilesCount ?? files.length,
          user: { login: "ada" },
          base: { sha: override.baseSha ?? "base-sha" },
          head: { sha: override.headSha ?? "head-sha", repo: { full_name: "fork-user/leetdash" } },
        }),
        listPullRequestFiles: async () => files,
      },
      pullNumber: 42,
      baseSha: "base-sha",
      headSha: "head-sha",
      catalog,
      users,
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("failure");
    expect(completed[0].conclusion).toBe("failure");
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
    })).rejects.toMatchObject({ stage: "source-read", reason: "SOURCE_READ_FAILED" });

    expect(reads).toBe(0);
  });

  it("rejects a checkout-escaping path before invoking filesystem callbacks", async () => {
    let stats = 0;
    let reads = 0;

    await expect(defaultSourceReader("../outside/solution.java", {
      checkoutRoot: "C:\\checkout",
      lstat: async () => { stats += 1; return { isSymbolicLink: () => false, isFile: () => true }; },
      readFile: async () => { reads += 1; return "source"; },
    })).rejects.toMatchObject({ stage: "source-read", reason: "SOURCE_READ_FAILED" });

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
      openCodeClient: { review: async () => { reviewCalls += 1; } },
      catalog,
      users,
    });

    expect(outcome.exitCode).toBe(0);
    expect(completed[0].summary).toContain("not applicable");
    expect(reviewCalls).toBe(0);
  });

  it("completes a warning check successfully when a submission review lacks OpenCode configuration", async () => {
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
      openCodeClient: { review: async () => { throw new Error("must not run"); } },
      catalog,
      users,
    });

    expect(outcome.exitCode).toBe(0);
    expect(completed[0]).toMatchObject({ conclusion: "success" });
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
    ["possible code risk", { review: async () => failResult(firstPath) }],
    ["handled model failure", { review: async () => { throw new ReviewFailure({ stage: "model-request", reason: "MODEL_REQUEST_FAILED", detail: "safe" }); } }],
  ])("returns zero after completing an informational %s check", async (_name, openCodeClient) => {
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
      openCodeClient,
      catalog,
      readFile: options.readFile,
    });

    expect(outcome.exitCode).toBe(0);
    expect(completed[0].conclusion).toBe("success");
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
