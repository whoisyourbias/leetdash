import { ReviewFailure } from "./opencode-review-core.mjs";

const leetCodeGraphqlUrl = "https://leetcode.com/graphql";
const openCodeChatCompletionsUrl = "https://opencode.ai/zen/go/v1/chat/completions";
const openCodeConfiguredModel = "opencode-go/kimi-k2.7-code";
const openCodeApiModel = "kimi-k2.7-code";
const reviewCommentMarker = "<!-- leetdash-opencode-review -->";
const externalRequestTimeoutMs = 60_000;

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), externalRequestTimeoutMs);
    let response;
    try {
      response = await this.fetchImpl(leetCodeGraphqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title titleSlug difficulty content exampleTestcases metaData codeSnippets { lang langSlug code } topicTags { name slug } } }",
          variables: { titleSlug },
        }),
        signal: controller.signal,
      });
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
    } catch (error) {
      if (error instanceof ReviewFailure) throw error;
      throw new ReviewFailure({
        stage: "problem-fetch",
        reason: "PROBLEM_FETCH_FAILED",
        detail: "LeetCode request failed.",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

class OpenCodeClient {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
  }

  async review({ model, apiKey, prompt }) {
    if (model !== openCodeConfiguredModel) {
      throw new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "OpenCode model is invalid.",
      });
    }

    const controller = new AbortController();
    const requestFailure = () => new ReviewFailure({
      stage: "model-request",
      reason: "MODEL_REQUEST_FAILED",
      detail: "OpenCode request failed.",
    });
    let timeout;
    const timeoutFailure = new Promise((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(requestFailure());
        controller.abort();
      }, externalRequestTimeoutMs);
    });
    try {
      let response;
      try {
        response = await Promise.race([
          this.fetchImpl(openCodeChatCompletionsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: openCodeApiModel,
              temperature: 0,
              messages: [{ role: "user", content: prompt }],
            }),
            signal: controller.signal,
          }),
          timeoutFailure,
        ]);
      } catch (error) {
        if (error instanceof ReviewFailure) throw error;
        throw requestFailure();
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
        body = await Promise.race([response.json(), timeoutFailure]);
      } catch (error) {
        if (error instanceof ReviewFailure) throw error;
        if (controller.signal.aborted) throw requestFailure();
        throw new ReviewFailure({
          stage: "model-response",
          reason: "MODEL_RESPONSE_INVALID",
          detail: "OpenCode returned an invalid response.",
        });
      }
      const choices = body?.choices;
      const message = Array.isArray(choices) && choices.length === 1 ? choices[0]?.message : undefined;
      const content = message?.content;
      if (message?.role !== "assistant" || typeof content !== "string" || content.trim().length === 0) {
        throw new ReviewFailure({
          stage: "model-response",
          reason: "MODEL_RESPONSE_INVALID",
          detail: "OpenCode response is missing assistant content.",
        });
      }
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}

class GitHubReviewClient {
  constructor({ repository, token, fetchImpl = fetch } = {}) {
    this.repository = repository;
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, apiPath, { body, params, repository = this.repository, FailureType = GitHubApiFailure } = {}) {
    const url = new URL(`https://api.github.com/repos/${repository}${apiPath}`);
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

  getPullRequest(pullNumber) {
    return this.request("GET", `/pulls/${pullNumber}`);
  }

  async listPullRequestFiles(pullNumber) {
    const files = [];
    for (let page = 1; ; page += 1) {
      const result = await this.request("GET", `/pulls/${pullNumber}/files`, {
        params: { per_page: 100, page },
      });
      if (!Array.isArray(result)) throw new GitHubApiFailure({ detail: "GitHub API request failed." });
      files.push(...result);
      if (result.length < 100) return files;
    }
  }

  async getFileContent({ path, ref, repository = this.repository }) {
    const segments = typeof path === "string" ? path.split("/") : [];
    if (
      typeof repository !== "string"
      || !/^[^/\s]+\/[^/\s]+$/.test(repository)
      || segments.length === 0
      || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))
    ) {
      throw new GitHubApiFailure({ detail: "GitHub API request failed." });
    }
    const apiPath = `/contents/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
    const result = await this.request("GET", apiPath, { params: { ref }, repository });
    if (result?.type !== "file" || result?.encoding !== "base64" || typeof result?.content !== "string") {
      throw new GitHubApiFailure({ detail: "GitHub API request failed." });
    }
    try {
      return Buffer.from(result.content.replace(/\s/g, ""), "base64").toString("utf8");
    } catch {
      throw new GitHubApiFailure({ detail: "GitHub API request failed." });
    }
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
