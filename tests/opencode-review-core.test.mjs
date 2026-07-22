import { describe, expect, it } from "vitest";

import {
  buildReviewPrompt,
  parseSubmissionSolutionPath,
  renderReviewComment,
  renderReviewWarning,
  ReviewFailure,
  sanitizeReviewMarkdown,
} from "../scripts/opencode-review-core.mjs";

const reviewPath = "submissions/ada/programmers/12906/solution.java";
const reviewMarkdown = `#### Summary
The loop is easy to follow.

#### Possible risks
- The access at line 8 may exceed the visible array bounds when the index reaches the final element.

#### Complexity
- Time: O(n)
- Space: O(1)

#### Readability
- Name the sentinel value at line 4.`;

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
  it("requests readable Markdown using only submission identity, language, and source", () => {
    const prompt = buildReviewPrompt({
      path: reviewPath,
      language: "java",
      source: "class Solution {}",
    });

    expect(prompt).toContain(reviewPath);
    expect(prompt).toContain("language: java");
    expect(prompt).toContain("class Solution {}");
    expect(prompt).toContain("Return Markdown only");
    expect(prompt).toContain("#### Possible risks");
    expect(prompt).toContain("#### Complexity");
    expect(prompt).not.toContain("schema_version");
    expect(prompt).toContain("Do not return JSON");
    expect(prompt).not.toContain("REQUIRED JSON SHAPE");
    expect(prompt).toContain("cannot be inferred");
    for (const forbidden of ["problem statement", "judge metadata", "official template", "leetcode_id", "title_slug"]) {
      expect(prompt.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("review Markdown rendering", () => {
  it("keeps review formatting while neutralizing active and deceptive Markdown", () => {
    const sanitized = sanitizeReviewMarkdown(
      "#### Summary\r\n**Readable** <script>\u0000 @org/team [link](https://evil.test) www.evil.test\u202e",
    );

    expect(sanitized).toContain("#### Summary\n**Readable** &lt;script&gt;");
    expect(sanitized).not.toContain("@org/team");
    expect(sanitized).not.toContain("](https://");
    expect(sanitized).not.toContain("www.evil.test");
    expect(sanitized).not.toContain("\u202e");
  });

  it("embeds model Markdown directly under each trusted submission path", () => {
    const markdown = renderReviewComment({
      headSha: "abc123",
      results: [{ path: reviewPath, markdown: reviewMarkdown }],
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown.startsWith("<!-- leetdash-opencode-review -->")).toBe(true);
    expect(markdown).toContain("Commit: abc123");
    expect(markdown).toContain(`### ${reviewPath}`);
    expect(markdown).toContain(reviewMarkdown.split("\n").map((line) => `> ${line}`).join("\n"));
  });

  it("escapes trusted framing values without escaping model Markdown", () => {
    const markdown = renderReviewComment({
      headSha: "abc\n123|def",
      results: [{ path: "submissions/ada/<script>/1/solution.ts", markdown: "#### Summary\n**Readable** & direct." }],
      runUrl: "https://example.test/run\n42|x",
    });

    expect(markdown).toContain("abc 123\\|def");
    expect(markdown).toContain("submissions/ada/&lt;script&gt;/1/solution.ts");
    expect(markdown).toContain("> #### Summary\n> **Readable** & direct.");
    expect(markdown).toContain("https://example.test/run 42\\|x");
  });

  it("keeps the managed comment below GitHub size limits", () => {
    const markdown = renderReviewComment({
      headSha: "abc123",
      results: [{ path: reviewPath, markdown: `#### Summary\n${"x".repeat(70_000)}` }],
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown.length).toBeLessThanOrEqual(60_000);
    expect(markdown).toContain("Review truncated to fit the GitHub comment limit.");
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
});
