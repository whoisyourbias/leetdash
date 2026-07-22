import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildMascotUrl,
  buildReviewPrompt,
  parseSubmissionSolutionPath,
  parseManagedReviewMarker,
  renderReviewFileComment,
  renderReviewFileWarning,
  renderReviewSummary,
  renderReviewWarning,
  ReviewFailure,
  reviewFileKey,
  reviewFileMarker,
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

describe("Chalsakbot mascot asset", () => {
  it("ships a compact 512px PNG", async () => {
    const image = await readFile(new URL("../public/chalsakbot.png", import.meta.url));

    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(image.readUInt32BE(16)).toBe(512);
    expect(image.readUInt32BE(20)).toBe(512);
    expect(image.byteLength).toBeGreaterThan(10_000);
    expect(image.byteLength).toBeLessThan(1_000_000);
  });
});

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
    expect(prompt).toContain("리뷰의 모든 설명과 제안은 자연스러운 한국어로 작성하세요.");
    expect(prompt).toContain("코드 식별자, 경로, 언어 키워드, API 이름, Big-O 표기는 정확성을 위해 원문을 유지할 수 있습니다.");
    expect(prompt).toContain("#### 요약");
    expect(prompt).toContain("#### 잠재적 위험");
    expect(prompt).toContain("#### 복잡도");
    expect(prompt).toContain("#### 가독성");
    expect(prompt).toContain("제출 코드만으로 확인된 사항 없음.");
    expect(prompt).not.toContain("#### Summary");
    expect(prompt).not.toContain("None observed from the submitted code alone.");
    expect(prompt).not.toContain("schema_version");
    expect(prompt).toContain("Do not return JSON");
    expect(prompt).not.toContain("REQUIRED JSON SHAPE");
    expect(prompt).toContain("cannot be inferred");
    for (const forbidden of ["problem statement", "judge metadata", "official template", "leetcode_id", "title_slug"]) {
      expect(prompt.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("managed review markers and branding", () => {
  it("creates stable, path-specific file markers and parses only leading managed markers", () => {
    const firstMarker = reviewFileMarker(reviewPath);
    const secondMarker = reviewFileMarker("submissions/ada/programmers/12907/solution.java");

    expect(firstMarker).toMatch(/^<!-- leetdash-opencode-review-file:[a-f0-9]{64} -->$/);
    expect(firstMarker).not.toBe(secondMarker);
    expect(reviewFileMarker(reviewPath)).toBe(firstMarker);
    expect(parseManagedReviewMarker(`${firstMarker}\nbody`)).toEqual({ kind: "file", key: reviewFileKey(reviewPath) });
    expect(parseManagedReviewMarker("<!-- leetdash-opencode-review -->\nbody")).toEqual({ kind: "summary" });
    expect(parseManagedReviewMarker(`prefix ${firstMarker}`)).toBeUndefined();
  });

  it("builds an immutable mascot URL from trusted repository identity", () => {
    const baseSha = "a".repeat(40);

    expect(buildMascotUrl({
      serverUrl: "https://github.com/",
      repository: "whoisyourbias/leetdash",
      baseSha,
    })).toBe(`https://github.com/whoisyourbias/leetdash/raw/${baseSha}/public/chalsakbot.png`);
  });

  it("renders branded file, warning, and summary comments", () => {
    const mascotUrl = `https://github.com/example/leetdash/raw/${"a".repeat(40)}/public/chalsakbot.png`;
    const shared = {
      path: reviewPath,
      headSha: "head-sha-123",
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
      mascotUrl,
    };
    const fileBody = renderReviewFileComment({ ...shared, markdown: "#### 요약\n읽기 쉬운 반복문입니다." });

    expect(fileBody.startsWith(`${reviewFileMarker(reviewPath)}\n`)).toBe(true);
    expect(fileBody).toContain("찰싹봇의 코드 리뷰");
    expect(fileBody).toContain('alt="찰싹봇 캐릭터"');
    expect(fileBody).toContain(mascotUrl);
    expect(fileBody).toContain(reviewPath);
    expect(fileBody).toContain("#### 요약");

    const warningBody = renderReviewFileWarning({
      ...shared,
      failure: new ReviewFailure({
        stage: "model-request",
        reason: "MODEL_REQUEST_FAILED",
        detail: "OpenCode request failed.",
        retryable: true,
      }),
    });
    expect(warningBody.startsWith(`${reviewFileMarker(reviewPath)}\n`)).toBe(true);
    expect(warningBody).toContain("찰싹봇 리뷰 경고");
    expect(warningBody).toContain("재시도 가능: 예");

    const summary = renderReviewSummary({
      headSha: "head-sha-123",
      runUrl: shared.runUrl,
      mascotUrl,
      reviewedCount: 2,
      warningCount: 1,
      deliveryFailureCount: 0,
    });
    expect(summary.startsWith("<!-- leetdash-opencode-review -->\n")).toBe(true);
    expect(summary).toContain("찰싹봇 리뷰 요약");
    expect(summary).toContain("리뷰 완료: 2개");
    expect(summary).toContain("리뷰 경고: 1개");
    expect(summary).toContain("댓글 전달 실패: 0개");
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
    const markdown = renderReviewFileComment({
      mascotUrl: "https://github.com/example/leetdash/raw/abc1234/public/chalsakbot.png",
      headSha: "abc123",
      path: reviewPath,
      markdown: reviewMarkdown,
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown.startsWith(reviewFileMarker(reviewPath))).toBe(true);
    expect(markdown).toContain("커밋: abc123");
    expect(markdown).toContain(`파일: ${reviewPath}`);
    expect(markdown).toContain(reviewMarkdown);
  });

  it("escapes trusted framing values without escaping model Markdown", () => {
    const markdown = renderReviewFileComment({
      mascotUrl: "https://github.com/example/leetdash/raw/abc1234/public/chalsakbot.png",
      headSha: "abc\n123|def",
      path: "submissions/ada/<script>/1/solution.ts",
      markdown: "#### Summary\n**Readable** & direct.",
      runUrl: "https://example.test/run\n42|x",
    });

    expect(markdown).toContain("abc 123\\|def");
    expect(markdown).toContain("submissions/ada/&lt;script&gt;/1/solution.ts");
    expect(markdown).toContain("#### Summary\n**Readable** & direct.");
    expect(markdown).toContain("https://example.test/run 42\\|x");
  });

  it("keeps the managed comment below GitHub size limits", () => {
    const markdown = renderReviewFileComment({
      mascotUrl: "https://github.com/example/leetdash/raw/abc1234/public/chalsakbot.png",
      headSha: "abc123",
      path: reviewPath,
      markdown: `#### Summary\n${"x".repeat(70_000)}`,
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown.length).toBeLessThanOrEqual(60_000);
    expect(markdown).toContain("Review truncated to fit the GitHub comment limit.");
  });

  it("renders a marked, sanitized informational warning", () => {
    const markdown = renderReviewWarning({
      headSha: "abc123",
      mascotUrl: "https://github.com/example/leetdash/raw/abc1234/public/chalsakbot.png",
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

    expect(markdown).toContain("<!-- leetdash-opencode-review -->\n<img");
    expect(markdown).toContain("## 찰싹봇 리뷰 경고");
    expect(markdown).toContain("단계: model-request");
    expect(markdown).toContain("사유: MODEL_REQUEST_FAILED");
    expect(markdown).toContain("상세: OpenCode request failed.");
    expect(markdown).toContain("재시도 가능: 예");
    expect(markdown).toContain("HTTP 상태: 429");
    expect(markdown).toContain("요청 ID: request-42");
  });
});
