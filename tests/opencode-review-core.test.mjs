import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildMascotUrl,
  buildReviewPrompt,
  buildSourcePermalink,
  injectLinePermalinks,
  parseSubmissionSolutionPath,
  parseManagedReviewMarker,
  renderReviewFileComment,
  renderReviewFileWarning,
  renderReviewSummary,
  renderReviewWarning,
  ReviewFailure,
  reviewContentKey,
  reviewContentMarker,
  reviewModelMarker,
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
  it("requests Korean line-level comments using only explicit source constraints", () => {
    const prompt = buildReviewPrompt({
      path: reviewPath,
      language: "java",
      source: "class Solution {}",
    });

    expect(prompt).toContain(reviewPath);
    expect(prompt).toContain("language: java");
    expect(prompt).toContain("class Solution {}");
    expect(prompt).toContain("모든 설명과 제안은 자연스러운 한국어로 작성하세요.");
    expect(prompt).toContain("코드 식별자, 경로, 언어 키워드, API 이름, Big-O 표기는 정확성을 위해 원문을 유지할 수 있습니다.");
    expect(prompt).toContain("L{줄번호} `{해당 코드 조각}` [분류: 정확성/효율성/스타일/제약사항] 코멘트 내용");
    expect(prompt).toContain("분류 값은 정확성, 효율성, 스타일, 제약사항 중 하나만 사용하세요.");
    expect(prompt).toContain("각 코멘트는 물리적으로 한 줄로 작성하고 코드 펜스를 사용하지 마세요.");
    expect(prompt).toContain("L{시작}-L{끝} 형식으로 범위를 표시");
    expect(prompt).not.toContain("언어별 마크다운 코드 펜스");
    expect(prompt).toContain("파일 전체에 대한 총평, 요약, 섹션 제목은 작성하지 마세요.");
    expect(prompt).toContain("코멘트 개수를 억지로 채우지 마세요.");
    expect(prompt).toContain("리뷰 코멘트 없음.");
    expect(prompt).toContain("코드 상단 주석");
    expect(prompt).toContain("// N <= 100,000");
    expect(prompt).toContain("// int 범위 내에서만 연산");
    expect(prompt).toContain("// judge-only: import java.util.Scanner");
    expect(prompt).toContain("그 문제에 대해 확인된 사실로 취급하세요.");
    expect(prompt).toContain("그 범위 내에서 오버플로우가 발생하지 않는다면 오버플로우를 경고하지 마세요.");
    expect(prompt).toContain("명시된 범위를 벗어나는 계산");
    expect(prompt).toContain("해당 import 또는 클래스를 컴파일 오류로 지적하지 마세요.");
    expect(prompt).toContain("문제 제약사항(N의 범위, 자료형, 특수 패키지 사용 여부 등)을 코드 상단에 주석으로 먼저 정리하면 더 정확한 리뷰가 가능합니다");
    expect(prompt).toContain("리뷰당 최대 한 번");
    expect(prompt).toContain("시간복잡도와 공간복잡도를 코드대로 추론하세요.");
    expect(prompt).toContain("입력이 매우 클 경우");
    expect(prompt).toContain("코드와 확인된 제약사항에 근거하지 않은 방어적 경고를 작성하지 마세요.");
    expect(prompt).toContain("FEW-SHOT EXAMPLES");
    expect(prompt).toContain("예시의 코드 패턴이나 제약사항을 실제 제출에 적용하거나 실제 제출에 대한 사실로 취급하지 마세요.");
    expect(prompt).toContain("L1 `int last = values[values.length];` [분류: 정확성]");
    expect(prompt).toContain("// N <= 100,000; each value is between 0 and 1,000,000,000");
    expect(prompt).toContain("EXAMPLE 2 OUTPUT\n리뷰 코멘트 없음.");
    expect(prompt.indexOf("FEW-SHOT EXAMPLES")).toBeLessThan(prompt.indexOf("\nSUBMISSION\n"));
    expect(prompt).not.toContain("#### 요약");
    expect(prompt).not.toContain("#### 잠재적 위험");
    expect(prompt).not.toContain("#### 복잡도");
    expect(prompt).not.toContain("#### 가독성");
    expect(prompt).not.toContain("schema_version");
    expect(prompt).toContain("JSON");
    expect(prompt).not.toContain("REQUIRED JSON SHAPE");
    for (const forbidden of ["problem statement", "judge metadata", "official template", "leetcode_id", "title_slug"]) {
      expect(prompt.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("line permalink injection", () => {
  it("converts L{num} to a raw GitHub permalink for code preview", () => {
    const sourceUrl = "https://github.example/fork-user/leetdash/blob/abc1234/submissions/ada/1/solution.java";
    expect(injectLinePermalinks("L17: [분류: 정확성] 배열 접근", sourceUrl))
      .toBe("https://github.example/fork-user/leetdash/blob/abc1234/submissions/ada/1/solution.java#L17: [분류: 정확성] 배열 접근");
    expect(injectLinePermalinks("L100:", sourceUrl))
      .toBe("https://github.example/fork-user/leetdash/blob/abc1234/submissions/ada/1/solution.java#L100:");
  });

  it("converts L{num}-L{num} range to a raw GitHub permalink", () => {
    const sourceUrl = "https://github.example/fork-user/leetdash/blob/abc1234/solution.java";
    expect(injectLinePermalinks("L17-L19에서 반복문 확인", sourceUrl))
      .toBe("https://github.example/fork-user/leetdash/blob/abc1234/solution.java#L17-L19에서 반복문 확인");
  });

  it("handles mixed single and range references without double-linking", () => {
    const sourceUrl = "https://github.example/path/file";
    const result = injectLinePermalinks("L5-L8 범위와 L12 단일 참조", sourceUrl);
    expect(result).toContain("https://github.example/path/file#L5-L8");
    expect(result).toContain("https://github.example/path/file#L12");
  });

  it("returns non-string input unchanged", () => {
    expect(injectLinePermalinks(undefined, "url")).toBeUndefined();
    expect(injectLinePermalinks(null, "url")).toBeNull();
    expect(injectLinePermalinks("text", undefined)).toBe("text");
  });
});

describe("managed review markers and branding", () => {
  it("creates stable, path-specific file markers and parses only leading managed markers", () => {
    const firstMarker = reviewFileMarker(reviewPath);
    const secondMarker = reviewFileMarker("submissions/ada/programmers/12907/solution.java");
    const contentKey = reviewContentKey("class Solution { int value = 1; }");

    expect(firstMarker).toMatch(/^<!-- leetdash-opencode-review-file:[a-f0-9]{64} -->$/);
    expect(firstMarker).not.toBe(secondMarker);
    expect(reviewFileMarker(reviewPath)).toBe(firstMarker);
    expect(contentKey).toMatch(/^[a-f0-9]{64}$/);
    expect(reviewModelMarker("opencode-go/qwen3.7-plus")).toBe("<!-- leetdash-opencode-review-model:opencode-go/qwen3.7-plus -->");
    expect(contentKey).not.toBe(reviewContentKey("class Solution { int value = 2; }"));
    expect(parseManagedReviewMarker(`${firstMarker}\n${reviewContentMarker(contentKey)}\n${reviewModelMarker("opencode-go/qwen3.7-plus")}\nbody`)).toEqual({
      kind: "file",
      key: reviewFileKey(reviewPath),
      contentKey,
      model: "opencode-go/qwen3.7-plus",
    });
    expect(parseManagedReviewMarker(`${firstMarker}\nbody`)).toEqual({ kind: "file", key: reviewFileKey(reviewPath) });
    expect(parseManagedReviewMarker(`${firstMarker}\n<!-- leetdash-opencode-review-content:invalid -->\nbody`)).toEqual({ kind: "file", key: reviewFileKey(reviewPath) });
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

  it("builds a commit-pinned source permalink for a fork repository", () => {
    const headSha = "a".repeat(40);

    expect(buildSourcePermalink({
      serverUrl: "https://github.example/",
      repository: "fork-user/leetdash",
      headSha,
      path: "submissions/ada/problem set/1/solution #1.java",
    })).toBe(
      `https://github.example/fork-user/leetdash/blob/${headSha}/submissions/ada/problem%20set/1/solution%20%231.java`,
    );
  });

  it.each([
    { serverUrl: "not a URL" },
    { serverUrl: "http://github.example" },
    { serverUrl: "https://user:pass@github.example" },
    { repository: "owner/repo/extra" },
    { headSha: "head-sha" },
    { path: "../solution.java" },
    { path: "folder//solution.java" },
    { path: "folder\\solution.java" },
  ])("rejects unsafe source permalink input", (invalid) => {
    expect(() => buildSourcePermalink({
      serverUrl: "https://github.example",
      repository: "fork-user/leetdash",
      headSha: "a".repeat(40),
      path: "submissions/ada/1/solution.java",
      ...invalid,
    })).toThrowError(expect.objectContaining({
      stage: "catalog-resolve",
      reason: "CATALOG_MAPPING_FAILED",
    }));
  });

  it.each([
    { serverUrl: "http://github.com", repository: "whoisyourbias/leetdash", baseSha: "a".repeat(40) },
    { serverUrl: "https://github.com", repository: "invalid", baseSha: "a".repeat(40) },
    { serverUrl: "https://github.com", repository: "whoisyourbias/leetdash", baseSha: "not-a-sha" },
  ])("rejects untrusted mascot URL inputs", (input) => {
    expect(() => buildMascotUrl(input)).toThrowError(expect.objectContaining({
      stage: "catalog-resolve",
      reason: "CATALOG_MAPPING_FAILED",
    }));
  });

  it("renders branded file, warning, and summary comments", () => {
    const mascotUrl = `https://github.com/example/leetdash/raw/${"a".repeat(40)}/public/chalsakbot.png`;
    const contentKey = reviewContentKey("class Solution {}");
    const shared = {
      path: reviewPath,
      headSha: "head-sha-123",
      sourceUrl: `https://github.com/example/leetdash/blob/${"b".repeat(40)}/${reviewPath}`,
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
      mascotUrl,
    };
    const fileBody = renderReviewFileComment({ ...shared, contentKey, markdown: "#### 요약\n읽기 쉬운 반복문입니다." });

    expect(fileBody.startsWith(`${reviewFileMarker(reviewPath)}\n`)).toBe(true);
    expect(fileBody).toContain(reviewContentMarker(contentKey));
    expect(fileBody).toContain("찰싹봇의 코드 리뷰");
    expect(fileBody).toContain('alt="찰싹봇 캐릭터"');
    expect(fileBody).toContain(mascotUrl);
    expect(fileBody).toContain(`파일: [${reviewPath}](${shared.sourceUrl})`);
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
    expect(warningBody).not.toContain("leetdash-opencode-review-content:");
    expect(warningBody).toContain("찰싹봇 리뷰 경고");
    expect(warningBody).toContain(`파일: [${reviewPath}](${shared.sourceUrl})`);
    expect(warningBody).toContain("재시도 가능: 예");

    const summary = renderReviewSummary({
      headSha: "head-sha-123",
      runUrl: shared.runUrl,
      mascotUrl,
      reviewedCount: 2,
      reusedCount: 1,
      warningCount: 1,
      deliveryFailureCount: 0,
    });
    expect(summary.startsWith("<!-- leetdash-opencode-review -->\n")).toBe(true);
    expect(summary).toContain("찰싹봇 리뷰 요약");
    expect(summary).toContain("리뷰 완료: 2개");
    expect(summary).toContain("리뷰 유지: 1개");
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
      contentKey: "a".repeat(64),
      mascotUrl: "https://github.com/example/leetdash/raw/abc1234/public/chalsakbot.png",
      headSha: "abc123",
      path: reviewPath,
      sourceUrl: `https://github.com/example/leetdash/blob/abc123/${reviewPath}`,
      markdown: reviewMarkdown,
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
    });

    expect(markdown.startsWith(reviewFileMarker(reviewPath))).toBe(true);
    expect(markdown).toContain("커밋: abc123");
    expect(markdown).toContain(`파일: [${reviewPath}](https://github.com/example/leetdash/blob/abc123/${reviewPath})`);
    expect(markdown).toContain(reviewMarkdown);
  });

  it("escapes trusted framing values without escaping model Markdown", () => {
    const markdown = renderReviewFileComment({
      contentKey: "a".repeat(64),
      mascotUrl: "https://github.com/example/leetdash/raw/abc1234/public/chalsakbot.png",
      headSha: "abc\n123|def",
      path: "submissions/ada/<script>/1/solution.ts",
      sourceUrl: "https://example.test/source\n42|x",
      markdown: "#### Summary\n**Readable** & direct.",
      runUrl: "https://example.test/run\n42|x",
    });

    expect(markdown).toContain("abc 123\\|def");
    expect(markdown).toContain("submissions/ada/&lt;script&gt;/1/solution.ts");
    expect(markdown).toContain("#### Summary\n**Readable** & direct.");
    expect(markdown).toContain("https://example.test/run 42\\|x");
  });

  it("renders a full-file #L1-L{count} permalink when lineCount is provided", () => {
    const mascotUrl = `https://github.com/example/leetdash/raw/${"a".repeat(40)}/public/chalsakbot.png`;
    const headSha = "abc1234";
    const sourceUrl = `https://github.com/example/leetdash/blob/${headSha}/${reviewPath}`;
    const markdown = renderReviewFileComment({
      contentKey: "a".repeat(64),
      mascotUrl,
      headSha,
      path: reviewPath,
      sourceUrl,
      markdown: "L17 코멘트",
      runUrl: "https://github.com/example/leetdash/actions/runs/42",
      lineCount: 42,
    });
    expect(markdown).toContain(`파일: [${reviewPath}](${sourceUrl}#L1-L42)`);
    expect(markdown).toContain("L17 코멘트");
  });

  it("keeps the managed comment below GitHub size limits", () => {
    const markdown = renderReviewFileComment({
      contentKey: "a".repeat(64),
      mascotUrl: "https://github.com/example/leetdash/raw/abc1234/public/chalsakbot.png",
      headSha: "abc123",
      path: reviewPath,
      sourceUrl: `https://github.com/example/leetdash/blob/abc123/${reviewPath}`,
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
        clientRequestId: "client-request-42",
        attemptCount: 2,
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
    expect(markdown).toContain("클라이언트 요청 ID: client-request-42");
    expect(markdown).toContain("시도 횟수: 2");
  });
});
