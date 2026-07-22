import { describe, expect, it, vi } from "vitest";

import { GitHubReviewClient, OpenCodeClient } from "../scripts/opencode-review-clients.mjs";
import { reviewContentKey, reviewContentMarker, reviewFileKey, reviewFileMarker } from "../scripts/opencode-review-core.mjs";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("OpenCodeClient", () => {
  it("sends the provider-stripped model request and returns only assistant content", async () => {
    const requests = [];
    const client = new OpenCodeClient({
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse({ choices: [{ message: { role: "assistant", content: "review result" } }] });
      },
    });

    await expect(client.review({
      model: "opencode-go/kimi-k2.7-code",
      apiKey: "test-secret",
      prompt: "review prompt",
    })).resolves.toBe("review result");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://opencode.ai/zen/go/v1/chat/completions");
    expect(requests[0].init.headers.Authorization).toBe("Bearer test-secret");
    expect(JSON.parse(requests[0].init.body)).toEqual({
      model: "kimi-k2.7-code",
      messages: [{ role: "user", content: "review prompt" }],
    });
  });

  it("times out stalled response-body parsing with a sanitized model-request failure", async () => {
    vi.useFakeTimers();
    const apiKey = "body-timeout-api-key";
    const rawBody = "raw-pending-provider-body";
    let requestSignal;
    try {
      const client = new OpenCodeClient({
        fetchImpl: async (_url, init) => {
          requestSignal = init.signal;
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => new Promise(() => rawBody),
          };
        },
      });
      const failurePromise = client.review({
        model: "opencode-go/kimi-k2.7-code",
        apiKey,
        prompt: "review prompt",
      }).catch((failure) => failure);

      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(179_999);
      expect(requestSignal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      const failure = await failurePromise;

      expect(requestSignal).toBeInstanceOf(AbortSignal);
      expect(requestSignal.aborted).toBe(true);
      expect(failure).toMatchObject({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "OpenCode request failed.",
      });
      expect(failure.detail).not.toContain(apiKey);
      expect(failure.detail).not.toContain(rawBody);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("redacts API keys and provider response bodies from request failures", async () => {
    const apiKey = "test-secret";
    const responseBody = "provider-body-secret";
    const client = new OpenCodeClient({
      fetchImpl: async () => jsonResponse({ error: responseBody }, { status: 429, headers: { "request-id": "oc-request-1" } }),
    });

    await expect(client.review({ model: "opencode-go/kimi-k2.7-code", apiKey, prompt: "review prompt" })).rejects.toMatchObject({
      stage: "model-request",
      reason: "MODEL_REQUEST_FAILED",
      retryable: true,
      httpStatus: 429,
      requestId: "oc-request-1",
    });
    await client.review({ model: "opencode-go/kimi-k2.7-code", apiKey, prompt: "review prompt" }).catch((failure) => {
      expect(failure.detail).not.toContain(apiKey);
      expect(failure.detail).not.toContain(responseBody);
    });
  });

  it.each([
    "other/kimi-k2.7-code",
    "opencode-go/other-model",
    "opencode-go/kimi-k2.7-code-extra",
    "kimi-k2.7-code",
    "",
  ])("rejects unsupported configured model %j before fetching", async (model) => {
    let fetches = 0;
    const fetchImpl = async () => { fetches += 1; };
    const client = new OpenCodeClient({ fetchImpl });

    await expect(client.review({ model, apiKey: "test-secret", prompt: "review prompt" })).rejects.toMatchObject({
      stage: "model-request",
      reason: "MODEL_REQUEST_FAILED",
      retryable: false,
    });
    expect(fetches).toBe(0);
  });

  it.each([
    ["no choices", { choices: [] }],
    ["multiple choices", { choices: [{ message: { role: "assistant", content: "first" } }, { message: { role: "assistant", content: "second" } }] }],
    ["non-assistant role", { choices: [{ message: { role: "user", content: "review result" } }] }],
    ["missing role", { choices: [{ message: { content: "review result" } }] }],
    ["blank content", { choices: [{ message: { role: "assistant", content: "  " } }] }],
    ["non-string content", { choices: [{ message: { role: "assistant", content: [{ type: "text", text: "review" }] } }] }],
  ])("rejects %s through the sanitized model-response failure", async (_name, body) => {
    const rawSentinel = "raw-choice-sentinel";
    const client = new OpenCodeClient({ fetchImpl: async () => jsonResponse({ ...body, rawSentinel }) });

    await expect(client.review({
      model: "opencode-go/kimi-k2.7-code",
      apiKey: "test-secret",
      prompt: "review prompt",
    })).rejects.toMatchObject({
      stage: "model-response",
      reason: "MODEL_RESPONSE_INVALID",
      retryable: false,
    });
    await client.review({
      model: "opencode-go/kimi-k2.7-code",
      apiKey: "test-secret",
      prompt: "review prompt",
    }).catch((failure) => expect(failure.detail).not.toContain(rawSentinel));
  });
});

describe("GitHubReviewClient", () => {
  it("loads pull-request metadata, changed files, and exact-head source through REST", async () => {
    const requests = [];
    const source = "class Solution { int trustedDataOnly; }";
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async (url, init) => {
        const requestUrl = new URL(url);
        requests.push({ url: requestUrl, init });
        if (requestUrl.pathname.endsWith("/pulls/42")) {
          return jsonResponse({ number: 42, changed_files: 1, base: { sha: "base-123" }, head: { sha: "head-123", repo: { full_name: "fork-user/leetdash" } } });
        }
        if (requestUrl.pathname.endsWith("/pulls/42/files")) {
          return jsonResponse([{ status: "modified", filename: "submissions/ada/list/1/solution.java" }]);
        }
        if (requestUrl.pathname.includes("/contents/")) {
          return jsonResponse({ type: "file", encoding: "base64", content: Buffer.from(source).toString("base64") });
        }
        throw new Error(`Unexpected request: ${requestUrl}`);
      },
    });

    await expect(client.getPullRequest(42)).resolves.toMatchObject({ number: 42 });
    await expect(client.listPullRequestFiles(42)).resolves.toHaveLength(1);
    await expect(client.getFileContent({
      path: "submissions/ada/list/1/solution.java",
      ref: "head-123",
      repository: "fork-user/leetdash",
    })).resolves.toBe(source);

    const contentRequest = requests.find(({ url }) => url.pathname.includes("/contents/"));
    expect(contentRequest.url.pathname).toBe("/repos/fork-user/leetdash/contents/submissions/ada/list/1/solution.java");
    expect(contentRequest.url.searchParams.get("ref")).toBe("head-123");
    expect(requests.every(({ init }) => init.method === "GET")).toBe(true);
  });

  it("creates and completes a check for the exact head SHA", async () => {
    const requests = [];
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse({ id: 91 });
      },
    });

    await expect(client.createCheck({ headSha: "head-123", title: "Review started", summary: "Review is running." })).resolves.toEqual({ id: 91 });
    await expect(client.completeCheck({ checkRunId: 91, conclusion: "success", title: "Review complete", summary: "All reviews passed." })).resolves.toEqual({ id: 91 });

    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe("https://api.github.com/repos/example/leetdash/check-runs");
    expect(requests[0].init.method).toBe("POST");
    expect(JSON.parse(requests[0].init.body)).toEqual({
      name: "opencode-review",
      head_sha: "head-123",
      status: "in_progress",
      output: { title: "Review started", summary: "Review is running." },
    });
    expect(requests[1].url).toBe("https://api.github.com/repos/example/leetdash/check-runs/91");
    expect(requests[1].init.method).toBe("PATCH");
    expect(JSON.parse(requests[1].init.body)).toEqual({
      status: "completed",
      conclusion: "success",
      output: { title: "Review complete", summary: "All reviews passed." },
    });
    requests.forEach(({ init }) => {
      expect(init.headers).toMatchObject({
        Accept: "application/vnd.github+json",
        Authorization: "Bearer github-secret",
        "X-GitHub-Api-Version": "2022-11-28",
      });
    });
  });

  it("paginates and discovers only managed GitHub Actions comments", async () => {
    const requests = [];
    const reviewPath = "submissions/ada/programmers/12906/solution.java";
    const contentKey = reviewContentKey("class Solution {}");
    const summary = { id: 301, body: "<!-- leetdash-opencode-review -->\nsummary", user: { login: "github-actions[bot]" } };
    const spoof = { id: 302, body: `${reviewFileMarker(reviewPath)}\nspoof`, user: { login: "ada" } };
    const file = { id: 303, body: `${reviewFileMarker(reviewPath)}\n${reviewContentMarker(contentKey)}\nfile`, user: { login: "github-actions[bot]" } };
    const pageOne = [...Array.from({ length: 98 }, (_, index) => ({ id: index + 1, body: "ordinary", user: { login: "ada" } })), summary, spoof];
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        const requestUrl = new URL(url);
        return jsonResponse(requestUrl.searchParams.get("page") === "1" ? pageOne : [file]);
      },
    });

    await expect(client.listManagedReviewComments(7)).resolves.toEqual([
      { id: summary.id, kind: "summary" },
      { id: file.id, kind: "file", key: reviewFileKey(reviewPath), contentKey },
    ]);

    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.github.com/repos/example/leetdash/issues/7/comments?per_page=100&page=1",
      "https://api.github.com/repos/example/leetdash/issues/7/comments?per_page=100&page=2",
    ]);
  });

  it("creates, updates, and deletes review comments using resolved IDs", async () => {
    const requests = [];
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return init.method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse({ id: 44 });
      },
    });

    await expect(client.upsertReviewComment({ pullNumber: 7, commentId: 32, body: "updated" })).resolves.toEqual({ id: 44 });
    await expect(client.upsertReviewComment({ pullNumber: 7, body: "created" })).resolves.toEqual({ id: 44 });
    await expect(client.deleteReviewComment(32)).resolves.toBeNull();

    expect(requests.map(({ url, init }) => ({ path: new URL(url).pathname, method: init.method }))).toEqual([
      { path: "/repos/example/leetdash/issues/comments/32", method: "PATCH" },
      { path: "/repos/example/leetdash/issues/7/comments", method: "POST" },
      { path: "/repos/example/leetdash/issues/comments/32", method: "DELETE" },
    ]);
    expect(JSON.parse(requests[0].init.body)).toEqual({ body: "updated" });
    expect(JSON.parse(requests[1].init.body)).toEqual({ body: "created" });
  });

  it("returns a sanitized dedicated failure for comment delivery", async () => {
    const secret = "github-secret";
    const rawBody = "github-response-secret";
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: secret,
      fetchImpl: async () => jsonResponse({ error: rawBody }, { status: 503, headers: { "cf-ray": "gh-request-1" } }),
    });

    await expect(client.upsertReviewComment({ pullNumber: 7, body: "<!-- leetdash-opencode-review -->\nnew review" })).rejects.toMatchObject({
      name: "GitHubDeliveryFailure",
      detail: "GitHub review comment delivery failed",
      retryable: true,
      httpStatus: 503,
      requestId: "gh-request-1",
    });
    await client.upsertReviewComment({ pullNumber: 7, body: "<!-- leetdash-opencode-review -->\nnew review" }).catch((failure) => {
      expect(failure.stage).toBeUndefined();
      expect(failure.reason).toBeUndefined();
      expect(failure.detail).not.toContain(secret);
      expect(failure.detail).not.toContain(rawBody);
    });
  });

  it("sanitizes malformed successful comment pages", async () => {
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async () => jsonResponse({ unexpected: "comment response" }),
    });

    await expect(client.listManagedReviewComments(7)).rejects.toMatchObject({
      name: "GitHubDeliveryFailure",
      detail: "GitHub review comment delivery failed",
    });
  });
});
