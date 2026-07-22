import { describe, expect, it } from "vitest";

import {
  buildReviewPrompt,
  parseReviewResult,
  parseSubmissionSolutionPath,
  renderReviewComment,
  renderReviewWarning,
  ReviewFailure,
} from "../scripts/opencode-review-core.mjs";

const reviewPath = "submissions/ada/programmers/12906/solution.java";
const resultKeys = [
  "schema_version",
  "path",
  "overall",
  "summary",
  "bug_risks",
  "complexity",
  "readability",
];

const noIssueResult = {
  schema_version: 2,
  path: reviewPath,
  overall: "No issue found",
  summary: "No static risks are visible in the submitted code.",
  bug_risks: [],
  complexity: { time: "O(n)", space: "O(n)" },
  readability: [],
};

const possibleIssueResult = {
  schema_version: 2,
  path: reviewPath,
  overall: "Possible issue",
  summary: "An index access may exceed the visible array bounds.",
  bug_risks: [{
    category: "index-range",
    location: "line 8",
    reason: "The code reads values[index + 1] without a preceding upper-bound check.",
    trigger: "index is the final valid array position",
  }],
  complexity: { time: "O(n)", space: "O(1)" },
  readability: [],
};

const improvementResult = {
  schema_version: 2,
  path: reviewPath,
  overall: "Improvement",
  summary: "The implementation is readable but contains an unexplained constant.",
  bug_risks: [],
  complexity: { time: "O(n)", space: "O(1)" },
  readability: [{
    category: "magic-number",
    location: "line 4",
    suggestion: "Name the sentinel value to explain its role.",
  }],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe("submission path parsing", () => {
  it("parses only the canonical five-segment solution path", () => {
    expect(parseSubmissionSolutionPath("submissions/ada/programmers/12906/Solution.java")).toEqual({
      path: "submissions/ada/programmers/12906/Solution.java",
      user: "ada",
      sourceKey: "programmers",
      submissionKey: "12906",
      filename: "Solution.java",
      extension: "java",
    });
  });

  it("rejects a non-solution path", () => {
    expect(() => parseSubmissionSolutionPath("submissions/ada/programmers/12906/meta.json")).toThrowError(
      expect.objectContaining({ stage: "path-parse", reason: "SUBMISSION_PATH_INVALID" }),
    );
  });
});

describe("review prompt", () => {
  it("contains only the submission identity, language, source, and schema v2 instructions", () => {
    const prompt = buildReviewPrompt({
      path: reviewPath,
      language: "java",
      source: "class Solution {}",
    });

    expect(prompt).toContain(reviewPath);
    expect(prompt).toContain("language: java");
    expect(prompt).toContain("class Solution {}");
    expect(prompt).toContain('"schema_version": 2');
    expect(prompt).toContain("without Markdown or extra keys");
    expect(prompt).toContain("cannot be inferred");
    for (const forbidden of ["problem statement", "judge metadata", "official template", "leetcode_id", "title_slug"]) {
      expect(prompt.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("review result parsing", () => {
  it.each([
    ["No issue found", noIssueResult],
    ["Possible issue", possibleIssueResult],
    ["Improvement", improvementResult],
  ])("accepts and deeply freezes a valid %s result", (_overall, fixture) => {
    const parsed = parseReviewResult(JSON.stringify(fixture), reviewPath);

    expect(parsed).toEqual(fixture);
    expect(Object.keys(parsed)).toEqual(resultKeys);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.complexity)).toBe(true);
    expect(Object.isFrozen(parsed.bug_risks)).toBe(true);
    expect(Object.isFrozen(parsed.readability)).toBe(true);
  });

  it.each(["index-range", "overflow", "nullability", "edge-case", "condition"])(
    "accepts the %s bug risk category",
    (category) => {
      const result = clone(possibleIssueResult);
      result.bug_risks[0].category = category;
      expect(parseReviewResult(JSON.stringify(result), reviewPath)).toEqual(result);
    },
  );

  it.each(["naming", "function-split", "duplication", "magic-number"])(
    "accepts the %s readability category",
    (category) => {
      const result = clone(improvementResult);
      result.readability[0].category = category;
      expect(parseReviewResult(JSON.stringify(result), reviewPath)).toEqual(result);
    },
  );

  it.each([
    ["invalid JSON", "not json", "model-response", "MODEL_RESPONSE_INVALID"],
    ["an extra top-level key", JSON.stringify({ ...noIssueResult, verdict: "PASS" }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["a missing top-level key", JSON.stringify(Object.fromEntries(Object.entries(noIssueResult).filter(([key]) => key !== "summary"))), "model-response", "MODEL_RESPONSE_INVALID"],
    ["schema version 1", JSON.stringify({ ...noIssueResult, schema_version: 1 }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["a mismatched path", JSON.stringify({ ...noIssueResult, path: "submissions/ada/swea/1206/solution.java" }), "result-validation", "REVIEW_RESULT_INVALID"],
    ["an unknown overall", JSON.stringify({ ...noIssueResult, overall: "PASS" }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["an extra bug risk key", JSON.stringify({ ...possibleIssueResult, bug_risks: [{ ...possibleIssueResult.bug_risks[0], evidence: "extra" }] }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["an unknown bug risk category", JSON.stringify({ ...possibleIssueResult, bug_risks: [{ ...possibleIssueResult.bug_risks[0], category: "compile" }] }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["an extra complexity key", JSON.stringify({ ...noIssueResult, complexity: { ...noIssueResult.complexity, acceptable: true } }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["an extra readability key", JSON.stringify({ ...improvementResult, readability: [{ ...improvementResult.readability[0], reason: "extra" }] }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["an unknown readability category", JSON.stringify({ ...improvementResult, readability: [{ ...improvementResult.readability[0], category: "style" }] }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["blank required text", JSON.stringify({ ...noIssueResult, summary: " " }), "model-response", "MODEL_RESPONSE_INVALID"],
  ])("rejects %s", (_description, raw, stage, reason) => {
    expect(() => parseReviewResult(raw, reviewPath)).toThrowError(
      expect.objectContaining({ name: "ReviewFailure", stage, reason, retryable: false }),
    );
  });

  it.each([
    ["bug risks take priority over readability", { ...clone(possibleIssueResult), overall: "Improvement", readability: clone(improvementResult.readability) }],
    ["readability requires Improvement", { ...clone(improvementResult), overall: "No issue found" }],
    ["an empty review requires No issue found", { ...clone(noIssueResult), overall: "Possible issue" }],
  ])("rejects an overall that violates priority: %s", (_description, result) => {
    expect(() => parseReviewResult(JSON.stringify(result), reviewPath)).toThrowError(
      expect.objectContaining({ stage: "result-validation", reason: "REVIEW_RESULT_INVALID" }),
    );
  });

  it("does not expose model content in validation failures", () => {
    const secret = "model-only-secret";
    try {
      parseReviewResult(JSON.stringify({ ...noIssueResult, unexpected: secret }), reviewPath);
      throw new Error("expected parsing to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewFailure);
      expect(error.detail).not.toContain(secret);
    }
  });
});

describe("review Markdown rendering", () => {
  it("renders a marked, source-free informational review summary", () => {
    const markdown = renderReviewComment({
      headSha: "abc123",
      results: [noIssueResult, possibleIssueResult, improvementResult],
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown.startsWith("<!-- leetdash-opencode-review -->")).toBe(true);
    expect(markdown).toContain("Commit: abc123");
    expect(markdown).toContain("Overall: No issue found");
    expect(markdown).toContain("Overall: Possible issue");
    expect(markdown).toContain("Overall: Improvement");
    expect(markdown).toContain("Time: O(n)");
    expect(markdown).toContain("line 8");
    expect(markdown).toContain("final valid array position");
    expect(markdown).toContain("Name the sentinel value");
    expect(markdown).not.toContain("class Solution");
  });

  it("renders a marked, sanitized informational warning", () => {
    const markdown = renderReviewWarning({
      headSha: "abc123",
      failure: new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "OpenCode request failed.",
        retryable: true,
        httpStatus: 429,
        requestId: "request-42",
      }),
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown).toContain("<!-- leetdash-opencode-review -->\n## OpenCode review warning");
    expect(markdown).toContain("Stage: model-request");
    expect(markdown).toContain("Reason: MODEL_REQUEST_FAILED");
    expect(markdown).toContain("Detail: OpenCode request failed.");
    expect(markdown).toContain("Retryable: yes");
    expect(markdown).toContain("HTTP status: 429");
    expect(markdown).toContain("Request ID: request-42");
  });

  it("escapes HTML, control characters, and table separators in dynamic values", () => {
    const review = renderReviewComment({
      headSha: "abc\n123|def",
      results: [{ ...clone(noIssueResult), summary: "Fine & <tag>\nsummary|only." }],
      runUrl: "https://example.test/run\n42|x",
    });
    const warning = renderReviewWarning({
      headSha: "abc123",
      failure: new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "Detail & <external>",
      }),
      runUrl: "https://example.test/run",
    });

    expect(review).toContain("abc 123\\|def");
    expect(review).toContain("Fine &amp; &lt;tag&gt; summary\\|only.");
    expect(review).toContain("https://example.test/run 42\\|x");
    expect(warning).toContain("Detail &amp; &lt;external&gt;");
  });
});
