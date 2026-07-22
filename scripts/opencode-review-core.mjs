const solutionPathPattern = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)\/solution\.([^.\/]+)$/i;
const leetCodeLangSlugs = Object.freeze({
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  cs: "csharp",
  dart: "dart",
  go: "golang",
  java: "java",
  js: "javascript",
  kt: "kotlin",
  php: "php",
  py: "python3",
  rb: "ruby",
  rs: "rust",
  scala: "scala",
  sql: "mysql",
  swift: "swift",
  ts: "typescript",
});
const blockingCategories = new Set(["correctness", "compile", "runtime", "termination", "platform-contract", "complexity"]);
const suggestionCategories = new Set(["style", "readability", "optimization", "alternative"]);
const modelResponseDetail = "모델 응답은 schema version 1 JSON 계약을 충족하지 못했습니다.";
const resultValidationDetail = "모델 판정 결과의 필드가 서로 일치하지 않습니다.";

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

function catalogFailure(detail) {
  return new ReviewFailure({
    stage: "catalog-resolve",
    reason: "CATALOG_MAPPING_FAILED",
    detail,
  });
}

function problemFailure(detail) {
  return new ReviewFailure({
    stage: "problem-parse",
    reason: "PROBLEM_DATA_INVALID",
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
    throw catalogFailure("제출 solution 경로를 해석하지 못했습니다.");
  }

  const [, user, sourceKey, submissionKey, extension] = match;
  const filename = path.slice(path.lastIndexOf("/") + 1);
  return { path, user, sourceKey, submissionKey, filename, extension: extension.toLowerCase() };
}

function resolveCatalogProblem(path, catalog) {
  const parsedPath = parseSubmissionSolutionPath(path);
  const list = catalog?.lists?.find((entry) => entry.key === parsedPath.sourceKey);
  if (!list) {
    throw catalogFailure("제출 목록을 찾지 못했습니다.");
  }

  const item = list.items?.find((entry) => String(entry.submissionKey) === parsedPath.submissionKey);
  if (!item) {
    throw catalogFailure("제출 문제를 찾지 못했습니다.");
  }

  const problem = catalog?.problems?.find((entry) => entry.slug === item.slug);
  if (!problem) {
    throw catalogFailure("정식 문제 정보를 찾지 못했습니다.");
  }

  return { ...parsedPath, slug: item.slug, problem };
}

function getLeetCodeLangSlug(extension) {
  const langSlug = typeof extension === "string" ? leetCodeLangSlugs[extension.toLowerCase()] : undefined;
  if (!langSlug) {
    throw problemFailure("제출 언어를 LeetCode 공식 template에 매핑하지 못했습니다.");
  }
  return langSlug;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeQuestionData(rawQuestion, extension) {
  const langSlug = getLeetCodeLangSlug(extension);
  const content = rawQuestion?.content;
  if (!hasText(content)) {
    throw problemFailure("LeetCode 문제 본문이 비어 있습니다.");
  }

  const exampleTestcases = rawQuestion?.exampleTestcases;
  if (!hasText(exampleTestcases)) {
    throw problemFailure("LeetCode 예제 테스트 케이스가 비어 있습니다.");
  }

  let metadata;
  try {
    metadata = JSON.parse(rawQuestion?.metaData);
  } catch {
    throw problemFailure("LeetCode judge metadata가 유효하지 않습니다.");
  }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    throw problemFailure("LeetCode judge metadata가 유효하지 않습니다.");
  }

  const snippet = Array.isArray(rawQuestion?.codeSnippets)
    ? rawQuestion.codeSnippets.find((entry) => entry?.langSlug === langSlug)
    : undefined;
  if (!hasText(snippet?.code)) {
    throw problemFailure("제출 언어의 LeetCode 공식 코드 template을 찾지 못했습니다.");
  }

  const topicTags = Array.isArray(rawQuestion?.topicTags)
    ? rawQuestion.topicTags
      .filter((tag) => typeof tag?.name === "string" && typeof tag?.slug === "string")
      .map(({ name, slug }) => ({ name, slug }))
    : [];

  return { content, exampleTestcases, metadata, codeTemplate: snippet.code, topicTags };
}

function buildReviewPrompt({ resolved, question, source }) {
  return `You are a strict but narrowly scoped LeetCode submission judge.

Review exactly one submitted solution against the supplied problem statement, constraints, judge metadata, official language template, and examples. Determine whether the code is correct for every valid input and whether its worst-case time and space complexity fit the stated constraints.

Return exactly one JSON object matching schema_version 1 below. Do not return Markdown, code fences, prose before or after the JSON, or additional keys.

Blocking policy:
- FAIL only for an incorrect answer or missing edge case; a compile error or inevitable runtime error; non-termination; a violation of the platform/judge contract; or time/space complexity that exceeds the problem constraints.
- Style, naming, readability, optional optimizations, and alternative algorithms are never blocking by themselves. Put them only in non_blocking_suggestions.
- Do not assume unstated requirements. Judge using the supplied problem and metadata.
- If verdict is FAIL, include at least one blocking finding. Give concrete evidence and, whenever applicable, a minimal counterexample with expected and actual behavior.
- If verdict is PASS, correctness.status must be PASS, complexity.acceptable must be true, and blocking_findings must be empty.
- correctness.status means end-to-end submission correctness, including compilation, runtime safety, termination, and platform/judge contract compliance. Every non-complexity blocking defect must set correctness.status to FAIL; complexity is the only independent blocking axis.
- Echo submission_path exactly in path.

SUBMISSION
- path: ${resolved.path}
- language: ${resolved.extension}

PROBLEM IDENTITY
- leetcode_id: ${resolved.problem.leetcodeId}
- title_slug: ${resolved.slug}
- title: ${resolved.problem.title}
- difficulty: ${resolved.problem.difficulty}

PROBLEM CONTENT, EXAMPLES, AND CONSTRAINTS
${question.content}

EXAMPLE TEST CASES
${question.exampleTestcases}

JUDGE METADATA
${JSON.stringify(question.metadata, null, 2)}

OFFICIAL ${resolved.extension.toUpperCase()} CODE TEMPLATE
${question.codeTemplate}

TOPIC TAGS
${JSON.stringify(question.topicTags, null, 2)}

SUBMITTED CODE
${source}

REQUIRED JSON SHAPE
{
  "schema_version": 1,
  "verdict": "PASS | FAIL",
  "path": "${resolved.path}",
  "summary": "short verdict summary",
  "correctness": {
    "status": "PASS | FAIL",
    "reason": "correctness reasoning tied to the problem contract"
  },
  "complexity": {
    "time": "worst-case Big-O",
    "space": "worst-case auxiliary-space Big-O",
    "acceptable": true,
    "reason": "comparison with the supplied constraints"
  },
  "blocking_findings": [
    {
      "category": "correctness | compile | runtime | termination | platform-contract | complexity",
      "reason": "specific merge-blocking defect",
      "evidence": "why the defect follows from the code and problem",
      "counterexample": {
        "input": "minimal failing input, or null when not applicable",
        "expected": "expected behavior, or null when not applicable",
        "actual": "actual behavior, or null when not applicable"
      }
    }
  ],
  "non_blocking_suggestions": [
    {
      "category": "style | readability | optimization | alternative",
      "suggestion": "optional, non-blocking improvement"
    }
  ]
}`;
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

function assertStringOrNull(value, field) {
  if (value !== null && !hasText(value)) throw modelResponseFailure(field, "string-or-null");
}

function assertCounterexample(value) {
  assertExactKeys(value, ["input", "expected", "actual"], "blocking_findings[].counterexample");
  assertStringOrNull(value.input, "blocking_findings[].counterexample.input");
  assertStringOrNull(value.expected, "blocking_findings[].counterexample.expected");
  assertStringOrNull(value.actual, "blocking_findings[].counterexample.actual");
  const values = [value.input, value.expected, value.actual];
  if (values.some((item) => item === null) && values.some((item) => item !== null)) {
    throw modelResponseFailure("blocking_findings[].counterexample", "all-null-or-all-text");
  }
}

function assertBlockingFinding(value) {
  assertExactKeys(value, ["category", "reason", "evidence", "counterexample"], "blocking_findings[]");
  assertEnum(value.category, blockingCategories, "blocking_findings[].category");
  assertString(value.reason, "blocking_findings[].reason");
  assertString(value.evidence, "blocking_findings[].evidence");
  assertCounterexample(value.counterexample);
}

function assertSuggestion(value) {
  assertExactKeys(value, ["category", "suggestion"], "non_blocking_suggestions[]");
  assertEnum(value.category, suggestionCategories, "non_blocking_suggestions[].category");
  assertString(value.suggestion, "non_blocking_suggestions[].suggestion");
}

function assertArray(value, validator, field) {
  if (!Array.isArray(value)) throw modelResponseFailure(field, "array");
  value.forEach(validator);
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
    "verdict",
    "path",
    "summary",
    "correctness",
    "complexity",
    "blocking_findings",
    "non_blocking_suggestions",
  ], "response");
  if (result.schema_version !== 1) throw modelResponseFailure("schema_version", "value");
  assertEnum(result.verdict, new Set(["PASS", "FAIL"]), "verdict");
  assertString(result.path, "path");
  assertString(result.summary, "summary");

  assertExactKeys(result.correctness, ["status", "reason"], "correctness");
  assertEnum(result.correctness.status, new Set(["PASS", "FAIL"]), "correctness.status");
  assertString(result.correctness.reason, "correctness.reason");

  assertExactKeys(result.complexity, ["time", "space", "acceptable", "reason"], "complexity");
  assertString(result.complexity.time, "complexity.time");
  assertString(result.complexity.space, "complexity.space");
  if (typeof result.complexity.acceptable !== "boolean") {
    throw modelResponseFailure("complexity.acceptable", "boolean");
  }
  assertString(result.complexity.reason, "complexity.reason");

  assertArray(result.blocking_findings, assertBlockingFinding, "blocking_findings");
  assertArray(result.non_blocking_suggestions, assertSuggestion, "non_blocking_suggestions");
  const hasNonComplexityFinding = result.blocking_findings.some((finding) => finding.category !== "complexity");
  const hasComplexityFinding = result.blocking_findings.some((finding) => finding.category === "complexity");

  if (
    result.path !== expectedPath
    || (result.verdict === "PASS" && (
      result.correctness.status !== "PASS"
      || result.blocking_findings.length > 0
      || !result.complexity.acceptable
    ))
    || (result.verdict === "FAIL" && (
      result.blocking_findings.length === 0
      || (hasNonComplexityFinding && result.correctness.status !== "FAIL")
      || (hasComplexityFinding && result.complexity.acceptable)
    ))
  ) {
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

function renderCounterexample(counterexample) {
  if (counterexample.input === null) return [];
  return [
    `  - Input: ${markdownText(counterexample.input)}`,
    `  - Expected: ${markdownText(counterexample.expected)}`,
    `  - Actual: ${markdownText(counterexample.actual)}`,
  ];
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
      `Verdict: ${markdownText(result.verdict)}`,
      `Summary: ${markdownText(result.summary)}`,
      `Correctness: ${markdownText(result.correctness.status)} — ${markdownText(result.correctness.reason)}`,
      `Time: ${markdownText(result.complexity.time)}`,
      `Space: ${markdownText(result.complexity.space)}`,
      `Complexity acceptable: ${result.complexity.acceptable ? "yes" : "no"} — ${markdownText(result.complexity.reason)}`,
    );

    if (result.blocking_findings.length > 0) {
      lines.push("Blocking findings:");
      result.blocking_findings.forEach((finding) => {
        lines.push(
          `- ${markdownText(finding.category)}: ${markdownText(finding.reason)}`,
          `  - Evidence: ${markdownText(finding.evidence)}`,
          ...renderCounterexample(finding.counterexample),
        );
      });
    }

    if (result.non_blocking_suggestions.length > 0) {
      lines.push("Non-blocking suggestions:");
      result.non_blocking_suggestions.forEach((suggestion) => {
        lines.push(`- ${markdownText(suggestion.category)}: ${markdownText(suggestion.suggestion)}`);
      });
    }
  });

  return lines.join("\n");
}

function renderInfrastructureFailure({ headSha, failure, runUrl }) {
  const lines = [
    "<!-- leetdash-opencode-review -->",
    "## OpenCode review infrastructure failure (issue #33)",
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
  getLeetCodeLangSlug,
  normalizeQuestionData,
  parseReviewResult,
  parseSubmissionSolutionPath,
  renderInfrastructureFailure,
  renderReviewComment,
  resolveCatalogProblem,
};
