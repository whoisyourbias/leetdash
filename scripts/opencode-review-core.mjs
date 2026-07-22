const solutionPathPattern = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)\/solution\.([^.\/]+)$/i;
const maxManagedCommentLength = 60_000;
const truncationNotice = "\n\n> _Review truncated to fit the GitHub comment limit._";

class ReviewFailure extends Error {
  constructor({ stage, reason, detail, retryable = false, httpStatus, requestId }) {
    super(detail);
    this.name = "ReviewFailure";
    this.stage = stage;
    this.reason = reason;
    this.detail = detail;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
  }
}

function pathFailure(detail) {
  return new ReviewFailure({
    stage: "path-parse",
    reason: "SUBMISSION_PATH_INVALID",
    detail,
  });
}

function parseSubmissionSolutionPath(path) {
  const match = solutionPathPattern.exec(path);
  if (!match) {
    throw pathFailure("The submission solution path could not be parsed.");
  }

  const [, user, sourceKey, submissionKey, extension] = match;
  const filename = path.slice(path.lastIndexOf("/") + 1);
  return { path, user, sourceKey, submissionKey, filename, extension: extension.toLowerCase() };
}

function buildReviewPrompt({ path, language, source }) {
  return `You are performing an informational static review of one submitted source file.

Use only the submission path, language, and code below. Correctness, expected behavior, platform contracts, input limits, and acceptable complexity cannot be inferred. Do not claim that the code is correct or incorrect, predict expected outputs, assume a required platform signature, or say whether the reported complexity fits unknown limits.

Report only risks supported by evidence visible in the submitted code. An edge-case risk must name a boundary condition visible from the code and remain a possible risk, not a correctness verdict. Complexity must describe the code as written without judging whether it fits unknown limits.

Return Markdown only. Do not return JSON, repeat the submitted code, or wrap the response in a code fence. Use exactly these section headings in this order. Keep the review concise and write "None observed from the submitted code alone." when a section has no finding.

#### Summary
One short paragraph.

#### Possible risks
- Evidence-based possible risks with a source location and trigger condition.

#### Complexity
- Time: complexity of the submitted code
- Space: auxiliary-space complexity of the submitted code

#### Readability
- Concrete readability suggestions with a source location.

SUBMISSION
- path: ${path}
- language: ${language}

SUBMITTED CODE
${source}`;
}

function sanitizeReviewMarkdown(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ReviewFailure({
      stage: "model-response",
      reason: "MODEL_RESPONSE_INVALID",
      detail: "OpenCode response is missing review Markdown.",
    });
  }
  return value
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@/g, "&#64;")
    .replace(/\]\s*\(/g, "\\](")
    .replace(/\]\s*\[/g, "\\][")
    .replace(/\b(https?|mailto):/gi, "$1&#58;")
    .replace(/\bwww\./gi, "www&#46;");
}

function markdownText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\|/g, "\\|");
}

function renderReviewComment({ headSha, results, runUrl }) {
  const lines = [
    "<!-- leetdash-opencode-review -->",
    "## OpenCode submission review",
    `Commit: ${markdownText(headSha)}`,
    `Workflow URL: ${markdownText(runUrl)}`,
  ];

  results.forEach((result) => {
    const quotedMarkdown = result.markdown.split("\n").map((line) => `> ${line}`).join("\n");
    lines.push(
      "",
      `### ${markdownText(result.path)}`,
      quotedMarkdown,
    );
  });

  const markdown = lines.join("\n");
  if (markdown.length <= maxManagedCommentLength) return markdown;
  return `${markdown.slice(0, maxManagedCommentLength - truncationNotice.length)}${truncationNotice}`;
}

function renderReviewWarning({ headSha, failure, runUrl }) {
  const lines = [
    "<!-- leetdash-opencode-review -->",
    "## OpenCode review warning",
    `Commit: ${markdownText(headSha)}`,
    `Stage: ${markdownText(failure.stage)}`,
    `Reason: ${markdownText(failure.reason)}`,
    `Detail: ${markdownText(failure.detail)}`,
    `Retryable: ${failure.retryable ? "yes" : "no"}`,
  ];
  if (failure.httpStatus !== undefined) lines.push(`HTTP status: ${markdownText(failure.httpStatus)}`);
  if (failure.requestId !== undefined) lines.push(`Request ID: ${markdownText(failure.requestId)}`);
  lines.push(`Workflow URL: ${markdownText(runUrl)}`);
  return lines.join("\n");
}

export {
  ReviewFailure,
  buildReviewPrompt,
  parseSubmissionSolutionPath,
  renderReviewComment,
  renderReviewWarning,
  sanitizeReviewMarkdown,
};
