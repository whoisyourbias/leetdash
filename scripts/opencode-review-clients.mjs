import { ReviewFailure } from "./opencode-review-core.mjs";

const leetCodeGraphqlUrl = "https://leetcode.com/graphql";
const openCodeChatCompletionsUrl = "https://opencode.ai/zen/go/v1/chat/completions";
const reviewCommentMarker = "<!-- leetdash-opencode-review -->";

function extractRequestId(response) {
  const headers = response?.headers;
  if (!headers) return undefined;
  for (const name of ["x-request-id", "request-id", "cf-ray"]) {
    const value = typeof headers.get === "function" ? headers.get(name) : headers[name] ?? headers[name.toLowerCase()];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);
}

function toSafeHttpFailure({ stage, reason, response, detail = "External service request failed." }) {
  const httpStatus = response?.status;
  return new ReviewFailure({
    stage,
    reason,
    detail,
    retryable: isRetryableStatus(httpStatus),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(extractRequestId(response) === undefined ? {} : { requestId: extractRequestId(response) }),
  });
}

class GitHubApiFailure extends Error {
  constructor({ detail, retryable = false, httpStatus, requestId }) {
    super(detail);
    this.name = "GitHubApiFailure";
    this.detail = detail;
    this.retryable = retryable;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

class GitHubDeliveryFailure extends Error {
  constructor({ retryable = false, httpStatus, requestId }) {
    const detail = "GitHub review comment delivery failed";
    super(detail);
    this.name = "GitHubDeliveryFailure";
    this.detail = detail;
    this.retryable = retryable;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

function toSafeGitHubFailure(FailureType, response) {
  const httpStatus = response?.status;
  const requestId = extractRequestId(response);
  return new FailureType({
    ...(FailureType === GitHubApiFailure ? { detail: "GitHub API request failed." } : {}),
    retryable: isRetryableStatus(httpStatus),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(requestId === undefined ? {} : { requestId }),
  });
}

class LeetCodeClient {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
    this.questions = new Map();
  }

  getQuestion(titleSlug) {
    if (!this.questions.has(titleSlug)) {
      this.questions.set(titleSlug, this.fetchQuestion(titleSlug));
    }
    return this.questions.get(titleSlug);
  }

  async fetchQuestion(titleSlug) {
    let response;
    try {
      response = await this.fetchImpl(leetCodeGraphqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title titleSlug difficulty content exampleTestcases metaData codeSnippets { lang langSlug code } topicTags { name slug } } }",
          variables: { titleSlug },
        }),
      });
    } catch {
      throw new ReviewFailure({
        stage: "problem-fetch",
        reason: "PROBLEM_FETCH_FAILED",
        detail: "LeetCode request failed.",
      });
    }

    if (!response?.ok) {
      throw toSafeHttpFailure({
        stage: "problem-fetch",
        reason: "PROBLEM_FETCH_FAILED",
        response,
        detail: "LeetCode request failed.",
      });
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new ReviewFailure({
        stage: "problem-fetch",
        reason: "PROBLEM_FETCH_FAILED",
        detail: "LeetCode returned an invalid response.",
      });
    }
    if (Array.isArray(body?.errors) || !body?.data?.question) {
      throw new ReviewFailure({
        stage: "problem-fetch",
        reason: "PROBLEM_FETCH_FAILED",
        detail: "LeetCode question data is unavailable.",
      });
    }
    return body.data.question;
  }
}

class OpenCodeClient {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
  }

  async review({ model, apiKey, prompt }) {
    if (typeof model !== "string" || !model.startsWith("opencode-go/") || model.length === "opencode-go/".length) {
      throw new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "OpenCode model is invalid.",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response;
    try {
      response = await this.fetchImpl(openCodeChatCompletionsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.slice("opencode-go/".length),
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
    } catch {
      throw new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "OpenCode request failed.",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response?.ok) {
      throw toSafeHttpFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        response,
        detail: "OpenCode request failed.",
      });
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new ReviewFailure({
        stage: "model-response",
        reason: "MODEL_RESPONSE_INVALID",
        detail: "OpenCode returned an invalid response.",
      });
    }
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new ReviewFailure({
        stage: "model-response",
        reason: "MODEL_RESPONSE_INVALID",
        detail: "OpenCode response is missing assistant content.",
      });
    }
    return content;
  }
}

class GitHubReviewClient {
  constructor({ repository, token, fetchImpl = fetch } = {}) {
    this.repository = repository;
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, apiPath, { body, params, FailureType = GitHubApiFailure } = {}) {
    const url = new URL(`https://api.github.com/repos/${this.repository}${apiPath}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw toSafeGitHubFailure(FailureType);
    }
    if (!response?.ok) {
      throw toSafeGitHubFailure(FailureType, response);
    }
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      throw toSafeGitHubFailure(FailureType, response);
    }
  }

  createCheck({ headSha, title, summary }) {
    return this.request("POST", "/check-runs", {
      body: {
        name: "opencode-review",
        head_sha: headSha,
        status: "in_progress",
        output: { title, summary },
      },
    });
  }

  completeCheck({ checkRunId, conclusion, title, summary }) {
    return this.request("PATCH", `/check-runs/${checkRunId}`, {
      body: {
        status: "completed",
        conclusion,
        output: { title, summary },
      },
    });
  }

  async listIssueComments(pullNumber) {
    const comments = [];
    for (let page = 1; ; page += 1) {
      const result = await this.request("GET", `/issues/${pullNumber}/comments`, {
        params: { per_page: 100, page },
        FailureType: GitHubDeliveryFailure,
      });
      if (!Array.isArray(result)) throw new GitHubDeliveryFailure({});
      comments.push(...result);
      if (result.length < 100) return comments;
    }
  }

  async upsertReviewComment({ pullNumber, body }) {
    const comments = await this.listIssueComments(pullNumber);
    const existing = comments.find((comment) => (
      comment?.user?.login === "github-actions[bot]"
      && typeof comment.body === "string"
      && comment.body.includes(reviewCommentMarker)
    ));
    if (existing) {
      return this.request("PATCH", `/issues/comments/${existing.id}`, { body: { body }, FailureType: GitHubDeliveryFailure });
    }
    return this.request("POST", `/issues/${pullNumber}/comments`, { body: { body }, FailureType: GitHubDeliveryFailure });
  }
}

export {
  GitHubDeliveryFailure,
  GitHubReviewClient,
  LeetCodeClient,
  OpenCodeClient,
  extractRequestId,
  isRetryableStatus,
  toSafeHttpFailure,
};
