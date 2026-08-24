import { randomUUID } from "node:crypto";

import {
  getOpenCodeModelProfile,
  isRetryableStatus,
  openCodeRequestTimeoutMs,
  parseAssistantResponse,
  parseMessagesAssistantResponse,
} from "./opencode-api-contract.mjs";
import { parseManagedReviewMarker, ReviewFailure } from "./opencode-review-core.mjs";

const goUsageLimitErrorName = "GoUsageLimitError";

function extractRequestId(response) {
  const headers = response?.headers;
  if (!headers) return undefined;
  for (const name of ["x-request-id", "request-id", "cf-ray"]) {
    const value = typeof headers.get === "function" ? headers.get(name) : headers[name] ?? headers[name.toLowerCase()];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function toSafeHttpFailure({ stage, reason, response, clientRequestId, detail = "External service request failed." }) {
  const httpStatus = response?.status;
  return new ReviewFailure({
    stage,
    reason,
    detail,
    retryable: isRetryableStatus(httpStatus),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(extractRequestId(response) === undefined ? {} : { requestId: extractRequestId(response) }),
    clientRequestId,
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

class OpenCodeClient {
  constructor({ fetchImpl = fetch, logger = console, requestIdFactory = randomUUID } = {}) {
    this.fetchImpl = fetchImpl;
    this.logger = logger;
    this.requestIdFactory = requestIdFactory;
  }

  async review({ model, apiKey, prompt, attempt = 1 }) {
    const profile = getOpenCodeModelProfile(model);
    if (!profile) {
      throw new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "OpenCode model is invalid.",
      });
    }

    const clientRequestId = this.requestIdFactory();
    const logOutcome = ({ outcome, status, requestId }) => {
      const fields = [
        `outcome=${outcome}`,
        `attempt=${attempt}`,
        `client_request_id=${clientRequestId}`,
      ];
      if (status !== undefined) fields.push(`status=${status}`);
      if (requestId !== undefined) fields.push(`provider_request_id=${requestId}`);
      try {
        this.logger?.log?.(`OpenCode request ${fields.join(" ")}`);
      } catch {
        // Diagnostics must never change the review outcome.
      }
    };
    const controller = new AbortController();
    const requestFailure = () => new ReviewFailure({
      stage: "model-request",
      reason: "MODEL_REQUEST_FAILED",
      retryable: true,
      detail: "OpenCode request failed due to a transport error.",
      clientRequestId,
    });
    let timeout;
    const timeoutFailure = new Promise((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new ReviewFailure({
          stage: "model-request",
          reason: "MODEL_REQUEST_FAILED",
          retryable: true,
          detail: `OpenCode request timed out after ${openCodeRequestTimeoutMs / 1000}s.`,
          clientRequestId,
        }));
        controller.abort();
      }, openCodeRequestTimeoutMs);
    });
    try {
      let response;
      try {
        const requestBody = profile.protocol === "messages"
          ? {
              model: profile.apiModel,
              max_tokens: profile.maxTokens,
              messages: [{ role: "user", content: prompt }],
            }
          : {
              model: profile.apiModel,
              messages: [{ role: "user", content: prompt }],
            };
        const authenticationHeaders = profile.protocol === "messages"
          ? {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            }
          : { Authorization: `Bearer ${apiKey}` };
        response = await Promise.race([
          this.fetchImpl(profile.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authenticationHeaders,
              "x-opencode-request": clientRequestId,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          }),
          timeoutFailure,
        ]);
      } catch (error) {
        const failure = error instanceof ReviewFailure ? error : requestFailure();
        logOutcome({ outcome: "failure" });
        throw failure;
      }

      let rawBody;
      let body;
      try {
        if (typeof response?.text === "function") {
          rawBody = await Promise.race([response.text(), timeoutFailure]);
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = undefined;
          }
        } else {
          body = await Promise.race([response?.json?.(), timeoutFailure]);
          rawBody = JSON.stringify(body);
        }
      } catch (error) {
        if (error instanceof ReviewFailure) {
          logOutcome({ outcome: "failure" });
          throw error;
        }
        const failure = response?.ok
          ? new ReviewFailure({
              stage: "model-response",
              reason: "MODEL_RESPONSE_INVALID",
              detail: "OpenCode returned an invalid response.",
              clientRequestId,
            })
          : toSafeHttpFailure({
              stage: "model-request",
              reason: "MODEL_REQUEST_FAILED",
              response,
              clientRequestId,
            });
        logOutcome({ outcome: "failure", status: response?.status, requestId: extractRequestId(response) });
        throw failure;
      }

      if (typeof rawBody === "string" && rawBody.includes(goUsageLimitErrorName)) {
        const failure = new ReviewFailure({
          stage: "model-request",
          reason: "MODEL_USAGE_LIMIT_EXHAUSTED",
          detail: "OpenCode Go model usage limit is exhausted.",
          retryable: false,
          ...(response?.status === undefined ? {} : { httpStatus: response.status }),
          ...(extractRequestId(response) === undefined ? {} : { requestId: extractRequestId(response) }),
          clientRequestId,
        });
        logOutcome({ outcome: "usage-limit", status: response?.status, requestId: extractRequestId(response) });
        throw failure;
      }

      if (!response?.ok) {
        const failure = toSafeHttpFailure({
          stage: "model-request",
          reason: "MODEL_REQUEST_FAILED",
          response,
          clientRequestId,
          detail: `OpenCode request failed (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`,
        });
        logOutcome({ outcome: "failure", status: failure.httpStatus, requestId: failure.requestId });
        throw failure;
      }

      const parsed = profile.protocol === "messages"
        ? parseMessagesAssistantResponse(body)
        : parseAssistantResponse(body);
      if (!parsed.ok) {
        const failure = new ReviewFailure({
          stage: "model-response",
          reason: "MODEL_RESPONSE_INVALID",
          detail: "OpenCode response is missing assistant content.",
          clientRequestId,
        });
        logOutcome({ outcome: "failure", status: response.status, requestId: extractRequestId(response) });
        throw failure;
      }
      logOutcome({ outcome: "success", status: response.status, requestId: extractRequestId(response) });
      return parsed.content;
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

  setCommitStatus({ sha, state, description, targetUrl }) {
    return this.request("POST", `/statuses/${sha}`, {
      body: {
        context: "opencode-review-gate",
        state,
        description,
        target_url: targetUrl,
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

  async listManagedReviewComments(pullNumber) {
    const comments = await this.listIssueComments(pullNumber);
    return comments.flatMap((comment) => {
      if (comment?.user?.login !== "github-actions[bot]" || !Number.isSafeInteger(comment.id)) return [];
      const marker = parseManagedReviewMarker(comment.body);
      return marker ? [{ id: comment.id, ...marker }] : [];
    });
  }

  upsertReviewComment({ pullNumber, commentId, body }) {
    if (commentId !== undefined) {
      if (!Number.isSafeInteger(commentId)) throw new GitHubDeliveryFailure({});
      return this.request("PATCH", `/issues/comments/${commentId}`, {
        body: { body },
        FailureType: GitHubDeliveryFailure,
      });
    }
    return this.request("POST", `/issues/${pullNumber}/comments`, {
      body: { body },
      FailureType: GitHubDeliveryFailure,
    });
  }

  deleteReviewComment(commentId) {
    if (!Number.isSafeInteger(commentId)) throw new GitHubDeliveryFailure({});
    return this.request("DELETE", `/issues/comments/${commentId}`, {
      FailureType: GitHubDeliveryFailure,
    });
  }
}

export {
  GitHubDeliveryFailure,
  GitHubReviewClient,
  OpenCodeClient,
  extractRequestId,
  isRetryableStatus,
  toSafeHttpFailure,
};
