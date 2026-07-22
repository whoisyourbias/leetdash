import { describe, expect, it } from "vitest";

import { GitHubReviewClient, LeetCodeClient, OpenCodeClient } from "../scripts/opencode-review-clients.mjs";

const rawQuestion = {
  content: "<p>Find two numbers.</p>",
  exampleTestcases: "[2,7,11,15]\n9",
  metaData: JSON.stringify({ name: "twoSum", params: [{ name: "nums", type: "integer[]" }] }),
  codeSnippets: [{ lang: "Java", langSlug: "java", code: "class Solution { public int[] twoSum(int[] nums, int target) {} }" }],
  topicTags: [{ name: "Array", slug: "array" }],
};

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("LeetCodeClient", () => {
  it("deduplicates concurrent slug requests without writing a permanent cache", async () => {
    const requests = [];
    const fetchImpl = async (url, init) => {
      requests.push({ url: String(url), init });
      return jsonResponse({ data: { question: rawQuestion } });
    };
    const client = new LeetCodeClient({ fetchImpl });

    const [first, second] = await Promise.all([client.getQuestion("two-sum"), client.getQuestion("two-sum")]);

    expect(first).toEqual(rawQuestion);
    expect(second).toEqual(rawQuestion);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://leetcode.com/graphql");
    const request = JSON.parse(requests[0].init.body);
    expect(request.query).toContain("question(titleSlug: $titleSlug)");
    ["questionFrontendId", "title", "titleSlug", "difficulty", "content", "exampleTestcases", "metaData", "codeSnippets", "topicTags"].forEach((field) => {
      expect(request.query).toContain(field);
    });
    expect(request.variables).toEqual({ titleSlug: "two-sum" });
  });

  it("returns a redacted retryable failure for LeetCode HTTP errors", async () => {
    const secret = "Authorization: Bearer leetcode-secret";
    const client = new LeetCodeClient({
      fetchImpl: async () => jsonResponse({ message: secret }, { status: 503, headers: { "x-request-id": "lc-request-1" } }),
    });

    await expect(client.getQuestion("two-sum")).rejects.toMatchObject({
      stage: "problem-fetch",
      reason: "PROBLEM_FETCH_FAILED",
      retryable: true,
      httpStatus: 503,
      requestId: "lc-request-1",
    });
    await client.getQuestion("another-slug").catch((failure) => {
      expect(failure.detail).not.toContain(secret);
      expect(failure.detail).not.toContain("message");
    });
  });
});

describe("OpenCodeClient", () => {
  it("sends the provider-stripped model request and returns only assistant content", async () => {
    const requests = [];
    const client = new OpenCodeClient({
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse({ choices: [{ message: { content: "review result" } }] });
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
      temperature: 0,
      messages: [{ role: "user", content: "review prompt" }],
    });
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

  it("rejects models outside the exact OpenCode provider prefix before fetching", async () => {
    const fetchImpl = async () => {
      throw new Error("fetch should not run");
    };
    const client = new OpenCodeClient({ fetchImpl });

    await expect(client.review({ model: "other/kimi-k2.7-code", apiKey: "test-secret", prompt: "review prompt" })).rejects.toMatchObject({
      stage: "model-request",
      reason: "MODEL_REQUEST_FAILED",
      retryable: false,
    });
  });
});

describe("GitHubReviewClient", () => {
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

  it("paginates comments and updates only an existing marked GitHub Actions comment", async () => {
    const requests = [];
    const userMarker = { id: 20, body: "<!-- leetdash-opencode-review -->\nuser content", user: { login: "ada" } };
    const pageOne = [...Array.from({ length: 99 }, (_, index) => ({ id: index + 1, body: "ordinary", user: { login: "ada" } })), userMarker];
    const botMarker = { id: 33, body: "<!-- leetdash-opencode-review -->\nold review", user: { login: "github-actions[bot]" } };
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        const requestUrl = new URL(url);
        if (init.method === "GET") {
          return jsonResponse(requestUrl.searchParams.get("page") === "1" ? pageOne : [botMarker]);
        }
        return jsonResponse({ id: botMarker.id });
      },
    });

    await expect(client.upsertReviewComment({ pullNumber: 7, body: "<!-- leetdash-opencode-review -->\nnew review" })).resolves.toEqual({ id: 33 });

    expect(requests.slice(0, 2).map(({ url }) => url)).toEqual([
      "https://api.github.com/repos/example/leetdash/issues/7/comments?per_page=100&page=1",
      "https://api.github.com/repos/example/leetdash/issues/7/comments?per_page=100&page=2",
    ]);
    expect(requests[2].url).toBe("https://api.github.com/repos/example/leetdash/issues/comments/33");
    expect(requests[2].init.method).toBe("PATCH");
    expect(JSON.parse(requests[2].init.body)).toEqual({ body: "<!-- leetdash-opencode-review -->\nnew review" });
    expect(requests.some(({ url }) => url.endsWith(`/comments/${userMarker.id}`))).toBe(false);
  });

  it("posts a marked review comment when no GitHub Actions marker exists", async () => {
    const requests = [];
    const client = new GitHubReviewClient({
      repository: "example/leetdash",
      token: "github-secret",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse(init.method === "GET" ? [] : { id: 44 });
      },
    });

    await expect(client.upsertReviewComment({ pullNumber: 7, body: "<!-- leetdash-opencode-review -->\nnew review" })).resolves.toEqual({ id: 44 });
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toBe("https://api.github.com/repos/example/leetdash/issues/7/comments");
    expect(requests[1].init.method).toBe("POST");
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

    await expect(client.upsertReviewComment({ pullNumber: 7, body: "<!-- leetdash-opencode-review -->\nnew review" })).rejects.toMatchObject({
      name: "GitHubDeliveryFailure",
      detail: "GitHub review comment delivery failed",
    });
  });
});
