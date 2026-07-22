import { createHash } from "node:crypto";

const solutionPathPattern = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)\/solution\.([^.\/]+)$/i;
const maxManagedCommentLength = 60_000;
const truncationNotice = "\n\n> _Review truncated to fit the GitHub comment limit._";
const reviewSummaryMarker = "<!-- leetdash-opencode-review -->";
const reviewFileMarkerPattern = /^<!-- leetdash-opencode-review-file:([a-f0-9]{64}) -->(?:\r?\n|$)/;

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

function reviewFileKey(path) {
  return createHash("sha256").update(String(path), "utf8").digest("hex");
}

function reviewFileMarker(path) {
  return `<!-- leetdash-opencode-review-file:${reviewFileKey(path)} -->`;
}

function parseManagedReviewMarker(body) {
  if (typeof body !== "string") return undefined;
  if (body === reviewSummaryMarker || body.startsWith(`${reviewSummaryMarker}\n`)) return { kind: "summary" };
  const match = reviewFileMarkerPattern.exec(body);
  return match ? { kind: "file", key: match[1] } : undefined;
}

function buildReviewPrompt({ path, language, source }) {
  return `You are performing an informational static review of one submitted source file.

Use only the submission path, language, and code below. Correctness, expected behavior, platform contracts, input limits, and acceptable complexity cannot be inferred. Do not claim that the code is correct or incorrect, predict expected outputs, assume a required platform signature, or say whether the reported complexity fits unknown limits.

Report only risks supported by evidence visible in the submitted code. An edge-case risk must name a boundary condition visible from the code and remain a possible risk, not a correctness verdict. Complexity must describe the code as written without judging whether it fits unknown limits.

Return Markdown only. Do not return JSON, repeat the submitted code, or wrap the response in a code fence. 리뷰의 모든 설명과 제안은 자연스러운 한국어로 작성하세요. 코드 식별자, 경로, 언어 키워드, API 이름, Big-O 표기는 정확성을 위해 원문을 유지할 수 있습니다. 아래 섹션 제목을 정확히 이 순서로 사용하세요. 리뷰는 간결하게 작성하고 발견 사항이 없는 섹션에는 "제출 코드만으로 확인된 사항 없음."이라고 쓰세요.

#### 요약
짧은 문단 하나.

#### 잠재적 위험
- 소스 위치와 발생 조건을 포함한, 코드에서 직접 확인할 수 있는 잠재적 위험.

#### 복잡도
- 시간: 작성된 코드의 시간 복잡도
- 공간: 작성된 코드의 보조 공간 복잡도

#### 가독성
- 소스 위치를 포함한 구체적인 가독성 개선 제안.

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

function limitComment(markdown) {
  if (markdown.length <= maxManagedCommentLength) return markdown;
  return `${markdown.slice(0, maxManagedCommentLength - truncationNotice.length)}${truncationNotice}`;
}

function buildMascotUrl({ serverUrl, repository, baseSha }) {
  let parsedServerUrl;
  try {
    parsedServerUrl = new URL(serverUrl);
  } catch {
    parsedServerUrl = undefined;
  }
  if (
    !parsedServerUrl
    || parsedServerUrl.protocol !== "https:"
    || parsedServerUrl.username
    || parsedServerUrl.password
    || typeof repository !== "string"
    || !/^[^/\s]+\/[^/\s]+$/.test(repository)
    || typeof baseSha !== "string"
    || !/^[a-f0-9]{7,64}$/i.test(baseSha)
  ) {
    throw new ReviewFailure({
      stage: "catalog-resolve",
      reason: "CATALOG_MAPPING_FAILED",
      detail: "Review branding configuration is invalid.",
    });
  }
  return `${parsedServerUrl.origin}${parsedServerUrl.pathname.replace(/\/$/, "")}/${repository}/raw/${encodeURIComponent(baseSha)}/public/chalsakbot.png`;
}

function brandedHeader({ mascotUrl, title }) {
  return [
    `<img src="${markdownText(mascotUrl)}" width="72" alt="찰싹봇 캐릭터" align="left">`,
    `## ${title}`,
    "",
  ];
}

function warningLines(failure) {
  const lines = [
    `단계: ${markdownText(failure.stage)}`,
    `사유: ${markdownText(failure.reason)}`,
    `상세: ${markdownText(failure.detail)}`,
    `재시도 가능: ${failure.retryable ? "예" : "아니요"}`,
  ];
  if (failure.httpStatus !== undefined) lines.push(`HTTP 상태: ${markdownText(failure.httpStatus)}`);
  if (failure.requestId !== undefined) lines.push(`요청 ID: ${markdownText(failure.requestId)}`);
  return lines;
}

function renderReviewFileComment({ path, headSha, runUrl, mascotUrl, markdown }) {
  return limitComment([
    reviewFileMarker(path),
    ...brandedHeader({ mascotUrl, title: "찰싹봇의 코드 리뷰" }),
    `파일: ${markdownText(path)}`,
    `커밋: ${markdownText(headSha)}`,
    `워크플로: ${markdownText(runUrl)}`,
    "",
    markdown,
  ].join("\n"));
}

function renderReviewFileWarning({ path, headSha, runUrl, mascotUrl, failure }) {
  return limitComment([
    reviewFileMarker(path),
    ...brandedHeader({ mascotUrl, title: "찰싹봇 리뷰 경고" }),
    `파일: ${markdownText(path)}`,
    `커밋: ${markdownText(headSha)}`,
    ...warningLines(failure),
    `워크플로: ${markdownText(runUrl)}`,
  ].join("\n"));
}

function renderReviewSummary({
  headSha,
  runUrl,
  mascotUrl,
  reviewedCount,
  warningCount,
  deliveryFailureCount,
  message,
}) {
  return limitComment([
    reviewSummaryMarker,
    ...brandedHeader({ mascotUrl, title: "찰싹봇 리뷰 요약" }),
    `커밋: ${markdownText(headSha)}`,
    ...(message ? [markdownText(message)] : [
      `리뷰 완료: ${reviewedCount}개`,
      `리뷰 경고: ${warningCount}개`,
      `댓글 전달 실패: ${deliveryFailureCount}개`,
    ]),
    `워크플로: ${markdownText(runUrl)}`,
  ].join("\n"));
}

function renderReviewWarning({ headSha, failure, runUrl, mascotUrl }) {
  return limitComment([
    reviewSummaryMarker,
    ...brandedHeader({ mascotUrl, title: "찰싹봇 리뷰 경고" }),
    `커밋: ${markdownText(headSha)}`,
    ...warningLines(failure),
    `워크플로: ${markdownText(runUrl)}`,
  ].join("\n"));
}

export {
  ReviewFailure,
  buildMascotUrl,
  buildReviewPrompt,
  parseManagedReviewMarker,
  parseSubmissionSolutionPath,
  renderReviewFileComment,
  renderReviewFileWarning,
  renderReviewSummary,
  renderReviewWarning,
  reviewFileKey,
  reviewFileMarker,
  reviewSummaryMarker,
  sanitizeReviewMarkdown,
};
