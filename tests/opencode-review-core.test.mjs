import { describe, expect, it } from "vitest";

import {
  buildReviewPrompt,
  getLeetCodeLangSlug,
  normalizeQuestionData,
  parseReviewResult,
  parseSubmissionSolutionPath,
  renderInfrastructureFailure,
  renderReviewComment,
  ReviewFailure,
  resolveCatalogProblem,
} from "../scripts/opencode-review-core.mjs";

const catalog = {
  lists: [{ key: "top-interview-easy", items: [{ submissionKey: "1", slug: "two-sum" }] }],
  problems: [{ leetcodeId: 1, slug: "two-sum", title: "Two Sum", difficulty: "easy" }],
};

describe("submission problem resolution", () => {
  it("resolves a solution path through list item and canonical problem", () => {
    expect(resolveCatalogProblem("submissions/ada/top-interview-easy/1/Solution.java", catalog)).toMatchObject({
      user: "ada",
      sourceKey: "top-interview-easy",
      submissionKey: "1",
      extension: "java",
      slug: "two-sum",
      problem: catalog.problems[0],
    });
  });

  it.each([
    ["submissions/ada/top-interview-easy/1/meta.json", "CATALOG_MAPPING_FAILED"],
    ["submissions/ada/missing/1/Solution.java", "CATALOG_MAPPING_FAILED"],
    ["submissions/ada/top-interview-easy/2/Solution.java", "CATALOG_MAPPING_FAILED"],
  ])("fails closed for %s", (path, reason) => {
    expect(() => resolveCatalogProblem(path, catalog)).toThrowError(
      expect.objectContaining({ stage: "catalog-resolve", reason }),
    );
  });

  it("parses only the canonical five-segment solution path", () => {
    expect(parseSubmissionSolutionPath("submissions/ada/top-interview-easy/1/Solution.java")).toEqual({
      path: "submissions/ada/top-interview-easy/1/Solution.java",
      user: "ada",
      sourceKey: "top-interview-easy",
      submissionKey: "1",
      filename: "Solution.java",
      extension: "java",
    });
  });
});

const rawQuestion = {
  content: "<p>Find two numbers.</p>",
  exampleTestcases: "[2,7,11,15]\n9",
  metaData: JSON.stringify({ name: "twoSum", params: [{ name: "nums", type: "integer[]" }] }),
  codeSnippets: [
    { lang: "Java", langSlug: "java", code: "class Solution { public int[] twoSum(int[] nums, int target) {} }" },
    { lang: "Python3", langSlug: "python3", code: "class Solution:\n    def twoSum(self, nums, target):" },
  ],
  topicTags: [{ name: "Array", slug: "array" }, { name: "Hash Table", slug: "hash-table" }],
};

describe("review prompt", () => {
  it("includes the complete submission and problem context", () => {
    const resolved = resolveCatalogProblem("submissions/ada/top-interview-easy/1/Solution.java", catalog);
    const question = normalizeQuestionData(rawQuestion, resolved.extension);
    const prompt = buildReviewPrompt({
      resolved,
      question,
      source: "class Solution { return new int[] {0, 1}; }",
    });

    [
      "submissions/ada/top-interview-easy/1/Solution.java",
      "language: java",
      "leetcode_id: 1",
      "title_slug: two-sum",
      "title: Two Sum",
      "difficulty: easy",
      "<p>Find two numbers.</p>",
      "[2,7,11,15]",
      '"name": "twoSum"',
      "class Solution { public int[] twoSum",
      '"slug": "hash-table"',
      "return exactly one JSON object",
      '"schema_version": 1',
      "class Solution { return new int[] {0, 1}; }",
    ].forEach((value) => expect(prompt.toLowerCase()).toContain(value.toLowerCase()));
    expect(prompt).toContain("Return exactly one JSON object matching schema_version 1 below.");
    expect(prompt).toContain("correctness.status means end-to-end submission correctness, including compilation, runtime safety, termination, and platform/judge contract compliance. Every non-complexity blocking defect must set correctness.status to FAIL; complexity is the only independent blocking axis.");
  });
});

const reviewPath = "submissions/ada/top-interview-easy/1/Solution.java";
const passResult = {
  schema_version: 1,
  verdict: "PASS",
  path: reviewPath,
  summary: "Correct hash-map solution.",
  correctness: { status: "PASS", reason: "Returns the required pair for every valid input." },
  complexity: { time: "O(n)", space: "O(n)", acceptable: true, reason: "Fits the constraints." },
  blocking_findings: [],
  non_blocking_suggestions: [],
};
const failResult = {
  schema_version: 1,
  verdict: "FAIL",
  path: reviewPath,
  summary: "Returns the same index twice.",
  correctness: { status: "FAIL", reason: "The lookup occurs after inserting the current index incorrectly." },
  complexity: { time: "O(n)", space: "O(n)", acceptable: true, reason: "Complexity fits the constraints." },
  blocking_findings: [{
    category: "correctness",
    reason: "The same element can be used twice.",
    evidence: "The current index is accepted as its own complement.",
    counterexample: { input: "[3,3], 6", expected: "[0,1]", actual: "[0,0]" },
  }],
  non_blocking_suggestions: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe("review result parsing", () => {
  it("accepts schema-valid PASS and FAIL results as frozen objects", () => {
    const parsedPass = parseReviewResult(JSON.stringify(passResult), passResult.path);
    const parsedFail = parseReviewResult(JSON.stringify(failResult), failResult.path);

    expect(parsedPass).toEqual(passResult);
    expect(parsedFail).toEqual(failResult);
    expect(Object.isFrozen(parsedPass)).toBe(true);
    expect(Object.isFrozen(parsedFail)).toBe(true);
  });

  it.each([
    ["invalid JSON", () => "not json", "model-response", "MODEL_RESPONSE_INVALID"],
    ["extra top-level key", () => JSON.stringify({ ...passResult, unexpected: true }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["wrong schema version", () => JSON.stringify({ ...passResult, schema_version: 2 }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["mismatched path", () => JSON.stringify({ ...passResult, path: "submissions/ada/top-interview-easy/1/Solution.py" }), "result-validation", "REVIEW_RESULT_INVALID"],
    ["PASS with failed correctness", () => JSON.stringify({ ...passResult, correctness: { ...passResult.correctness, status: "FAIL" } }), "result-validation", "REVIEW_RESULT_INVALID"],
    ["PASS with findings", () => JSON.stringify({ ...passResult, blocking_findings: [clone(failResult.blocking_findings[0])] }), "result-validation", "REVIEW_RESULT_INVALID"],
    ["PASS with unacceptable complexity", () => JSON.stringify({ ...passResult, complexity: { ...passResult.complexity, acceptable: false } }), "result-validation", "REVIEW_RESULT_INVALID"],
    ["FAIL without findings", () => JSON.stringify({ ...failResult, blocking_findings: [] }), "result-validation", "REVIEW_RESULT_INVALID"],
    ["unknown blocking category", () => JSON.stringify({ ...failResult, blocking_findings: [{ ...failResult.blocking_findings[0], category: "security" }] }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["unknown suggestion category", () => JSON.stringify({ ...passResult, non_blocking_suggestions: [{ category: "security", suggestion: "Do this." }] }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["empty required text", () => JSON.stringify({ ...passResult, summary: " " }), "model-response", "MODEL_RESPONSE_INVALID"],
    ["incomplete applicable counterexample", () => JSON.stringify({ ...failResult, blocking_findings: [{ ...failResult.blocking_findings[0], counterexample: { input: "[3,3], 6", expected: "[0,1]", actual: null } }] }), "model-response", "MODEL_RESPONSE_INVALID"],
  ])("rejects %s", (_description, raw, stage, reason) => {
    expect(() => parseReviewResult(raw(), reviewPath)).toThrowError(
      expect.objectContaining({
        name: "ReviewFailure",
        stage,
        reason,
        retryable: false,
      }),
    );
  });

  it("does not expose model content in failures", () => {
    const secret = "model-only-secret";
    try {
      parseReviewResult(`{${secret}`, reviewPath);
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewFailure);
      expect(error.detail).not.toContain(secret);
    }
  });

  it("accepts FAIL for unacceptable complexity when correctness passes", () => {
    const complexityFailure = {
      ...clone(passResult),
      verdict: "FAIL",
      complexity: { ...passResult.complexity, acceptable: false, reason: "Exceeds the stated constraints." },
      blocking_findings: [{
        category: "complexity",
        reason: "The nested loop is quadratic.",
        evidence: "Both loops can examine every input item.",
        counterexample: { input: null, expected: null, actual: null },
      }],
    };

    expect(parseReviewResult(JSON.stringify(complexityFailure), reviewPath)).toEqual(complexityFailure);
  });

  it.each(["compile", "runtime", "termination", "platform-contract"])("accepts %s FAIL findings when correctness fails", (category) => {
    const result = {
      ...clone(failResult),
      blocking_findings: [{
        ...clone(failResult.blocking_findings[0]),
        category,
      }],
    };

    expect(parseReviewResult(JSON.stringify(result), reviewPath)).toEqual(result);
  });

  it("rejects a compile FAIL finding when correctness passes", () => {
    const result = {
      ...clone(failResult),
      correctness: { ...failResult.correctness, status: "PASS" },
      blocking_findings: [{
        ...clone(failResult.blocking_findings[0]),
        category: "compile",
      }],
    };

    expect(() => parseReviewResult(JSON.stringify(result), reviewPath)).toThrowError(
      expect.objectContaining({ stage: "result-validation", reason: "REVIEW_RESULT_INVALID" }),
    );
  });

  it("rejects mixed compile and complexity findings when correctness passes", () => {
    const result = {
      ...clone(failResult),
      correctness: { ...failResult.correctness, status: "PASS" },
      complexity: { ...failResult.complexity, acceptable: false },
      blocking_findings: [
        { ...clone(failResult.blocking_findings[0]), category: "compile" },
        {
          category: "complexity",
          reason: "The nested loop is quadratic.",
          evidence: "Both loops can examine every input item.",
          counterexample: { input: null, expected: null, actual: null },
        },
      ],
    };

    expect(() => parseReviewResult(JSON.stringify(result), reviewPath)).toThrowError(
      expect.objectContaining({ stage: "result-validation", reason: "REVIEW_RESULT_INVALID" }),
    );
  });

  it("accepts mixed compile and complexity findings when correctness fails", () => {
    const result = {
      ...clone(failResult),
      complexity: { ...failResult.complexity, acceptable: false },
      blocking_findings: [
        { ...clone(failResult.blocking_findings[0]), category: "compile" },
        {
          category: "complexity",
          reason: "The nested loop is quadratic.",
          evidence: "Both loops can examine every input item.",
          counterexample: { input: null, expected: null, actual: null },
        },
      ],
    };

    expect(parseReviewResult(JSON.stringify(result), reviewPath)).toEqual(result);
  });

  it("rejects a complexity finding when complexity is acceptable", () => {
    const result = {
      ...clone(failResult),
      blocking_findings: [{
        category: "complexity",
        reason: "The nested loop is quadratic.",
        evidence: "Both loops can examine every input item.",
        counterexample: { input: null, expected: null, actual: null },
      }],
    };

    expect(() => parseReviewResult(JSON.stringify(result), reviewPath)).toThrowError(
      expect.objectContaining({ stage: "result-validation", reason: "REVIEW_RESULT_INVALID" }),
    );
  });
});

describe("review Markdown rendering", () => {
  it("renders a marked, source-free review summary for PASS and FAIL results", () => {
    const passWithSuggestion = {
      ...clone(passResult),
      non_blocking_suggestions: [{ category: "readability", suggestion: "Use a clearer map variable name." }],
    };
    const source = "class Solution { private static final String SECRET_SOURCE = \\\"do not render\\\"; }";
    const markdown = renderReviewComment({
      headSha: "abc123",
      results: [passWithSuggestion, failResult],
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown.startsWith("<!-- leetdash-opencode-review -->")).toBe(true);
    expect(markdown).toContain("Commit: abc123");
    expect(markdown).toContain("https://github.com/example/leetdash/actions/runs/42");
    expect(markdown).toContain(passResult.path);
    expect(markdown).toContain(failResult.path);
    expect(markdown).toContain("Verdict: PASS");
    expect(markdown).toContain("Verdict: FAIL");
    expect(markdown).toContain("Time: O(n)");
    expect(markdown).toContain("The current index is accepted as its own complement.");
    expect(markdown).toContain("Input: [3,3], 6");
    expect(markdown).toContain("Expected: [0,1]");
    expect(markdown).toContain("Actual: [0,0]");
    expect(markdown).toContain("Use a clearer map variable name.");
    expect(markdown).not.toContain(source);
  });

  it("renders a sanitized issue #33 infrastructure failure block", () => {
    const source = "class Solution { private static final String SECRET_SOURCE = \\\"do not render\\\"; }";
    const failure = new ReviewFailure({
      stage: "model-request",
      reason: "MODEL_REQUEST_FAILED",
      detail: "OpenCode request failed.",
      retryable: true,
      httpStatus: 429,
      requestId: "request-42",
    });
    const markdown = renderInfrastructureFailure({
      headSha: "abc123",
      failure,
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown).toContain("<!-- leetdash-opencode-review -->\n## OpenCode review infrastructure failure (issue #33)");
    [
      "Commit: abc123",
      "Stage: model-request",
      "Reason: MODEL_REQUEST_FAILED",
      "Detail: OpenCode request failed.",
      "Retryable: yes",
      "HTTP status: 429",
      "Request ID: request-42",
      "https://github.com/example/leetdash/actions/runs/42",
    ].forEach((value) => expect(markdown).toContain(value));
    expect(markdown).not.toContain(source);
  });

  it("replaces control characters and table separators in rendered values", () => {
    const markdown = renderReviewComment({
      headSha: "abc\n123|def",
      results: [{ ...clone(passResult), summary: "Fine\nsummary|only." }],
      runUrl: "https://example.test/run\n42|x",
    });

    expect(markdown).toContain("abc 123\\|def");
    expect(markdown).toContain("Fine summary\\|only.");
    expect(markdown).toContain("https://example.test/run 42\\|x");
  });

  it("escapes HTML-significant characters in every dynamic renderer value", () => {
    const result = {
      ...clone(failResult),
      summary: "Summary & <tag>",
      blocking_findings: [{
        ...clone(failResult.blocking_findings[0]),
        evidence: "Evidence & <details>",
      }],
      non_blocking_suggestions: [{ category: "style", suggestion: "Suggestion & <improvement>" }],
    };
    const review = renderReviewComment({ headSha: "abc123", results: [result], runUrl: "https://example.test/run" });
    const infrastructure = renderInfrastructureFailure({
      headSha: "abc123",
      failure: new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "Detail & <external>",
      }),
      runUrl: "https://example.test/run",
    });

    [
      "Summary &amp; &lt;tag&gt;",
      "Evidence &amp; &lt;details&gt;",
      "Suggestion &amp; &lt;improvement&gt;",
      "Detail &amp; &lt;external&gt;",
    ].forEach((value) => expect(`${review}\n${infrastructure}`).toContain(value));
  });
});

describe("LeetCode question normalization", () => {
  it.each([
    ["c", "c"],
    ["cc", "cpp"],
    ["cpp", "cpp"],
    ["cs", "csharp"],
    ["dart", "dart"],
    ["go", "golang"],
    ["java", "java"],
    ["js", "javascript"],
    ["kt", "kotlin"],
    ["php", "php"],
    ["py", "python3"],
    ["rb", "ruby"],
    ["rs", "rust"],
    ["scala", "scala"],
    ["sql", "mysql"],
    ["swift", "swift"],
    ["ts", "typescript"],
  ])("maps %s to LeetCode %s", (extension, slug) => {
    expect(getLeetCodeLangSlug(extension)).toBe(slug);
  });

  it("normalizes valid live question data for the submission language", () => {
    expect(normalizeQuestionData(rawQuestion, "java")).toEqual({
      content: rawQuestion.content,
      exampleTestcases: rawQuestion.exampleTestcases,
      metadata: { name: "twoSum", params: [{ name: "nums", type: "integer[]" }] },
      codeTemplate: rawQuestion.codeSnippets[0].code,
      topicTags: rawQuestion.topicTags,
    });
  });

  it.each([
    ["an unsupported extension", () => normalizeQuestionData(rawQuestion, "zig"), "제출 언어를 LeetCode 공식 template에 매핑하지 못했습니다."],
    ["missing content", () => normalizeQuestionData({ ...rawQuestion, content: "" }, "java"), "LeetCode 문제 본문이 비어 있습니다."],
    ["blank examples", () => normalizeQuestionData({ ...rawQuestion, exampleTestcases: "  " }, "java"), "LeetCode 예제 테스트 케이스가 비어 있습니다."],
    ["invalid metadata", () => normalizeQuestionData({ ...rawQuestion, metaData: "[]" }, "java"), "LeetCode judge metadata가 유효하지 않습니다."],
    ["missing matching snippet", () => normalizeQuestionData({ ...rawQuestion, codeSnippets: [] }, "java"), "제출 언어의 LeetCode 공식 코드 template을 찾지 못했습니다."],
  ])("fails safely for %s", (_description, normalize, detail) => {
    expect(normalize).toThrowError(
      expect.objectContaining({ stage: "problem-parse", reason: "PROBLEM_DATA_INVALID", detail, retryable: false }),
    );
  });

  it("fails safely for an unsupported language mapping", () => {
    expect(() => getLeetCodeLangSlug("zig")).toThrowError(
      expect.objectContaining({
        stage: "problem-parse",
        reason: "PROBLEM_DATA_INVALID",
        detail: "제출 언어를 LeetCode 공식 template에 매핑하지 못했습니다.",
        retryable: false,
      }),
    );
  });
});
