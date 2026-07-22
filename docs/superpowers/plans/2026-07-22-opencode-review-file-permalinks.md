# OpenCode Review File Permalinks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every newly written Chalsakbot file review or warning link its displayed source path to the complete file in the PR head repository at the exact reviewed commit.

**Architecture:** Add one pure, validated permalink builder to the review core and pass its output into the existing file-comment renderers. Carry the already trusted PR head repository and configured GitHub server URL through the orchestrator; leave managed-comment discovery, content-digest reuse, model prompts, and summary rendering unchanged.

**Tech Stack:** Node.js ES modules, GitHub REST API conventions, Markdown, Vitest.

## Global Constraints

- Use the validated pull-request head repository so fork pull requests resolve correctly.
- Generate links as `<github-server>/<head-owner>/<head-repository>/blob/<head-sha>/<encoded-path>`.
- Accept only credential-free HTTPS server URLs, one `owner/repository` pair, hexadecimal 7–64 character SHAs, and safe repository-relative paths.
- Encode each path segment independently and preserve `/` separators.
- Do not create inline diff comments, alter model prompts, rewrite reused comments, or add links to summary comments.
- Route invalid permalink inputs through the existing sanitized review-failure behavior.

---

### Task 1: Build and render validated source permalinks

**Files:**
- Modify: `tests/opencode-review-core.test.mjs`
- Modify: `scripts/opencode-review-core.mjs`

**Interfaces:**
- Produces: `buildSourcePermalink({ serverUrl, repository, headSha, path }): string`.
- Changes: `renderReviewFileComment({ ..., sourceUrl, ... })` and `renderReviewFileWarning({ ..., sourceUrl, ... })` render `파일: [<path>](<sourceUrl>)`.

- [ ] **Step 1: Write failing permalink-builder tests**

Import `buildSourcePermalink` in `tests/opencode-review-core.test.mjs` and add cases equivalent to:

```js
expect(buildSourcePermalink({
  serverUrl: "https://github.example/",
  repository: "fork-user/leetdash",
  headSha: "a".repeat(40),
  path: "submissions/ada/problem set/1/solution #1.java",
})).toBe(
  `https://github.example/fork-user/leetdash/blob/${"a".repeat(40)}/submissions/ada/problem%20set/1/solution%20%231.java`,
);

for (const invalid of [
  { serverUrl: "http://github.example" },
  { serverUrl: "https://user:pass@github.example" },
  { repository: "owner/repo/extra" },
  { headSha: "head-sha" },
  { path: "../solution.java" },
  { path: "folder//solution.java" },
  { path: "folder\\solution.java" },
]) {
  expect(() => buildSourcePermalink({
    serverUrl: "https://github.example",
    repository: "fork-user/leetdash",
    headSha: "a".repeat(40),
    path: "submissions/ada/1/solution.java",
    ...invalid,
  })).toThrow(ReviewFailure);
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/opencode-review-core.test.mjs`

Expected: FAIL because `buildSourcePermalink` is not exported.

- [ ] **Step 3: Implement the minimal validated builder**

Add a pure helper in `scripts/opencode-review-core.mjs` that parses `serverUrl`, verifies HTTPS/no credentials, validates `repository`, `headSha`, and every path segment, and returns:

```js
`${originAndPrefix}/${repository}/blob/${encodeURIComponent(headSha)}/${segments.map(encodeURIComponent).join("/")}`
```

Throw a `ReviewFailure` with a fixed safe detail such as `Review source link configuration is invalid.` and the existing configuration-stage reason when validation fails. Export the helper.

- [ ] **Step 4: Write failing renderer tests**

Update/add renderer assertions in `tests/opencode-review-core.test.mjs`:

```js
expect(renderReviewFileComment({
  path: "submissions/ada/top-interview-easy/1/solution.java",
  sourceUrl: `https://github.example/fork-user/leetdash/blob/${"a".repeat(40)}/submissions/ada/top-interview-easy/1/solution.java`,
  contentKey: "b".repeat(64),
  headSha: "a".repeat(40),
  runUrl: "https://github.example/actions/runs/9",
  mascotUrl,
  markdown: "#### 요약\n확인 완료",
})).toContain("파일: [submissions/ada/top-interview-easy/1/solution.java](https://github.example/");
```

Add the same expectation for `renderReviewFileWarning`.

- [ ] **Step 5: Run the focused tests and verify RED**

Run: `npm test -- tests/opencode-review-core.test.mjs`

Expected: FAIL because the renderers still emit a plain path.

- [ ] **Step 6: Render the supplied safe source URL**

Add `sourceUrl` to both renderer argument objects and replace their file metadata line with:

```js
`파일: [${markdownText(path)}](${markdownText(sourceUrl)})`
```

- [ ] **Step 7: Run the focused tests and verify GREEN**

Run: `npm test -- tests/opencode-review-core.test.mjs`

Expected: all tests in the file pass with zero failures.

- [ ] **Step 8: Commit the core behavior**

```bash
git add scripts/opencode-review-core.mjs tests/opencode-review-core.test.mjs
git commit -m "feat: render commit-pinned review links"
```

### Task 2: Propagate the trusted head repository into file comments

**Files:**
- Modify: `tests/opencode-review.test.mjs`
- Modify: `scripts/opencode-review.mjs`

**Interfaces:**
- Consumes: `buildSourcePermalink({ serverUrl, repository, headSha, path }): string` from Task 1.
- Changes: `reviewPullRequest` accepts `serverUrl` and `headRepository`; `main` supplies `env.GITHUB_SERVER_URL` and the validated scope's `headRepository`.

- [ ] **Step 1: Write failing orchestrator tests**

Set defaults in the test `reviewOptions` helper:

```js
serverUrl: "https://github.example",
headRepository: "fork-user/leetdash",
headSha: "a".repeat(40),
```

Replace direct `reviewPullRequest` fixtures that use non-hex values such as `head-sha-123` with `"a".repeat(40)`, because permalink construction intentionally accepts only real Git commit identifiers. Leave tests that exercise unrelated CLI argument forwarding unchanged unless they render a file comment.

Assert a newly reviewed file comment contains:

```js
expect(comments[0].body).toContain(
  `https://github.example/fork-user/leetdash/blob/${"a".repeat(40)}/${firstPath}`,
);
```

Add the same assertion to the warning-comment test. Keep the reuse test assertion that only the summary comment is mutated, proving cached file comments are not rewritten.

- [ ] **Step 2: Run the orchestrator tests and verify RED**

Run: `npm test -- tests/opencode-review.test.mjs`

Expected: FAIL because `reviewPullRequest` does not build or pass a source URL.

- [ ] **Step 3: Build links inside the per-file loop**

Import `buildSourcePermalink`, accept `serverUrl` and `headRepository` in `reviewPullRequest`, and before rendering a non-reused result compute:

```js
const sourceUrl = buildSourcePermalink({
  serverUrl,
  repository: headRepository,
  headSha,
  path: result.path,
});
```

Pass `sourceUrl` to either file renderer. If link construction fails, convert that file result to the existing sanitized warning path so later files continue to run and the overall informational check behavior remains unchanged.

- [ ] **Step 4: Pass trusted CLI values into the orchestrator**

In `main`, pass:

```js
serverUrl: env.GITHUB_SERVER_URL,
headRepository: trustedHeadRepository,
```

Preserve the existing wrapper that assigns `trustedHeadRepository = scope.headRepository` before returning the validated scope.

- [ ] **Step 5: Run the orchestrator tests and verify GREEN**

Run: `npm test -- tests/opencode-review.test.mjs`

Expected: all tests in the file pass with zero failures, including the fork source-read test and unchanged-comment reuse test.

- [ ] **Step 6: Commit orchestration**

```bash
git add scripts/opencode-review.mjs tests/opencode-review.test.mjs
git commit -m "feat: link reviews to fork source files"
```

### Task 3: Document and fully verify the behavior

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: completed permalink behavior from Tasks 1–2.
- Produces: user-facing documentation and fresh full-suite verification evidence.

- [ ] **Step 1: Update the review workflow documentation**

Extend the README review paragraph with this exact behavior:

```text
각 파일 리뷰의 파일 경로는 리뷰한 head 커밋의 전체 소스 파일로 연결됩니다.
```

- [ ] **Step 2: Run formatting/diff checks**

Run: `git diff --check`

Expected: exit code 0 with no output.

- [ ] **Step 3: Run all automated tests**

Run: `npm test`

Expected: exit code 0 and zero failed tests.

- [ ] **Step 4: Run the type checker**

Run: `npm run typecheck`

Expected: exit code 0 and no TypeScript errors.

- [ ] **Step 5: Run the production build**

Run: `npm run build`

Expected: exit code 0 and a successful Next.js static export.

- [ ] **Step 6: Review the final diff against the design**

Run: `git diff HEAD~2 -- README.md scripts/opencode-review-core.mjs scripts/opencode-review.mjs tests/opencode-review-core.test.mjs tests/opencode-review.test.mjs`

Expected: only permalink construction, propagation, rendering, tests, and the matching README sentence are present.

- [ ] **Step 7: Commit documentation**

```bash
git add README.md
git commit -m "docs: explain review source links"
```
