# OpenCode Response Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report the exact schema field and a fixed failure class for invalid OpenCode responses without exposing response values.

**Architecture:** Keep `ReviewFailure`, its stage/reason, and all rendering unchanged. Pass code-owned `field` and `issue` labels from each assertion to `modelResponseFailure`, and append those labels to the existing sanitized detail.

**Tech Stack:** Node.js ESM, Vitest

## Global Constraints

- Never include model-generated values, unexpected key names, raw JSON, prompts, source code, or response-derived array indexes in diagnostics.
- Keep stage `model-response`, reason `MODEL_RESPONSE_INVALID`, and `retryable: false` unchanged.
- Modify only `scripts/opencode-review-core.mjs` and `tests/opencode-review-core.test.mjs`.

---

### Task 1: Add sanitized schema-field diagnostics

**Files:**
- Modify: `tests/opencode-review-core.test.mjs`
- Modify: `scripts/opencode-review-core.mjs`

**Interfaces:**
- Consumes: `parseReviewResult(raw: string, expectedPath: string)` and the existing `ReviewFailure` contract.
- Produces: `ReviewFailure.detail` ending with `Diagnostic: field=<fixed-schema-path>; issue=<fixed-class>.`

- [ ] **Step 1: Write failing parser diagnostics tests**

Add a table-driven test covering these fixed expectations:

```js
it.each([
  ["invalid JSON", () => "not json", "field=response; issue=json-parse"],
  ["top-level shape", () => JSON.stringify({ ...passResult, unexpected: "model-secret" }), "field=response; issue=object-shape"],
  ["boolean type", () => JSON.stringify({ ...passResult, complexity: { ...passResult.complexity, acceptable: "yes" } }), "field=complexity.acceptable; issue=boolean"],
  ["blocking category", () => JSON.stringify({ ...failResult, blocking_findings: [{ ...failResult.blocking_findings[0], category: "model-secret" }] }), "field=blocking_findings[].category; issue=enum"],
])("reports a sanitized diagnostic for %s", (_name, raw, diagnostic) => {
  try {
    parseReviewResult(raw(), reviewPath);
    throw new Error("expected parsing to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ReviewFailure);
    expect(error.detail).toContain(diagnostic);
    expect(error.detail).not.toContain("model-secret");
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: the new diagnostic test fails because the current detail contains no `field` or `issue` suffix.

- [ ] **Step 3: Implement fixed-label diagnostics**

Change the failure factory to accept only labels supplied by validation code:

```js
function modelResponseFailure(field, issue) {
  return new ReviewFailure({
    stage: "model-response",
    reason: "MODEL_RESPONSE_INVALID",
    detail: `${modelResponseDetail} Diagnostic: field=${field}; issue=${issue}.`,
  });
}
```

Update assertion helpers to require a fixed schema path and pass fixed issue labels:

```js
function assertExactKeys(value, keys, field) {
  if (!isObject(value)) throw modelResponseFailure(field, "object");
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) {
    throw modelResponseFailure(field, "object-shape");
  }
}

function assertString(value, field) {
  if (!hasText(value)) throw modelResponseFailure(field, "non-empty-string");
}

function assertEnum(value, allowed, field) {
  if (!allowed.has(value)) throw modelResponseFailure(field, "enum");
}

function assertArray(value, validator, field) {
  if (!Array.isArray(value)) throw modelResponseFailure(field, "array");
  value.forEach(validator);
}
```

Use fixed field paths at every call site, including `response`, `schema_version`, `correctness.status`, `complexity.acceptable`, `blocking_findings[]...`, and `non_blocking_suggestions[]...`. Classify JSON parsing as `json-parse`, booleans as `boolean`, nullable strings as `string-or-null`, and partially populated counterexamples as `all-null-or-all-text`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: all tests in the file pass, including the new diagnostics and existing content-redaction test.

- [ ] **Step 5: Run full verification**

Run: `npm.cmd test`

Expected: all test files pass with zero failures.

Run: `git diff --check`

Expected: exit code 0 with no output.

- [ ] **Step 6: Commit the implementation**

```powershell
git add scripts/opencode-review-core.mjs tests/opencode-review-core.test.mjs docs/superpowers/plans/2026-07-22-opencode-response-diagnostics.md
git commit -m "fix: classify OpenCode response schema failures"
```
