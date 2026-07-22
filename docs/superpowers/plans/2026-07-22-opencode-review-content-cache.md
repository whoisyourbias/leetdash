# OpenCode Review Content Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip OpenCode calls for unchanged files that already have a successful managed review with the same source-content SHA-256.

**Architecture:** Keep the existing path marker as comment identity and add a second hidden content-digest marker only to successful file comments. During the sequential loop, read trusted source, compute its digest, and return a `reused` result before the model request when the discovered comment matches. Warnings omit the digest and therefore retry.

**Tech Stack:** Node.js 20 ESM, `node:crypto`, GitHub REST issue comments, Vitest 3.

## Global Constraints

- Keep the existing path marker unchanged.
- Hash the exact UTF-8 source returned by the trusted GitHub contents API.
- Only successful reviews emit a content marker.
- Matching reviews neither call OpenCode nor rewrite their file comment.
- Legacy comments, malformed metadata, warnings, and changed content are cache misses.
- Preserve sequential delivery, informational failures, stale cleanup, workflow triggers, and permissions.

---

## File Structure

- Modify `scripts/opencode-review-core.mjs`: content helpers, marker parsing, successful rendering, and reused summary count.
- Modify `scripts/opencode-review.mjs`: digest comparison and `reused` orchestration result.
- Modify `tests/opencode-review-core.test.mjs`: content metadata and rendering contract.
- Modify `tests/opencode-review-clients.test.mjs`: parsed content metadata propagation.
- Modify `tests/opencode-review.test.mjs`: cache-hit and cache-miss orchestration.
- Modify `README.md`: explain unchanged-review reuse.

### Task 1: Content Digest Metadata Contract

**Files:**
- Modify: `scripts/opencode-review-core.mjs`
- Test: `tests/opencode-review-core.test.mjs`
- Test: `tests/opencode-review-clients.test.mjs`

**Interfaces:**
- Produces: `reviewContentKey(source: unknown): string`
- Produces: `reviewContentMarker(contentKey: string): string`
- Changes: `parseManagedReviewMarker(body)` returns `{ kind: "file", key, contentKey? }`.
- Changes: `renderReviewFileComment({ ..., contentKey })` emits both markers.
- Changes: `renderReviewSummary({ ..., reusedCount })` emits `리뷰 유지: N개`.

- [ ] **Step 1: Write failing core metadata tests**

```js
const contentKey = reviewContentKey("class Solution { int value = 1; }");
expect(contentKey).toMatch(/^[a-f0-9]{64}$/);
expect(reviewContentKey("one")).not.toBe(reviewContentKey("two"));
expect(parseManagedReviewMarker(`${reviewFileMarker(reviewPath)}\n${reviewContentMarker(contentKey)}\nbody`)).toEqual({
  kind: "file",
  key: reviewFileKey(reviewPath),
  contentKey,
});
expect(parseManagedReviewMarker(`${reviewFileMarker(reviewPath)}\nbody`)).toEqual({
  kind: "file",
  key: reviewFileKey(reviewPath),
});
```

Require successful rendering to contain the content marker, warning rendering to omit it, and summary rendering with `reusedCount: 1` to contain `리뷰 유지: 1개`.

- [ ] **Step 2: Write the failing client propagation test**

Give the managed GitHub Actions file fixture both markers and expect `listManagedReviewComments()` to return `{ id, kind: "file", key, contentKey }`. Keep the spoofed user comment excluded.

- [ ] **Step 3: Run tests and verify RED**

Run: `npx vitest run tests/opencode-review-core.test.mjs tests/opencode-review-clients.test.mjs`

Expected: FAIL because content helpers are missing and content metadata is neither parsed nor rendered.

- [ ] **Step 4: Implement content helpers and exact second-line parsing**

```js
const reviewContentMarkerPattern = /^<!-- leetdash-opencode-review-content:([a-f0-9]{64}) -->$/;

function reviewContentKey(source) {
  return createHash("sha256").update(String(source), "utf8").digest("hex");
}

function reviewContentMarker(contentKey) {
  if (!/^[a-f0-9]{64}$/.test(contentKey)) throw new TypeError("Invalid review content key.");
  return `<!-- leetdash-opencode-review-content:${contentKey} -->`;
}
```

Inspect only the line immediately after a valid leading path marker. Do not scan later model Markdown for cache metadata.

- [ ] **Step 5: Update renderers and exports**

Insert `reviewContentMarker(contentKey)` directly after `reviewFileMarker(path)` in successful comments. Add `` `리뷰 유지: ${reusedCount}개` `` between completed and warning counts. Export both content helpers.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npx vitest run tests/opencode-review-core.test.mjs tests/opencode-review-clients.test.mjs`

Expected: both files pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/opencode-review-core.mjs tests/opencode-review-core.test.mjs tests/opencode-review-clients.test.mjs
git commit -m "feat: encode successful review content digests"
```

### Task 2: Reuse Unchanged Successful Reviews

**Files:**
- Modify: `scripts/opencode-review.mjs`
- Test: `tests/opencode-review.test.mjs`

**Interfaces:**
- Consumes: `reviewContentKey(source)` and discovered `{ contentKey? }` metadata.
- Changes: `reviewOneFile({ ..., cachedContentKey })` can return `{ path, status: "reused", contentKey }`.
- Changes: successful `reviewed` results include `contentKey` for rendering.

- [ ] **Step 1: Write the failing unchanged-file test**

Create an existing managed file comment whose path and content keys match. Assert trusted source is read once, OpenCode is not called, no file-comment mutation occurs, the result is `reused`, and the summary contains `리뷰 유지: 1개`.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/opencode-review.test.mjs -t "reuses an unchanged successful file review"`

Expected: FAIL because OpenCode is called and status is `reviewed`.

- [ ] **Step 3: Implement the minimal reuse path**

After trusted source retrieval and before prompt construction:

```js
const contentKey = reviewContentKey(source);
if (cachedContentKey === contentKey) {
  return { path: filePath, status: "reused", contentKey };
}
```

Pass the existing comment's `contentKey` into `reviewOneFile()`. Upsert only `reviewed` and `warning` results. Pass `contentKey` into successful rendering.

- [ ] **Step 4: Count reused results**

```js
const reusedCount = results.filter(({ status }) => status === "reused").length;
```

Pass `reusedCount` into the normal and delivery-failure summary render paths.

- [ ] **Step 5: Run the reuse test and verify GREEN**

Run: `npx vitest run tests/opencode-review.test.mjs -t "reuses an unchanged successful file review"`

Expected: PASS.

- [ ] **Step 6: Add cache-miss and mixed-result tests**

Add behavioral tests proving a changed digest updates the same comment ID, a legacy comment retries, a prior warning retries, and two files can produce one `reused` plus one `reviewed` result without rewriting the reused file comment.

- [ ] **Step 7: Run orchestration tests and complete missing handling**

Run: `npx vitest run tests/opencode-review.test.mjs`

Expected: all tests pass. Comment-discovery failure must continue reviewing with no cache input and no comment mutations. Stale cleanup remains path-based.

- [ ] **Step 8: Commit**

```bash
git add scripts/opencode-review.mjs tests/opencode-review.test.mjs
git commit -m "feat: reuse unchanged OpenCode file reviews"
```

### Task 3: Documentation, Verification, and PR Update

**Files:**
- Modify: `README.md`
- Verify: `.github/workflows/opencode-review.yml`
- Verify: `.github/workflows/sweep-submission-prs.yml`

**Interfaces:**
- Consumes all changes from Tasks 1 and 2.
- Produces a verified update to PR #47.

- [ ] **Step 1: Update README behavior text**

Add one factual sentence: unchanged files with matching successful content digests reuse the existing review; changed files and warning results are reviewed again.

- [ ] **Step 2: Run the focused suite**

Run: `npx vitest run tests/opencode-review-core.test.mjs tests/opencode-review-clients.test.mjs tests/opencode-review.test.mjs tests/opencode-review-workflow.test.ts tests/sweep-workflow.test.ts`

Expected: all focused tests pass.

- [ ] **Step 3: Run complete verification**

Run `npm test`, `npm run typecheck`, and `npm run build`.

Expected: all exit 0. Restore only `data/progress.json` if the build rewrites that generated file without intentional submission changes.

- [ ] **Step 4: Verify invariants**

Run `git diff --exit-code origin/master -- .github/workflows`, `git diff --check origin/master...HEAD`, and `git status --short`.

Expected: workflows remain unchanged, diff check is clean, and only intentional changes remain.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md
git commit -m "docs: explain unchanged OpenCode review reuse"
```

- [ ] **Step 6: Push and inspect PR #47**

Run `git push`, `gh pr view 47 --json url,state,headRefName,baseRefName`, and `gh pr checks 47`.

Expected: PR #47 remains open with matching local and remote heads and fresh checks visible.
