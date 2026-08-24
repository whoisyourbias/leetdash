import { createHash } from "node:crypto";

const solutionPathPattern = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)\/solution\.([^.\/]+)$/i;
const maxManagedCommentLength = 60_000;
const truncationNotice = "\n\n> _Review truncated to fit the GitHub comment limit._";
const reviewSummaryMarker = "<!-- leetdash-opencode-review -->";
const reviewFileMarkerPattern = /^<!-- leetdash-opencode-review-file:([a-f0-9]{64}) -->$/;
const reviewContentMarkerPattern = /^<!-- leetdash-opencode-review-content:([a-f0-9]{64}) -->$/;
const reviewModelMarkerPattern = /^<!-- leetdash-opencode-review-model:([a-z0-9][a-z0-9./_-]*) -->$/;

class ReviewFailure extends Error {
  constructor({ stage, reason, detail, retryable = false, httpStatus, requestId, clientRequestId, attemptCount }) {
    super(detail);
    this.name = "ReviewFailure";
    this.stage = stage;
    this.reason = reason;
    this.detail = detail;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
    this.clientRequestId = clientRequestId;
    this.attemptCount = attemptCount;
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

function reviewContentKey(source) {
  return createHash("sha256").update(String(source), "utf8").digest("hex");
}

function reviewContentMarker(contentKey) {
  if (!/^[a-f0-9]{64}$/.test(contentKey)) throw new TypeError("Invalid review content key.");
  return `<!-- leetdash-opencode-review-content:${contentKey} -->`;
}

function reviewModelMarker(model) {
  if (typeof model !== "string" || !/^[a-z0-9][a-z0-9./_-]*$/.test(model)) {
    throw new TypeError("Invalid review model.");
  }
  return `<!-- leetdash-opencode-review-model:${model} -->`;
}

function parseManagedReviewMarker(body) {
  if (typeof body !== "string") return undefined;
  if (body === reviewSummaryMarker || body.startsWith(`${reviewSummaryMarker}\n`) || body.startsWith(`${reviewSummaryMarker}\r\n`)) {
    return { kind: "summary" };
  }
  const [firstLine, secondLine, thirdLine] = body.split(/\r?\n/, 3);
  const fileMatch = reviewFileMarkerPattern.exec(firstLine);
  if (!fileMatch) return undefined;
  const contentMatch = reviewContentMarkerPattern.exec(secondLine ?? "");
  const modelMatch = reviewModelMarkerPattern.exec(thirdLine ?? "");
  return {
    kind: "file",
    key: fileMatch[1],
    ...(contentMatch ? { contentKey: contentMatch[1] } : {}),
    ...(modelMatch ? { model: modelMatch[1] } : {}),
  };
}

function buildReviewPrompt({ path, language, source }) {
  return `당신은 알고리즘/코딩테스트 문제 풀이 코드를 리뷰하는 시니어 개발자입니다.
리뷰의 목적은 정답 여부 판별이 아니라 코드 품질, 잠재적 실수, 복잡도 관점에서 실질적인 피드백을 제공하는 것입니다.

제출 경로, 언어, 코드만 사용하세요. 문제의 원문, 입출력 제한, 예제, 플랫폼 계약은 크롤링하거나 외부에서 참조하지 마세요. 코드를 정답 또는 오답이라고 단정하거나, 코드에 근거가 없는 예상 출력 또는 필수 플랫폼 시그니처를 가정하지 마세요.

리뷰 형식:
- 리뷰는 반드시 코드 라인 단위 인라인 코멘트로만 작성하세요. 파일 전체에 대한 총평, 요약, 섹션 제목은 작성하지 마세요.
- 코멘트가 필요한 라인에만 "몇 번째 줄 - 어떤 문제 - 어떻게 개선"이 드러나는 구체적인 피드백을 작성하세요. 코멘트 개수를 억지로 채우지 마세요.
- 각 코멘트는 다음 형식을 정확히 따르세요:
  L{줄번호} \`{해당 코드 조각}\` [분류: 정확성/효율성/스타일/제약사항] 코멘트 내용
- 분류 값은 정확성, 효율성, 스타일, 제약사항 중 하나만 사용하세요.
- 각 코멘트는 물리적으로 한 줄로 작성하고 코드 펜스를 사용하지 마세요.
- 한 코멘트가 여러 라인에 걸치면 L{시작}-L{끝} 형식으로 범위를 표시하고 핵심 코드 조각만 인라인 코드로 인용하세요.
- 코드 식별자, 경로, 언어 키워드, API 이름, Big-O 표기는 정확성을 위해 원문을 유지할 수 있습니다. 모든 설명과 제안은 자연스러운 한국어로 작성하세요.
- 코멘트할 사항이 전혀 없으면 "리뷰 코멘트 없음."만 반환하세요.

제약사항 처리:
- 코드 상단 주석에 사용자가 명시한 제약사항(예: \`// N <= 100,000\`, \`// int 범위 내에서만 연산\`, \`// judge-only: import java.util.Scanner\`)만 그 문제에 대해 확인된 사실로 취급하세요.
- 자료형 범위나 입력 크기가 상단 주석에 명시되어 있고 그 범위 내에서 오버플로우가 발생하지 않는다면 오버플로우를 경고하지 마세요. 명시된 범위를 벗어나는 계산(곱셈 누적, 팩토리얼 등)이 코드에 있을 때만 경고하세요.
- \`judge-only\`, \`채점환경 전용\` 등 채점 서버 전용 패키지 또는 클래스임을 상단 주석에 명시했다면 해당 import 또는 클래스를 컴파일 오류로 지적하지 마세요.
- 위와 같은 문제 제약사항 주석이 코드 상단에 전혀 없을 때만 다음 제안을 리뷰당 최대 한 번 작성하세요: "문제 제약사항(N의 범위, 자료형, 특수 패키지 사용 여부 등)을 코드 상단에 주석으로 먼저 정리하면 더 정확한 리뷰가 가능합니다"
- 명시되지 않은 입력 크기나 자료형 범위를 가정하지 마세요. "입력이 매우 클 경우"처럼 코드와 확인된 제약사항에 근거하지 않은 방어적 경고를 작성하지 마세요.

리뷰 기준:
- 코드에서 직접 확인할 수 있는 잠재적 정확성 위험은 발생 조건과 개선 방법을 함께 제시하세요. 정답 여부를 판정하지 마세요.
- 시간복잡도와 공간복잡도를 코드대로 추론하세요. 확인된 입력 제약과 결합해 문제가 되는 경우 또는 더 나은 구현을 구체적으로 제안할 수 있는 경우에만 해당 라인에 효율성 코멘트를 작성하세요.
- 사용자가 상단 주석으로 이미 확인한 범위, 자료형, 특수 패키지 사항을 다시 경고하지 마세요.

FEW-SHOT EXAMPLES
다음 예시는 출력 형식과 코멘트를 작성할 판단 기준만 보여줍니다. 예시의 코드 패턴이나 제약사항을 실제 제출에 적용하거나 실제 제출에 대한 사실로 취급하지 마세요.

EXAMPLE 1 INPUT
- language: java
CODE
int last = values[values.length];

EXAMPLE 1 OUTPUT
L1 \`int last = values[values.length];\` [분류: 정확성] 배열의 마지막 유효 인덱스는 \`values.length - 1\`이므로 현재 접근은 항상 범위를 벗어납니다. 빈 배열을 먼저 처리한 뒤 \`values[values.length - 1]\`을 사용하세요.

EXAMPLE 2 INPUT
- language: java
CODE
// N <= 100,000; each value is between 0 and 1,000,000,000
long sum = 0;
for (int value : values) {
    sum += value;
}

EXAMPLE 2 OUTPUT
리뷰 코멘트 없음.

출력은 리뷰 본문만 반환하세요. JSON, 제출 코드, 코드 펜스, 머리말, 맺음말을 반환하지 마세요.

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

function buildSourcePermalink({ serverUrl, repository, headSha, path }) {
  let parsedServerUrl;
  try {
    parsedServerUrl = new URL(serverUrl);
  } catch {
    parsedServerUrl = undefined;
  }
  const segments = typeof path === "string" ? path.split("/") : [];
  if (
    !parsedServerUrl
    || parsedServerUrl.protocol !== "https:"
    || parsedServerUrl.username
    || parsedServerUrl.password
    || typeof repository !== "string"
    || !/^[^/\s]+\/[^/\s]+$/.test(repository)
    || typeof headSha !== "string"
    || !/^[a-f0-9]{7,64}$/i.test(headSha)
    || segments.length === 0
    || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))
  ) {
    throw new ReviewFailure({
      stage: "catalog-resolve",
      reason: "CATALOG_MAPPING_FAILED",
      detail: "Review source link configuration is invalid.",
    });
  }
  const serverPrefix = `${parsedServerUrl.origin}${parsedServerUrl.pathname.replace(/\/$/, "")}`;
  const encodedPath = segments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${serverPrefix}/${repository}/blob/${encodeURIComponent(headSha)}/${encodedPath}`;
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
  if (failure.clientRequestId !== undefined) lines.push(`클라이언트 요청 ID: ${markdownText(failure.clientRequestId)}`);
  if (failure.attemptCount !== undefined) lines.push(`시도 횟수: ${markdownText(failure.attemptCount)}`);
  return lines;
}

function renderReviewFileComment({ path, sourceUrl, contentKey, model = "opencode-go/deepseek-v4-flash", headSha, runUrl, mascotUrl, markdown, lineCount }) {
  const permalink = Number.isInteger(lineCount) && lineCount > 0
    ? `${sourceUrl}#L1-L${lineCount}`
    : sourceUrl;
  return limitComment([
    reviewFileMarker(path),
    reviewContentMarker(contentKey),
    reviewModelMarker(model),
    ...brandedHeader({ mascotUrl, title: "찰싹봇의 코드 리뷰" }),
    `파일: [${markdownText(path)}](${markdownText(permalink)})`,
    `커밋: ${markdownText(headSha)}`,
    `모델: ${markdownText(model)}`,
    `워크플로: ${markdownText(runUrl)}`,
    "",
    markdown,
  ].join("\n"));
}

function renderReviewFileWarning({ path, sourceUrl, model, headSha, runUrl, mascotUrl, failure }) {
  return limitComment([
    reviewFileMarker(path),
    ...brandedHeader({ mascotUrl, title: "찰싹봇 리뷰 경고" }),
    `파일: [${markdownText(path)}](${markdownText(sourceUrl)})`,
    `커밋: ${markdownText(headSha)}`,
    ...(model ? [`모델: ${markdownText(model)}`] : []),
    ...warningLines(failure),
    `워크플로: ${markdownText(runUrl)}`,
  ].join("\n"));
}

function renderReviewSummary({
  headSha,
  runUrl,
  mascotUrl,
  reviewedCount,
  reusedCount = 0,
  warningCount,
  deferredCount = 0,
  deliveryFailureCount,
  message,
}) {
  return limitComment([
    reviewSummaryMarker,
    ...brandedHeader({ mascotUrl, title: "찰싹봇 리뷰 요약" }),
    `커밋: ${markdownText(headSha)}`,
    ...(message ? [markdownText(message)] : [
      `리뷰 완료: ${reviewedCount}개`,
      `리뷰 유지: ${reusedCount}개`,
      `리뷰 경고: ${warningCount}개`,
      ...(deferredCount > 0 ? [`복구 대기: ${deferredCount}개`] : []),
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

function injectLinePermalinks(text, sourceUrl) {
  if (typeof text !== "string" || typeof sourceUrl !== "string") return text;
  // Single regex pass: ranges (L{num}-L{num}) take priority over singles (L{num}).
  // Alternation tries range first so `L17-L19` is consumed whole, not as `L17` then `L19`.
  return text.replace(/L(\d+)-L(\d+)|L(\d+)\b/g, (_match, rangeStart, rangeEnd, single) => {
    if (rangeStart !== undefined) {
      return `${sourceUrl}#L${rangeStart}-L${rangeEnd}`;
    }
    return `${sourceUrl}#L${single}`;
  });
}

export {
  ReviewFailure,
  buildMascotUrl,
  buildReviewPrompt,
  buildSourcePermalink,
  injectLinePermalinks,
  parseManagedReviewMarker,
  parseSubmissionSolutionPath,
  renderReviewFileComment,
  renderReviewFileWarning,
  renderReviewSummary,
  renderReviewWarning,
  reviewContentKey,
  reviewContentMarker,
  reviewModelMarker,
  reviewFileKey,
  reviewFileMarker,
  reviewSummaryMarker,
  sanitizeReviewMarkdown,
};
