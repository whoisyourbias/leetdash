# OpenCode Review Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `kimi-k2.7-code` reviews up to 180 seconds per request while retaining the 60-second LeetCode deadline and bounding the review job at 45 minutes.

**Architecture:** Split the shared external-request timeout into service-specific constants. Keep the OpenCode deadline spanning fetch and response-body parsing, and add an outer GitHub Actions job timeout without changing retry or failure behavior.

**Tech Stack:** Node.js, JavaScript ES modules, GitHub Actions YAML, Vitest

## Global Constraints

- LeetCode requests remain limited to exactly `60_000` milliseconds.
- OpenCode fetch and successful-response body parsing share one deadline of exactly `180_000` milliseconds.
- The trusted `review` job uses exactly `timeout-minutes: 45`.
- Do not add retries, parallelize reviews, change provider payloads, or alter failure rendering.

---

### Task 1: Extend only the OpenCode review deadline

**Files:**
- Modify: `tests/opencode-review-clients.test.mjs:114-155`
- Modify: `tests/opencode-review-workflow.test.ts:28-40`
- Modify: `scripts/opencode-review-clients.mjs:3-9,84-86,151-163`
- Modify: `.github/workflows/opencode-review.yml:16-24`

**Interfaces:**
- Consumes: `LeetCodeClient.getQuestion(titleSlug)` and `OpenCodeClient.review({ model, apiKey, prompt })`
- Produces: unchanged client results and failures, with service-specific deadlines
- Produces: a trusted review job canceled by GitHub after 45 minutes

- [x] **Step 1: Write failing timeout tests**

In the OpenCode response-body timeout test, replace the 60-second timer advance with:

```js
await vi.advanceTimersByTimeAsync(179_999);
expect(requestSignal.aborted).toBe(false);
expect(vi.getTimerCount()).toBe(1);
await vi.advanceTimersByTimeAsync(1);
const failure = await failurePromise;
```

In the workflow permissions/configuration test, add:

```ts
expect(workflow).toContain("review:\n    timeout-minutes: 45");
```

- [x] **Step 2: Run focused tests to verify RED**

Run: `npm.cmd test -- tests/opencode-review-clients.test.mjs tests/opencode-review-workflow.test.ts`

Expected: two failures. The OpenCode signal aborts before 180 seconds, and the workflow lacks `timeout-minutes: 45`.

- [x] **Step 3: Split the service deadlines**

Replace the shared constant with:

```js
const leetCodeRequestTimeoutMs = 60_000;
const openCodeRequestTimeoutMs = 180_000;
```

Use `leetCodeRequestTimeoutMs` in `LeetCodeClient.fetchQuestion` and `openCodeRequestTimeoutMs` in `OpenCodeClient.review`.

- [x] **Step 4: Add the workflow job guard**

Change the review job header to:

```yaml
jobs:
  review:
    timeout-minutes: 45
    if: >-
```

- [x] **Step 5: Run focused tests to verify GREEN**

Run: `npm.cmd test -- tests/opencode-review-clients.test.mjs tests/opencode-review-workflow.test.ts`

Expected: PASS, 2 test files and 26 tests passed.

- [x] **Step 6: Run the complete test suite**

Run: `npm.cmd test`

Expected: PASS, 18 test files and 206 tests passed.

- [x] **Step 7: Inspect and commit the final diff**

Run: `git diff --check`

Expected: no output and exit code 0.

```bash
git add docs/superpowers/plans/2026-07-22-opencode-review-timeout.md tests/opencode-review-clients.test.mjs tests/opencode-review-workflow.test.ts scripts/opencode-review-clients.mjs .github/workflows/opencode-review.yml
git commit -m "fix: extend OpenCode review timeout"
```
