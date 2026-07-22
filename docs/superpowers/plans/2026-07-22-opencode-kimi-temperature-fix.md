# OpenCode Kimi Temperature Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop OpenCode Go from rejecting `kimi-k2.7-code` review requests by omitting the unsupported temperature override.

**Architecture:** Preserve the existing `OpenCodeClient` interface and request flow. Change only the serialized request body and its exact-shape regression test so the provider supplies the model's fixed sampling defaults.

**Tech Stack:** Node.js, JavaScript ES modules, Vitest

## Global Constraints

- Keep `https://opencode.ai/zen/go/v1/chat/completions` unchanged.
- Keep configured model `opencode-go/kimi-k2.7-code` and API model `kimi-k2.7-code` unchanged.
- Do not expose provider response bodies or alter retry, timeout, or validation behavior.
- Do not add model-specific sampling configuration.

---

### Task 1: Omit the Kimi temperature override

**Files:**
- Modify: `tests/opencode-review-clients.test.mjs:90-113`
- Modify: `scripts/opencode-review-clients.mjs:166-178`

**Interfaces:**
- Consumes: `OpenCodeClient.review({ model, apiKey, prompt })`
- Produces: the same assistant-content string result, with a request body containing only `model` and `messages`

- [x] **Step 1: Write the failing request-shape test**

Change the exact request-body expectation to:

```js
expect(JSON.parse(requests[0].init.body)).toEqual({
  model: "kimi-k2.7-code",
  messages: [{ role: "user", content: "review prompt" }],
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- tests/opencode-review-clients.test.mjs`

Expected: FAIL in `sends the provider-stripped model request and returns only assistant content` because the received body still has `temperature: 0`.

- [x] **Step 3: Remove the unsupported request property**

Change the request body construction to:

```js
body: JSON.stringify({
  model: openCodeApiModel,
  messages: [{ role: "user", content: prompt }],
}),
```

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npm.cmd test -- tests/opencode-review-clients.test.mjs`

Expected: PASS, 23 tests passed.

- [x] **Step 5: Run the complete test suite**

Run: `npm.cmd test`

Expected: PASS, 18 test files and 206 tests passed.

- [x] **Step 6: Inspect the final diff and commit**

Run: `git diff --check`

Expected: no output and exit code 0.

```bash
git add docs/superpowers/plans/2026-07-22-opencode-kimi-temperature-fix.md tests/opencode-review-clients.test.mjs scripts/opencode-review-clients.mjs
git commit -m "fix: omit Kimi temperature override"
```
