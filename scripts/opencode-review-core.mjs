const solutionPathPattern = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)\/solution\.([^.\/]+)$/i;
const overallValues = new Set(["No issue found", "Possible issue", "Improvement"]);
const bugRiskCategories = new Set(["index-range", "overflow", "nullability", "edge-case", "condition"]);
const readabilityCategories = new Set(["naming", "function-split", "duplication", "magic-number"]);
const modelResponseDetail = "The model response does not satisfy the schema version 2 JSON contract.";
const resultValidationDetail = "The model review result fields are inconsistent.";

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

function modelResponseFailure(field, issue) {
  return new ReviewFailure({
    stage: "model-response",
    reason: "MODEL_RESPONSE_INVALID",
    detail: `${modelResponseDetail} Diagnostic: field=${field}; issue=${issue}.`,
  });
}

function resultValidationFailure() {
  return new ReviewFailure({
    stage: "result-validation",
    reason: "REVIEW_RESULT_INVALID",
    detail: resultValidationDetail,
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

Report only risks supported by evidence visible in the submitted code. An edge-case risk must name a boundary condition visible from the code and remain a possible risk, not a correctness verdict. Complexity must describe the code as written and does not by itself select Improvement.

Return exactly one JSON object matching the shape below, without Markdown or extra keys. Echo submission_path exactly in path. Select overall by priority:
1. Possible issue when bug_risks is non-empty.
2. Improvement when bug_risks is empty and readability is non-empty.
3. No issue found otherwise.

SUBMISSION
- path: ${path}
- language: ${language}

SUBMITTED CODE
${source}

REQUIRED JSON SHAPE
{
  "schema_version": 2,
  "path": "${path}",
  "overall": "No issue found | Possible issue | Improvement",
  "summary": "one-line review summary",
  "bug_risks": [
    {
      "category": "index-range | overflow | nullability | edge-case | condition",
      "location": "source location",
      "reason": "evidence visible in the submitted code",
      "trigger": "condition under which the risk can occur"
    }
  ],
  "complexity": {
    "time": "complexity of the submitted code",
    "space": "auxiliary-space complexity of the submitted code"
  },
  "readability": [
    {
      "category": "naming | function-split | duplication | magic-number",
      "location": "source location",
      "suggestion": "short improvement"
    }
  ]
}`;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value) {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

function assertExactKeys(value, keys, field) {
  if (!isObject(value)) throw modelResponseFailure(field, "object");
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) {
    throw modelResponseFailure(field, "object-shape");
  }
}

function assertString(value, field) {
  if (!hasText(value)) throw modelResponseFailure(field, "non-empty-string");
}

function assertEnum(value, allowed, field) {
  if (!allowed.has(value)) throw modelResponseFailure(field, "enum");
}

function assertArray(value, validator, field) {
  if (!Array.isArray(value)) throw modelResponseFailure(field, "array");
  value.forEach(validator);
}

function assertBugRisk(value) {
  assertExactKeys(value, ["category", "location", "reason", "trigger"], "bug_risks[]");
  assertEnum(value.category, bugRiskCategories, "bug_risks[].category");
  assertString(value.location, "bug_risks[].location");
  assertString(value.reason, "bug_risks[].reason");
  assertString(value.trigger, "bug_risks[].trigger");
}

function assertReadability(value) {
  assertExactKeys(value, ["category", "location", "suggestion"], "readability[]");
  assertEnum(value.category, readabilityCategories, "readability[].category");
  assertString(value.location, "readability[].location");
  assertString(value.suggestion, "readability[].suggestion");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function parseReviewResult(raw, expectedPath) {
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw modelResponseFailure("response", "json-parse");
  }

  assertExactKeys(result, [
    "schema_version",
    "path",
    "overall",
    "summary",
    "bug_risks",
    "complexity",
    "readability",
  ], "response");
  if (result.schema_version !== 2) throw modelResponseFailure("schema_version", "value");
  assertString(result.path, "path");
  assertEnum(result.overall, overallValues, "overall");
  assertString(result.summary, "summary");
  assertArray(result.bug_risks, assertBugRisk, "bug_risks");
  assertExactKeys(result.complexity, ["time", "space"], "complexity");
  assertString(result.complexity.time, "complexity.time");
  assertString(result.complexity.space, "complexity.space");
  assertArray(result.readability, assertReadability, "readability");

  const expectedOverall = result.bug_risks.length > 0
    ? "Possible issue"
    : result.readability.length > 0
      ? "Improvement"
      : "No issue found";

  if (result.path !== expectedPath || result.overall !== expectedOverall) {
    throw resultValidationFailure();
  }

  return deepFreeze(result);
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
    lines.push(
      "",
      `### ${markdownText(result.path)}`,
      `Overall: ${markdownText(result.overall)}`,
      `Summary: ${markdownText(result.summary)}`,
      `Time: ${markdownText(result.complexity.time)}`,
      `Space: ${markdownText(result.complexity.space)}`,
    );

    if (result.bug_risks.length > 0) {
      lines.push("Possible bug risks:");
      result.bug_risks.forEach((risk) => {
        lines.push(
          `- ${markdownText(risk.category)} at ${markdownText(risk.location)}: ${markdownText(risk.reason)}`,
          `  - Trigger: ${markdownText(risk.trigger)}`,
        );
      });
    }

    if (result.readability.length > 0) {
      lines.push("Readability improvements:");
      result.readability.forEach((item) => {
        lines.push(`- ${markdownText(item.category)} at ${markdownText(item.location)}: ${markdownText(item.suggestion)}`);
      });
    }
  });

  return lines.join("\n");
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
  parseReviewResult,
  parseSubmissionSolutionPath,
  renderReviewComment,
  renderReviewWarning,
};
