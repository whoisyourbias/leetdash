import { describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const { defaultSourceReader, loadTrustedPullRequestScope, main, reviewPullRequest } = await import("../scripts/opencode-review.mjs");
const { GitHubDeliveryFailure, OpenCodeClient } = await import("../scripts/opencode-review-clients.mjs");
const { ReviewFailure, reviewContentKey, reviewContentMarker, reviewFileKey } = await import("../scripts/opencode-review-core.mjs");
const { isSubmissionArtifactName } = await import("../scripts/validate-submission-pr.mjs");
const execFileAsync = promisify(execFile);
const scriptPath = path.resolve("scripts/opencode-review.mjs");

const firstPath = "submissions/ada/top-interview-easy/1/solution.java";
const secondPath = "submissions/grace/top-interview-easy/1/solution.java";
const mascotUrl = `https://github.example/example/leetdash/raw/${"a".repeat(40)}/public/chalsakbot.png`;

const catalog = {
  lists: [{ key: "top-interview-easy", items: [{ submissionKey: "1", slug: "two-sum" }] }],
  problems: [{ slug: "two-sum", leetcodeId: 1, title: "Two Sum", difficulty: "Easy" }],
};
const users = {
  users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
};
function passResult() {
  return `#### 요약
코드에서 직접 확인되는 위험은 없습니다.

#### 잠재적 위험
- 제출 코드만으로 확인된 사항 없음.

#### 복잡도
- 시간: O(n)
- 공간: O(n)

#### 가독성
- 제출 코드만으로 확인된 사항 없음.`;
}

function failResult() {
  return `#### 요약
경계 접근을 확인할 필요가 있습니다.

#### 잠재적 위험
- 4행에서 반복문이 마지막 원소에 도달하면 범위 검사 없이 다음 원소를 읽을 수 있습니다.

#### 복잡도
- 시간: O(n)
- 공간: O(n)

#### 가독성
- 제출 코드만으로 확인된 사항 없음.`;
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
        listManagedReviewComments: async () => [],
        upsertReviewComment: async (value) => { comments.push(value); },
        deleteReviewComment: async () => {},
      },
      openCodeClient: { review: async () => passResult() },
      readFile: async () => "class Solution {}",
      catalog,
      changedFiles: [{ status: "A", path: firstPath }],
      serverUrl: "https://github.example",
      headRepository: "fork-user/leetdash",
      headSha: "a".repeat(40),
      pullNumber: 42,
      runUrl: "https://github.example/actions/runs/9",
      mascotUrl,
      apiKey: "test-api-key",
      model: "opencode-go/kimi-k2.7-code",
      submissionOnly: true,
      ...overrides,
    },
  };
}

describe("reviewPullRequest", () => {
  it("reuses an unchanged successful file review without calling OpenCode", async () => {
    const source = "class Solution {}";
    const mutations = [];
    let reviewCalls = 0;
    let sourceReads = 0;
    const { options } = reviewOptions({
      readFile: async () => { sourceReads += 1; return source; },
      openCodeClient: { review: async () => { reviewCalls += 1; return passResult(); } },
    });
    options.githubClient.listManagedReviewComments = async () => [
      { id: 31, kind: "summary" },
      { id: 32, kind: "file", key: reviewFileKey(firstPath), contentKey: reviewContentKey(source) },
    ];
    options.githubClient.upsertReviewComment = async (value) => { mutations.push(value); };

    const result = await reviewPullRequest(options);

    expect(sourceReads).toBe(1);
    expect(reviewCalls).toBe(0);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].commentId).toBe(31);
    expect(result.results).toMatchObject([{ path: firstPath, status: "reused" }]);
    expect(result.markdown).toContain("리뷰 완료: 0개");
    expect(result.markdown).toContain("리뷰 유지: 1개");
  });

  it("reviews changed content and updates the existing file comment digest", async () => {
    const source = "class Solution { int changed; }";
    const mutations = [];
    let reviewCalls = 0;
    const { options } = reviewOptions({
      readFile: async () => source,
      openCodeClient: { review: async () => { reviewCalls += 1; return passResult(); } },
    });
    options.githubClient.listManagedReviewComments = async () => [
      { id: 31, kind: "summary" },
      { id: 32, kind: "file", key: reviewFileKey(firstPath), contentKey: reviewContentKey("old source") },
    ];
    options.githubClient.upsertReviewComment = async (value) => { mutations.push(value); };

    const result = await reviewPullRequest(options);

    expect(reviewCalls).toBe(1);
    expect(result.results).toMatchObject([{ path: firstPath, status: "reviewed", contentKey: reviewContentKey(source) }]);
    expect(mutations[0].commentId).toBe(32);
    expect(mutations[0].body).toContain(reviewContentMarker(reviewContentKey(source)));
    expect(mutations[0].body).toContain(
      `https://github.example/fork-user/leetdash/blob/${"a".repeat(40)}/${firstPath}`,
    );
  });

  it("reviews legacy or warning comments that have no successful content digest", async () => {
    let reviewCalls = 0;
    const { options } = reviewOptions({
      openCodeClient: { review: async () => { reviewCalls += 1; return passResult(); } },
    });
    options.githubClient.listManagedReviewComments = async () => [
      { id: 32, kind: "file", key: reviewFileKey(firstPath) },
    ];

    const result = await reviewPullRequest(options);

    expect(reviewCalls).toBe(1);
    expect(result.results[0].status).toBe("reviewed");
  });

  it("mixes reused and newly reviewed files without rewriting the reused comment", async () => {
    const sources = new Map([
      [firstPath, "class Solution { int first; }"],
      [secondPath, "class Solution { int second; }"],
    ]);
    const mutations = [];
    const reviewPrompts = [];
    const { options } = reviewOptions({
      changedFiles: [{ status: "M", path: firstPath }, { status: "M", path: secondPath }],
      readFile: async (filePath) => sources.get(filePath),
      openCodeClient: { review: async ({ prompt }) => { reviewPrompts.push(prompt); return passResult(); } },
    });
    options.githubClient.listManagedReviewComments = async () => [
      { id: 31, kind: "summary" },
      { id: 32, kind: "file", key: reviewFileKey(firstPath), contentKey: reviewContentKey(sources.get(firstPath)) },
      { id: 33, kind: "file", key: reviewFileKey(secondPath), contentKey: reviewContentKey("old second source") },
    ];
    options.githubClient.upsertReviewComment = async (value) => { mutations.push(value); };

    const result = await reviewPullRequest(options);

    expect(reviewPrompts).toHaveLength(1);
    expect(reviewPrompts[0]).toContain(secondPath);
    expect(result.results.map(({ status }) => status)).toEqual(["reused", "reviewed"]);
    expect(mutations.map(({ commentId }) => commentId)).toEqual([33, 31]);
    expect(result.markdown).toContain("리뷰 완료: 1개");
    expect(result.markdown).toContain("리뷰 유지: 1개");
  });

  it("reviews and publishes each changed solution before starting the next one", async () => {
    const checks = [];
    const completed = [];
    const comments = [];
    const reviews = [];
    const events = [];
    const sources = new Map([[firstPath, "class Solution { int first; }"], [secondPath, "class Solution { int second; }"]]);

    const result = await reviewPullRequest({
      githubClient: {
        createCheck: async (value) => { checks.push(value); return { id: 17 }; },
        completeCheck: async (value) => { completed.push(value); },
        listManagedReviewComments: async () => [],
        upsertReviewComment: async (value) => {
          comments.push(value);
          const reviewedPath = [firstPath, secondPath].find((filePath) => value.body.includes(filePath));
          events.push(reviewedPath ? `comment:${reviewedPath}` : "comment:summary");
          return { id: comments.length + 100 };
        },
        deleteReviewComment: async () => {},
      },
      openCodeClient: { review: async (value) => {
        reviews.push(value);
        const reviewedPath = value.prompt.includes(firstPath) ? firstPath : secondPath;
        events.push(`review:${reviewedPath}`);
        if (reviewedPath === secondPath) expect(events).toContain(`comment:${firstPath}`);
        return passResult();
      } },
      readFile: async (filePath) => sources.get(filePath),
      catalog,
      changedFiles: [{ status: "A", path: firstPath }, { status: "M", path: secondPath }],
      serverUrl: "https://github.example",
      headRepository: "fork-user/leetdash",
      headSha: "a".repeat(40),
      pullNumber: 42,
      runUrl: "https://github.example/actions/runs/9",
      mascotUrl,
      apiKey: "test-api-key",
      model: "opencode-go/kimi-k2.7-code",
      submissionOnly: true,
    });

    expect(checks).toHaveLength(1);
    expect(checks[0].headSha).toBe("a".repeat(40));
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({ model: "opencode-go/kimi-k2.7-code", apiKey: "test-api-key" });
    expect(reviews.map(({ prompt }) => prompt.includes("class Solution { int first; }"))).toEqual([true, false]);
    expect(reviews.map(({ prompt }) => prompt.includes("class Solution { int second; }"))).toEqual([false, true]);
    expect(comments).toHaveLength(3);
    expect(events).toEqual([
      `review:${firstPath}`,
      `comment:${firstPath}`,
      `review:${secondPath}`,
      `comment:${secondPath}`,
      "comment:summary",
    ]);
    expect(comments[2].body).toContain("<!-- leetdash-opencode-review -->");
    expect(completed).toHaveLength(1);
    expect(completed[0].conclusion).toBe("success");
    expect(result.results).toHaveLength(2);
    expect(result.results.map(({ path }) => path)).toEqual([firstPath, secondPath]);
    expect(result.results.every(({ markdown }) => markdown.includes("#### 요약"))).toBe(true);
  });

  it("posts a warning for one failed file and continues reviewing later files", async () => {
    const responses = [
      new ReviewFailure({ stage: "model-request", reason: "MODEL_REQUEST_FAILED", detail: "safe" }),
      passResult(),
    ];
    const reviewCalls = [];
    const { options, comments, completed } = reviewOptions({
      changedFiles: [{ status: "A", path: firstPath }, { status: "M", path: secondPath }],
      openCodeClient: { review: async ({ prompt }) => {
        reviewCalls.push(prompt);
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response;
      } },
    });

    const result = await reviewPullRequest(options);

    expect(reviewCalls).toHaveLength(2);
    expect(result.results.map(({ status }) => status)).toEqual(["warning", "reviewed"]);
    expect(comments.some(({ body }) => body.includes(firstPath) && body.includes("찰싹봇 리뷰 경고"))).toBe(true);
    expect(comments.find(({ body }) => body.includes(firstPath))?.body).toContain(
      `https://github.example/fork-user/leetdash/blob/${"a".repeat(40)}/${firstPath}`,
    );
    expect(comments.some(({ body }) => body.includes(secondPath) && body.includes("찰싹봇의 코드 리뷰"))).toBe(true);
    expect(result.markdown).toContain("리뷰 완료: 1개");
    expect(result.markdown).toContain("리뷰 경고: 1개");
    expect(result.markdown).toContain("댓글 전달 실패: 0개");
    expect(completed.at(-1)).toMatchObject({ conclusion: "success" });
  });

  it("turns invalid source permalink configuration into a sanitized file warning", async () => {
    const { options, comments, completed } = reviewOptions({ serverUrl: "http://github.example" });

    const result = await reviewPullRequest(options);

    expect(result.results).toMatchObject([{
      path: firstPath,
      status: "warning",
      failure: {
        stage: "catalog-resolve",
        reason: "CATALOG_MAPPING_FAILED",
        detail: "Review source link configuration is invalid.",
      },
    }]);
    expect(comments[0].body).toContain("찰싹봇 리뷰 경고");
    expect(comments[0].body).not.toContain("http://github.example");
    expect(completed.at(-1)).toMatchObject({ conclusion: "success" });
  });

  it("continues after one file comment delivery fails and reports only a sanitized count", async () => {
    const reviewCalls = [];
    const delivered = [];
    const { options, completed } = reviewOptions({
      changedFiles: [{ status: "A", path: firstPath }, { status: "M", path: secondPath }],
      openCodeClient: { review: async ({ prompt }) => { reviewCalls.push(prompt); return passResult(); } },
    });
    options.githubClient.upsertReviewComment = async ({ body }) => {
      if (body.includes(firstPath)) {
        throw new GitHubDeliveryFailure({ httpStatus: 503, requestId: "delivery-secret-1" });
      }
      delivered.push(body);
      return { id: delivered.length + 100 };
    };

    const result = await reviewPullRequest(options);

    expect(reviewCalls).toHaveLength(2);
    expect(delivered.some((body) => body.includes(secondPath))).toBe(true);
    expect(result.markdown).toContain("댓글 전달 실패: 1개");
    expect(completed.at(-1).summary).not.toContain("delivery-secret-1");
    expect(completed.at(-1)).toMatchObject({ conclusion: "success" });
  });

  it("reuses managed comment IDs and deletes stale file comments after all targets", async () => {
    const deleted = [];
    const upserts = [];
    const stalePath = "submissions/ada/top-interview-easy/999/solution.java";
    const { options } = reviewOptions({
      githubClient: {
        createCheck: async () => ({ id: 17 }),
        completeCheck: async () => {},
        listManagedReviewComments: async () => [
          { id: 31, kind: "summary" },
          { id: 32, kind: "file", key: reviewFileKey(firstPath) },
          { id: 33, kind: "file", key: reviewFileKey(stalePath) },
        ],
        upsertReviewComment: async (value) => { upserts.push(value); return { id: value.commentId ?? 44 }; },
        deleteReviewComment: async (commentId) => { deleted.push(commentId); },
      },
    });

    await reviewPullRequest(options);

    expect(upserts.map(({ commentId }) => commentId)).toEqual([32, 31]);
    expect(deleted).toEqual([33]);
  });

  it("keeps a possible code risk informational", async () => {
    const { options, completed, comments } = reviewOptions({
      openCodeClient: { review: async () => failResult() },
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(comments[0].body).toContain("#### 잠재적 위험");
    expect(comments[0].body).toContain("반복문이 마지막 원소에 도달하면");
  });

  it("renders a sanitized warning for a model failure and completes the check successfully", async () => {
    const rawSecret = "provider-response-secret";
    const { options, completed, comments } = reviewOptions({
      openCodeClient: { review: async () => { throw new Error(rawSecret); } },
    });

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(comments[0].body).toContain("## 찰싹봇 리뷰 경고");
    expect(comments[0].body).toContain("단계: model-request");
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

    const output = [...comments.map(({ body }) => body), completed[0].summary].join("\n");
    expect(output).toContain(requiredValue);
    expect(output).toContain(`커밋: ${"a".repeat(40)}`);
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
    const output = [...comments.map(({ body }) => body), completed[0].summary].join("\n");

    expect(result.results.map(({ markdown }) => markdown)).toEqual(["[submitted source redacted]", secondResult]);
    expect(output).toContain("#### Summary\nEvery edge case is handled.");
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
    const output = [result.markdown, ...comments.map(({ body }) => body), completed[0].summary].join("\n");

    expect(output).toContain(`#### Summary\n${summary}`);
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
    let storedBody = "";
    options.githubClient.listManagedReviewComments = async () => [
      { id: 32, kind: "file", key: reviewFileKey(firstPath) },
      { id: 31, kind: "summary" },
    ];
    options.githubClient.upsertReviewComment = async ({ commentId, body }) => {
      if (commentId === 32) storedBody = body;
    };

    await reviewPullRequest(options);

    expect(storedBody).toContain("#### 요약\n코드에서 직접 확인되는 위험은 없습니다.");
    expect(storedBody).not.toContain("리뷰 경고");
  });

  it("preserves a passing verdict when comment delivery fails", async () => {
    const { options, completed } = reviewOptions();
    options.githubClient.upsertReviewComment = async () => { throw new GitHubDeliveryFailure({ httpStatus: 503, requestId: "delivery-1" }); };

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(completed[0].summary).toContain("댓글 전달 실패: 2개");
    expect(completed[0].summary).not.toContain("delivery-1");
  });

  it("avoids duplicate comments when managed comment discovery fails", async () => {
    const { options, completed } = reviewOptions();
    let mutations = 0;
    options.githubClient.listManagedReviewComments = async () => {
      throw new GitHubDeliveryFailure({ httpStatus: 503, requestId: "discovery-1" });
    };
    options.githubClient.upsertReviewComment = async () => { mutations += 1; };
    options.githubClient.deleteReviewComment = async () => { mutations += 1; };

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(mutations).toBe(0);
    expect(completed[0].summary).toContain("댓글 전달 실패: 2개");
    expect(completed[0].summary).not.toContain("discovery-1");
  });

  it("reports a stale managed comment deletion failure and continues", async () => {
    const stalePath = "submissions/ada/top-interview-easy/999/solution.java";
    const { options, completed } = reviewOptions();
    options.githubClient.listManagedReviewComments = async () => [
      { id: 33, kind: "file", key: reviewFileKey(stalePath) },
    ];
    options.githubClient.deleteReviewComment = async () => {
      throw new GitHubDeliveryFailure({ httpStatus: 503, requestId: "delete-1" });
    };

    const result = await reviewPullRequest(options);

    expect(result.conclusion).toBe("success");
    expect(completed[0].summary).toContain("댓글 전달 실패: 1개");
    expect(completed[0].summary).not.toContain("delete-1");
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
    expect(comments[0].body).toContain("변경된 solution.* 파일이 없어 리뷰를 생략했습니다.");
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

    expect(result.failures[0]).toMatchObject({ stage: "path-parse", reason: "SUBMISSION_PATH_INVALID" });
    expect(result.conclusion).toBe("success");
    expect(completed[0].conclusion).toBe("success");
    expect(comments[0].body).toContain("## 찰싹봇 리뷰 경고");
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
    const comments = [];
    const sourceReads = [];
    const prompts = [];
    const source = "class Solution { int fetchedAsData; }";
    const headSha = "b".repeat(40);
    const githubClient = {
      createCheck: async (value) => { checks.push(value); return { id: 17 }; },
      completeCheck: async (value) => { checks.push(value); },
      listManagedReviewComments: async () => [],
      upsertReviewComment: async (value) => { comments.push(value); },
      deleteReviewComment: async () => {},
      getPullRequest: async () => ({ number: 42, changed_files: 1, user: { login: "ada" }, base: { sha: "base-sha" }, head: { sha: headSha, repo: { full_name: "fork-user/leetdash" } } }),
      listPullRequestFiles: async () => [{ status: "modified", filename: firstPath }],
      getFileContent: async (value) => { sourceReads.push(value); return source; },
    };

    const outcome = await main({
      mascotUrl,
      argv: ["--base", "base-sha", "--head", headSha, "--pull-number", "42"],
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
    expect(sourceReads).toEqual([{ path: firstPath, ref: headSha, repository: "fork-user/leetdash" }]);
    expect(prompts[0]).toContain(source);
    expect(comments[0].body).toContain(`https://github.example/fork-user/leetdash/blob/${headSha}/${firstPath}`);
    expect(checks[0]).toMatchObject({ headSha });
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
      mascotUrl,
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
      listManagedReviewComments: async () => [],
      upsertReviewComment: async () => {},
      deleteReviewComment: async () => {},
      getPullRequest: async () => ({ number: 42, changed_files: 1, user: { login: "ada" }, base: { sha: "base-sha" }, head: { sha: "head-sha", repo: { full_name: "example/leetdash" } } }),
      listPullRequestFiles: async () => [{ status: "modified", filename: firstPath }],
      getFileContent: async () => { throw new Error("source must not be fetched without review configuration"); },
    };

    const outcome = await main({
      mascotUrl,
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
      mascotUrl,
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
      mascotUrl,
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
