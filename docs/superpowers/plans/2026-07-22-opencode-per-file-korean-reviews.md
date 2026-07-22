# OpenCode Per-File Korean Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish each OpenCode result immediately as a managed, branded `찰싹봇` PR comment, continue after per-file failures, and request all review prose in Korean.

**Architecture:** Keep trusted PR-scope discovery and sequential OpenCode calls in `opencode-review.mjs`, but replace the single aggregate delivery step with per-file result isolation and immediate managed-comment upserts. Put deterministic markers, Korean prompt text, branding URLs, and Markdown renderers in the core module; keep GitHub pagination and comment CRUD in the client module. Store the approved mascot in `public/chalsakbot.png` and reference it by the trusted base SHA.

**Tech Stack:** Node.js 20 ESM, GitHub REST API, OpenCode OpenAI-compatible chat completions, Vitest 3, GitHub Actions, PNG asset.

## Global Constraints

- The GitHub comment author remains `github-actions[bot]`; do not add a GitHub App, PAT, secret, or workflow permission.
- The visible review persona is exactly `찰싹봇`.
- Store the approved mascot at exactly `public/chalsakbot.png`, resized to 512×512 PNG.
- Review only added or modified `solution.*` files and keep calls sequential.
- Each model prompt contains only that file's repository path, language, and complete source.
- All model prose and headings are Korean; code identifiers, paths, language keywords, API names, and Big-O notation may remain unchanged.
- Per-file findings and operational warnings remain informational; only failure to establish a trusted PR snapshot fails the check.
- Never expose API keys, authorization headers, raw provider bodies, raw exceptions, or submitted source in warnings, comments, check output, summaries, or logs.
- Managed-comment mutations apply only to comments authored by `github-actions[bot]` with an exact recognized marker.
- Preserve the current 180-second OpenCode request timeout, 45-minute workflow timeout, exact-head source reads, and `validate,opencode-review` sweeper requirements.
- Begin execution in an isolated worktree created from current `origin/master`; preserve the user's untracked submission files in the original worktree.

---

## File Structure

- Create `public/chalsakbot.png`: approved 512×512 mascot used only in trusted comment framing.
- Modify `scripts/opencode-review-core.mjs`: Korean prompt, stable managed markers, mascot URL construction, branded file/warning/summary rendering.
- Modify `scripts/opencode-review-clients.mjs`: discover managed bot comments once, upsert by known comment ID, delete stale managed comments.
- Modify `scripts/opencode-review.mjs`: isolate each file attempt, publish immediately, continue after failures, reconcile stale comments, publish compact summary.
- Modify `tests/opencode-review-core.test.mjs`: deterministic marker, Korean prompt, trusted image URL, renderer, sanitization, truncation tests.
- Modify `tests/opencode-review-clients.test.mjs`: managed-comment discovery, ID-based create/update, spoof preservation, deletion, delivery-failure tests.
- Modify `tests/opencode-review.test.mjs`: immediate ordering, partial failure continuation, summary counts, stale cleanup, branding integration, informational semantics.
- Verify `.github/workflows/opencode-review.yml`, `.github/workflows/sweep-submission-prs.yml`, and their existing tests without changing permissions or required checks.

---

### Task 1: Korean Prompt, Stable Markers, and Branded Renderers

**Files:**
- Modify: `scripts/opencode-review-core.mjs:1-143`
- Test: `tests/opencode-review-core.test.mjs`

**Interfaces:**
- Consumes: Node built-in `node:crypto` `createHash`.
- Produces: `reviewSummaryMarker`, `reviewFileKey(path)`, `reviewFileMarker(path)`, `parseManagedReviewMarker(body)`, `buildMascotUrl({ serverUrl, repository, baseSha })`, `renderReviewFileComment(...)`, `renderReviewFileWarning(...)`, `renderReviewSummary(...)`, and the revised `buildReviewPrompt(...)`.

- [ ] **Step 1: Replace the English prompt expectations with failing Korean-contract tests**

Add assertions to the existing `review prompt` test:

```js
expect(prompt).toContain("리뷰의 모든 설명과 제안은 자연스러운 한국어로 작성하세요.");
expect(prompt).toContain("코드 식별자, 경로, 언어 키워드, API 이름, Big-O 표기는 정확성을 위해 원문을 유지할 수 있습니다.");
expect(prompt).toContain("#### 요약");
expect(prompt).toContain("#### 잠재적 위험");
expect(prompt).toContain("#### 복잡도");
expect(prompt).toContain("#### 가독성");
expect(prompt).toContain("제출 코드만으로 확인된 사항 없음.");
expect(prompt).not.toContain("#### Summary");
expect(prompt).not.toContain("None observed from the submitted code alone.");
```

- [ ] **Step 2: Add failing marker and branding renderer tests**

Import the new functions and add tests with these exact contracts:

```js
const firstMarker = reviewFileMarker("submissions/ada/programmers/12906/solution.java");
const secondMarker = reviewFileMarker("submissions/ada/programmers/12907/solution.java");
expect(firstMarker).toMatch(/^<!-- leetdash-opencode-review-file:[a-f0-9]{64} -->$/);
expect(firstMarker).not.toBe(secondMarker);
expect(reviewFileMarker(reviewPath)).toBe(firstMarker);
expect(parseManagedReviewMarker(`${firstMarker}\nbody`)).toEqual({
  kind: "file",
  key: reviewFileKey(reviewPath),
});
expect(parseManagedReviewMarker("<!-- leetdash-opencode-review -->\nbody")).toEqual({ kind: "summary" });
expect(parseManagedReviewMarker(`prefix ${firstMarker}`)).toBeUndefined();
```

Add URL and rendering assertions:

```js
const baseSha = "a".repeat(40);
const mascotUrl = buildMascotUrl({
  serverUrl: "https://github.com/",
  repository: "whoisyourbias/leetdash",
  baseSha,
});
expect(mascotUrl).toBe(`https://github.com/whoisyourbias/leetdash/raw/${baseSha}/public/chalsakbot.png`);

const fileBody = renderReviewFileComment({
  path: reviewPath,
  headSha: "head-sha-123",
  runUrl: "https://github.com/example/leetdash/actions/runs/42",
  mascotUrl,
  markdown: "#### 요약\n읽기 쉬운 반복문입니다.",
});
expect(fileBody.startsWith(`${reviewFileMarker(reviewPath)}\n`)).toBe(true);
expect(fileBody).toContain("찰싹봇의 코드 리뷰");
expect(fileBody).toContain('alt="찰싹봇 캐릭터"');
expect(fileBody).toContain(mascotUrl);
expect(fileBody).toContain(reviewPath);
expect(fileBody).toContain("#### 요약");

const summary = renderReviewSummary({
  headSha: "head-sha-123",
  runUrl: "https://github.com/example/leetdash/actions/runs/42",
  mascotUrl,
  reviewedCount: 2,
  warningCount: 1,
  deliveryFailureCount: 0,
});
expect(summary.startsWith("<!-- leetdash-opencode-review -->\n")).toBe(true);
expect(summary).toContain("찰싹봇 리뷰 요약");
expect(summary).toContain("리뷰 완료: 2개");
expect(summary).toContain("리뷰 경고: 1개");
```

- [ ] **Step 3: Run the core tests and verify the new contract fails**

Run:

```bash
npx vitest run tests/opencode-review-core.test.mjs
```

Expected: FAIL because the Korean prompt and new marker/rendering exports do not exist.

- [ ] **Step 4: Implement the Korean prompt and deterministic managed markers**

At the top of `scripts/opencode-review-core.mjs`, add:

```js
import { createHash } from "node:crypto";

const reviewSummaryMarker = "<!-- leetdash-opencode-review -->";
const reviewFileMarkerPattern = /^<!-- leetdash-opencode-review-file:([a-f0-9]{64}) -->(?:\r?\n|$)/;

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
```

Replace only the response-language and heading portion of `buildReviewPrompt` with:

```text
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
```

- [ ] **Step 5: Implement immutable mascot URLs and branded renderers**

Add a strict URL builder:

```js
function buildMascotUrl({ serverUrl, repository, baseSha }) {
  if (
    typeof serverUrl !== "string"
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
  return `${serverUrl.replace(/\/$/, "")}/${repository}/raw/${encodeURIComponent(baseSha)}/public/chalsakbot.png`;
}
```

Replace aggregate result rendering with these focused functions:

```js
function brandedHeader({ mascotUrl, title }) {
  return [
    `<img src="${markdownText(mascotUrl)}" width="72" alt="찰싹봇 캐릭터" align="left">`,
    `## ${title}`,
    "",
  ];
}

function limitComment(markdown) {
  if (markdown.length <= maxManagedCommentLength) return markdown;
  return `${markdown.slice(0, maxManagedCommentLength - truncationNotice.length)}${truncationNotice}`;
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

function renderReviewSummary({ headSha, runUrl, mascotUrl, reviewedCount, warningCount, deliveryFailureCount, message }) {
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
```

Extract the current warning fields into `warningLines(failure)` so global and per-file warnings share identical sanitized fields. Keep `renderReviewWarning` as the summary-marker global failure renderer for trusted-scope/configuration failures, but brand it with `찰싹봇` and accept `mascotUrl` when available.

Export every interface listed above and remove the obsolete aggregate `renderReviewComment` export after its callers are migrated in Task 3.

- [ ] **Step 6: Run the core tests and verify they pass**

Run:

```bash
npx vitest run tests/opencode-review-core.test.mjs
```

Expected: PASS, including Korean prompt, stable marker, sanitized warning, branding URL, and 60,000-character bound tests.

- [ ] **Step 7: Commit the core contract**

```bash
git add scripts/opencode-review-core.mjs tests/opencode-review-core.test.mjs
git commit -m "feat: add Korean Chalsakbot review rendering"
```

---

### Task 2: Managed GitHub Comment Discovery and CRUD

**Files:**
- Modify: `scripts/opencode-review-clients.mjs:1-289`
- Test: `tests/opencode-review-clients.test.mjs`

**Interfaces:**
- Consumes: `parseManagedReviewMarker(body)` from Task 1.
- Produces: `GitHubReviewClient.listManagedReviewComments(pullNumber)`, `GitHubReviewClient.upsertReviewComment({ pullNumber, commentId, body })`, and `GitHubReviewClient.deleteReviewComment(commentId)`.

- [ ] **Step 1: Write failing managed-comment discovery tests**

Replace the existing single-marker lookup tests with a paginated fixture containing:

```js
const summary = { id: 31, body: "<!-- leetdash-opencode-review -->\nsummary", user: { login: "github-actions[bot]" } };
const file = { id: 32, body: `${reviewFileMarker(reviewPath)}\nfile`, user: { login: "github-actions[bot]" } };
const spoof = { id: 33, body: `${reviewFileMarker(reviewPath)}\nspoof`, user: { login: "ada" } };
```

Assert:

```js
await expect(client.listManagedReviewComments(7)).resolves.toEqual([
  { id: 31, kind: "summary" },
  { id: 32, kind: "file", key: parseManagedReviewMarker(file.body).key },
]);
expect(requests.slice(0, 2).map(({ url }) => url)).toEqual([
  "https://api.github.com/repos/example/leetdash/issues/7/comments?per_page=100&page=1",
  "https://api.github.com/repos/example/leetdash/issues/7/comments?per_page=100&page=2",
]);
```

- [ ] **Step 2: Write failing ID-based upsert and deletion tests**

Add these exact behaviors:

```js
await client.upsertReviewComment({ pullNumber: 7, commentId: 32, body: "updated" });
expect(requests.at(-1)).toMatchObject({ method: "PATCH" });
expect(new URL(requests.at(-1).url).pathname).toBe("/repos/example/leetdash/issues/comments/32");

await client.upsertReviewComment({ pullNumber: 7, body: "created" });
expect(new URL(requests.at(-1).url).pathname).toBe("/repos/example/leetdash/issues/7/comments");
expect(requests.at(-1).method).toBe("POST");

await client.deleteReviewComment(32);
expect(new URL(requests.at(-1).url).pathname).toBe("/repos/example/leetdash/issues/comments/32");
expect(requests.at(-1).method).toBe("DELETE");
```

Keep failure tests that assert response bodies, tokens, and raw errors are absent from `GitHubDeliveryFailure`.

- [ ] **Step 3: Run client tests and verify they fail**

Run:

```bash
npx vitest run tests/opencode-review-clients.test.mjs
```

Expected: FAIL because comment discovery, explicit IDs, and deletion are not implemented.

- [ ] **Step 4: Implement one-time managed-comment discovery**

Import `parseManagedReviewMarker` and replace `upsertReviewComment`'s implicit listing with:

```js
async listManagedReviewComments(pullNumber) {
  const comments = await this.listIssueComments(pullNumber);
  return comments.flatMap((comment) => {
    if (
      comment?.user?.login !== "github-actions[bot]"
      || !Number.isSafeInteger(comment.id)
    ) return [];
    const marker = parseManagedReviewMarker(comment.body);
    return marker ? [{ id: comment.id, ...marker }] : [];
  });
}
```

- [ ] **Step 5: Implement explicit create, update, and delete operations**

Use only resolved numeric IDs:

```js
upsertReviewComment({ pullNumber, commentId, body }) {
  if (commentId !== undefined) {
    if (!Number.isSafeInteger(commentId)) throw new GitHubDeliveryFailure({});
    return this.request("PATCH", `/issues/comments/${commentId}`, {
      body: { body },
      FailureType: GitHubDeliveryFailure,
    });
  }
  return this.request("POST", `/issues/${pullNumber}/comments`, {
    body: { body },
    FailureType: GitHubDeliveryFailure,
  });
}

deleteReviewComment(commentId) {
  if (!Number.isSafeInteger(commentId)) throw new GitHubDeliveryFailure({});
  return this.request("DELETE", `/issues/comments/${commentId}`, {
    FailureType: GitHubDeliveryFailure,
  });
}
```

- [ ] **Step 6: Run client tests and verify they pass**

Run:

```bash
npx vitest run tests/opencode-review-clients.test.mjs
```

Expected: PASS, including pagination, bot-author filtering, spoof preservation, create/update/delete, and sanitized failure cases.

- [ ] **Step 7: Commit the GitHub comment client**

```bash
git add scripts/opencode-review-clients.mjs tests/opencode-review-clients.test.mjs
git commit -m "feat: manage per-file review comments"
```

---

### Task 3: Immediate Per-File Delivery and Failure Isolation

**Files:**
- Modify: `scripts/opencode-review.mjs:5-419`
- Test: `tests/opencode-review.test.mjs`

**Interfaces:**
- Consumes: Task 1 renderers and marker helpers; Task 2 managed-comment CRUD.
- Produces: `reviewPullRequest(...)` result `{ results, conclusion, markdown, failures }`, where each result has `{ path, status: "reviewed" | "warning", markdown?, failure? }` and `markdown` is the compact final summary.

- [ ] **Step 1: Rewrite the multi-file test to require immediate delivery order**

Use a shared event list and two changed solutions:

```js
const events = [];
const openCodeClient = {
  review: async ({ prompt }) => {
    const path = prompt.includes(firstPath) ? firstPath : secondPath;
    events.push(`review:${path}`);
    if (path === secondPath) {
      expect(events).toContain(`comment:${firstPath}`);
    }
    return passResult();
  },
};
const githubClient = {
  createCheck: async () => ({ id: 17 }),
  completeCheck: async (value) => { completed.push(value); },
  listManagedReviewComments: async () => [],
  upsertReviewComment: async ({ body }) => {
    const path = [firstPath, secondPath].find((value) => body.includes(value));
    events.push(path ? `comment:${path}` : "comment:summary");
    return { id: events.length + 100 };
  },
  deleteReviewComment: async () => {},
};
```

Assert exact ordering:

```js
expect(events).toEqual([
  `review:${firstPath}`,
  `comment:${firstPath}`,
  `review:${secondPath}`,
  `comment:${secondPath}`,
  "comment:summary",
]);
```

- [ ] **Step 2: Add failing continuation, reuse, stale-cleanup, and delivery-failure tests**

Add four focused tests:

1. The first OpenCode call throws `ReviewFailure`, its file warning is posted, the second file is still reviewed and posted, and the check concludes `success`.
2. Existing managed file and summary comment IDs are passed to PATCH-style upserts; no duplicate create occurs.
3. A managed file comment whose digest is absent from the current target set is deleted only after both current targets are attempted.
4. One file-comment delivery failure increments `deliveryFailureCount`, does not expose its request ID, and does not prevent the next OpenCode call.

Use these final count assertions:

```js
expect(result.results.map(({ status }) => status)).toEqual(["warning", "reviewed"]);
expect(result.markdown).toContain("리뷰 완료: 1개");
expect(result.markdown).toContain("리뷰 경고: 1개");
expect(result.markdown).toContain("댓글 전달 실패: 0개");
expect(completed.at(-1)).toMatchObject({ conclusion: "success" });
```

- [ ] **Step 3: Run orchestration tests and verify they fail**

Run:

```bash
npx vitest run tests/opencode-review.test.mjs
```

Expected: FAIL because the current orchestrator waits for every model call and aborts on the first file failure.

- [ ] **Step 4: Add per-file review isolation**

Inside the trusted submission-only branch, replace the aggregate loop with a helper shaped as follows:

```js
async function reviewOneFile({ file, readSource, openCodeClient, model, apiKey }) {
  let stage = "path-parse";
  let path = file.path;
  try {
    const parsed = parseSubmissionSolutionPath(file.path);
    path = parsed.path;
    stage = "source-read";
    const source = await readSource(parsed.path);
    const prompt = buildReviewPrompt({ path: parsed.path, language: parsed.extension, source });
    stage = "model-request";
    const raw = await openCodeClient.review({ model, apiKey, prompt });
    stage = "model-response";
    return {
      path,
      status: "reviewed",
      markdown: sanitizeReviewMarkdown(redactModelText(raw, source)),
    };
  } catch (error) {
    return {
      path,
      status: "warning",
      failure: error instanceof ReviewFailure ? error : failureForStage(stage),
    };
  }
}
```

Do not catch trusted-scope discovery outside the existing outer fail-closed boundary.

- [ ] **Step 5: Load managed comments once and publish each file immediately**

After computing target files:

```js
let managedComments = [];
let commentDiscoveryAvailable = true;
try {
  managedComments = await githubClient.listManagedReviewComments(pullNumber);
} catch {
  commentDiscoveryAvailable = false;
}
const summaryComment = managedComments.find((comment) => comment.kind === "summary");
const fileComments = new Map(
  managedComments
    .filter((comment) => comment.kind === "file")
    .map((comment) => [comment.key, comment]),
);
```

For every target, await `reviewOneFile`, render either `renderReviewFileComment` or `renderReviewFileWarning`, and immediately call:

```js
await githubClient.upsertReviewComment({
  pullNumber,
  commentId: fileComments.get(reviewFileKey(result.path))?.id,
  body,
});
```

Catch only delivery failures around that upsert, increment `deliveryFailureCount`, and continue. When comment discovery failed, skip all mutating comment calls to avoid duplicates, count each skipped file as a delivery failure, and preserve results in the check summary.

- [ ] **Step 6: Reconcile stale comments and publish the compact summary**

After all file attempts, derive the current marker-key set. Delete only managed file comments not in that set, and catch each deletion failure as another delivery failure. Then render and upsert the summary using `summaryComment?.id`.

For zero target files, publish a branded summary with:

```js
renderReviewSummary({
  headSha,
  runUrl,
  mascotUrl,
  reviewedCount: 0,
  warningCount: 0,
  deliveryFailureCount,
  message: "변경된 solution.* 파일이 없어 리뷰를 생략했습니다.",
});
```

Append the same compact summary to `$GITHUB_STEP_SUMMARY` and use it as the explicit check output. Keep non-submission PRs comment-free and successful.

- [ ] **Step 7: Pass trusted branding inputs from `main()`**

Build the mascot URL only after required CLI/environment configuration succeeds:

```js
const mascotUrl = buildMascotUrl({
  serverUrl: env.GITHUB_SERVER_URL,
  repository: env.GITHUB_REPOSITORY,
  baseSha: args.base,
});
```

Pass `mascotUrl` into `reviewPullRequest`. Do not add workflow inputs, environment variables, secrets, or permissions.

- [ ] **Step 8: Update existing redaction and informational tests to inspect all file and summary bodies**

Change fixtures from one `upsertReviewComment` call to the new managed-comment API. Aggregate captured bodies with:

```js
const output = [
  ...comments.map(({ body }) => body),
  ...checks.flatMap((check) => [check.title, check.summary]),
  await readFile(summaryPath, "utf8"),
].join("\n");
```

Retain assertions that API keys, authorization values, submitted source, raw exceptions, and unsafe marker/path text do not appear. Update expected model headings from English to Korean.

- [ ] **Step 9: Run orchestration tests and verify they pass**

Run:

```bash
npx vitest run tests/opencode-review.test.mjs
```

Expected: PASS, including immediate order, per-file continuation, stale cleanup, delivery diagnostics, exact-head reads, non-submission no-op, and trusted-scope failure.

- [ ] **Step 10: Commit the orchestration change**

```bash
git add scripts/opencode-review.mjs tests/opencode-review.test.mjs
git commit -m "feat: publish OpenCode reviews per file"
```

---

### Task 4: Add the Approved Chalsakbot Asset

**Files:**
- Create: `public/chalsakbot.png`
- Test: `tests/opencode-review-core.test.mjs`

**Interfaces:**
- Consumes: generated source image `/Users/ddinghwan/.codex/generated_images/019f89d5-1008-7ff3-a0e2-18e4fc1b7fa0/exec-a202a254-2831-41b7-9fe6-098018027ea6.png`.
- Produces: a 512×512 PNG at `public/chalsakbot.png` referenced by Task 1's `buildMascotUrl`.

- [ ] **Step 1: Add a failing repository-asset test**

At the top of `tests/opencode-review-core.test.mjs`, import `readFile` from `node:fs/promises`. Add:

```js
it("ships the approved Chalsakbot mascot as a PNG", async () => {
  const image = await readFile("public/chalsakbot.png");
  expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(image.length).toBeGreaterThan(10_000);
  expect(image.length).toBeLessThan(1_000_000);
});
```

- [ ] **Step 2: Run the asset test and verify it fails**

Run:

```bash
npx vitest run tests/opencode-review-core.test.mjs -t "ships the approved Chalsakbot mascot"
```

Expected: FAIL with `ENOENT` for `public/chalsakbot.png`.

- [ ] **Step 3: Copy and resize the approved generated image**

Copy the approved source, then resize the project copy without modifying the generated original:

```bash
cp /Users/ddinghwan/.codex/generated_images/019f89d5-1008-7ff3-a0e2-18e4fc1b7fa0/exec-a202a254-2831-41b7-9fe6-098018027ea6.png public/chalsakbot.png
sips -z 512 512 public/chalsakbot.png
```

Verify:

```bash
sips -g pixelWidth -g pixelHeight -g format public/chalsakbot.png
```

Expected: `pixelWidth: 512`, `pixelHeight: 512`, `format: png`.

- [ ] **Step 4: Run the asset and core tests**

Run:

```bash
npx vitest run tests/opencode-review-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the mascot asset**

```bash
git add public/chalsakbot.png tests/opencode-review-core.test.mjs
git commit -m "feat: add Chalsakbot review mascot"
```

---

### Task 5: Full Regression Verification and Documentation Consistency

**Files:**
- Verify: `.github/workflows/opencode-review.yml`
- Verify: `.github/workflows/sweep-submission-prs.yml`
- Verify: `tests/opencode-review-workflow.test.ts`
- Verify: `tests/sweep-workflow.test.ts`
- Verify: `docs/superpowers/specs/2026-07-22-opencode-per-file-korean-review-design.md`

**Interfaces:**
- Consumes: all earlier task commits.
- Produces: a fully verified branch with no workflow-permission or merge-gate regressions.

- [ ] **Step 1: Run the focused OpenCode review suite**

```bash
npx vitest run \
  tests/opencode-review-core.test.mjs \
  tests/opencode-review-clients.test.mjs \
  tests/opencode-review.test.mjs \
  tests/opencode-review-workflow.test.ts \
  tests/sweep-workflow.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the complete test suite**

```bash
npm test
```

Expected: all tests PASS with zero failures.

- [ ] **Step 3: Run type checking**

```bash
npm run typecheck
```

Expected: `next typegen` and `tsc --noEmit -p tsconfig.typecheck.json` exit 0.

- [ ] **Step 4: Run the production static build**

```bash
npm run build
```

Expected: progress generation and Next.js static export complete successfully.

- [ ] **Step 5: Verify workflow security and merge-gate invariants**

Run:

```bash
rg -n "contents: read|checks: write|pull-requests: write|persist-credentials: false|SWEEP_REQUIRED_CHECKS: validate,opencode-review" \
  .github/workflows/opencode-review.yml \
  .github/workflows/sweep-submission-prs.yml
git diff origin/master -- .github/workflows
```

Expected: every required invariant is present and the workflow diff is empty.

- [ ] **Step 6: Inspect the final diff for accidental source or secret inclusion**

```bash
git diff --check origin/master...HEAD
git diff --stat origin/master...HEAD
git status --short
```

Expected: no whitespace errors; only the approved scripts, tests, docs, and `public/chalsakbot.png` are changed; no user submission files or `.superpowers/` files are tracked.
