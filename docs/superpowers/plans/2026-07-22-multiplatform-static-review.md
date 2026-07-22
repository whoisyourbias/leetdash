# Multiplatform Static Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace correctness judging with code-only informational OpenCode reviews, add Programmers and SWEA catalog/submission support, and finish the `opencode-review` required-check setup.

**Architecture:** Keep the existing trusted-base GitHub workflow and exact-head source loading. The reviewer parses only submission path/language/source and validates schema version 2. Separately, migrate catalog and progress identity to `provider:problemId`, then integrate both tracks without adding problem-provider fetchers.

**Tech Stack:** Node.js 20 ESM, TypeScript 5.9, Next.js 16, Vitest 3, GitHub Actions and REST API.

## Global Constraints

- OpenCode configured model remains exactly `opencode-go/kimi-k2.7-code`; API model remains `kimi-k2.7-code`.
- Secret and variable names remain `OPENCODE_API_KEY` and `OPENCODE_REVIEW_MODEL`.
- Check name remains `opencode-review`; marker remains `<!-- leetdash-opencode-review -->`.
- Review input contains only submission path, language, and source code.
- Do not fetch or persist third-party problem statements, examples, templates, judge metadata, cookies, or credentials.
- Every handled review result and handled review failure completes `opencode-review` with `success`; inability to create or complete the authoritative GitHub check remains a workflow failure.
- Sweeper trust rules and exact-head/pre-merge revalidation remain unchanged.
- Canonical problem identity is `problemKey = provider + ":" + problemId`.
- Use test-first RED/GREEN cycles and add only tests needed for the changed contract.

---

### Task 1: Replace the review prompt and result contract

**Files:**
- Modify: `scripts/opencode-review-core.mjs`
- Modify: `tests/opencode-review-core.test.mjs`

**Interfaces:**
- Preserve: `ReviewFailure`, `parseSubmissionSolutionPath(path)`, marker-based Markdown rendering.
- Produce: `buildReviewPrompt({ path, language, source })`.
- Produce: `parseReviewResult(raw, expectedPath)` returning a frozen schema version 2 object.
- Produce: `renderReviewComment({ headSha, results, runUrl })` and `renderReviewWarning({ headSha, failure, runUrl })`.
- Remove: catalog resolution, language-template mapping, LeetCode normalization, schema version 1 verdict validation.

- [ ] **Step 1: Add focused failing core tests**

Replace obsolete problem-context tests with assertions that:

```js
const prompt = buildReviewPrompt({
  path: "submissions/ada/programmers/12906/solution.java",
  language: "java",
  source: "class Solution {}",
});

expect(prompt).toContain("submissions/ada/programmers/12906/solution.java");
expect(prompt).toContain("language: java");
expect(prompt).toContain("class Solution {}");
for (const forbidden of ["problem statement", "judge metadata", "official template", "leetcode_id", "title_slug"]) {
  expect(prompt.toLowerCase()).not.toContain(forbidden);
}
```

Add one valid fixture for each `overall` value and table tests for exact keys, enums, path mismatch, and priority mismatch. The exact result keys are:

```js
[
  "schema_version",
  "path",
  "overall",
  "summary",
  "bug_risks",
  "complexity",
  "readability",
]
```

- [ ] **Step 2: Run the core test and verify RED**

Run: `npm test -- tests/opencode-review-core.test.mjs`

Expected: FAIL because schema version 1 and problem-context prompt behavior still exist.

- [ ] **Step 3: Implement the minimal schema version 2 core**

Use these enum sets:

```js
const overallValues = new Set(["No issue found", "Possible issue", "Improvement"]);
const bugRiskCategories = new Set(["index-range", "overflow", "nullability", "edge-case", "condition"]);
const readabilityCategories = new Set(["naming", "function-split", "duplication", "magic-number"]);
```

Validate exact nested keys:

```js
bug_risks[]: ["category", "location", "reason", "trigger"]
complexity: ["time", "space"]
readability[]: ["category", "location", "suggestion"]
```

Derive expected overall as:

```js
const expectedOverall = result.bug_risks.length > 0
  ? "Possible issue"
  : result.readability.length > 0
    ? "Improvement"
    : "No issue found";
```

The prompt must say that correctness, expected behavior, platform contracts, input limits, and acceptable complexity cannot be inferred. It must request exactly the schema above without Markdown or extra keys.

- [ ] **Step 4: Run the core test and verify GREEN**

Run: `npm test -- tests/opencode-review-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/opencode-review-core.mjs tests/opencode-review-core.test.mjs
git commit -m "feat: make OpenCode reviews informational"
```

---

### Task 2: Remove problem fetching from review orchestration

**Files:**
- Modify: `scripts/opencode-review-clients.mjs`
- Modify: `scripts/opencode-review.mjs`
- Modify: `tests/opencode-review-clients.test.mjs`
- Modify: `tests/opencode-review.test.mjs`

**Interfaces:**
- Preserve: `OpenCodeClient.review({ model, apiKey, prompt })`, `GitHubReviewClient`, exact-head source reads, trusted snapshot validation, check/comment APIs.
- Remove: `LeetCodeClient`, `leetcodeClient`, question caches, problem lookup/normalization.
- Consume Task 1: `buildReviewPrompt({ path, language, source })`, schema version 2 parsing and warning rendering.

- [ ] **Step 1: Add failing orchestration tests**

Update the existing happy path to provide only changed files and source. Assert:

```js
expect(openCodeClient.review).toHaveBeenCalledWith(expect.objectContaining({
  model: "opencode-go/kimi-k2.7-code",
  apiKey: "secret",
  prompt: expect.stringContaining("class Solution"),
}));
expect(githubClient.completeCheck).toHaveBeenCalledWith(expect.objectContaining({ conclusion: "success" }));
```

Add one handled model failure case asserting a warning comment and `conclusion: "success"`. Remove LeetCode request/cache tests rather than replacing them with mocks for deleted behavior.

- [ ] **Step 2: Run orchestration/client tests and verify RED**

Run: `npm test -- tests/opencode-review-clients.test.mjs tests/opencode-review.test.mjs`

Expected: FAIL because orchestration still requires catalog resolution and `LeetCodeClient`.

- [ ] **Step 3: Implement code-only orchestration**

For each active changed solution:

```js
const parsed = parseSubmissionSolutionPath(file.filename);
const source = await readFile(parsed.path);
const prompt = buildReviewPrompt({ path: parsed.path, language: parsed.extension, source });
const raw = await openCodeClient.review({ model, apiKey, prompt });
results.push(redactReviewResult(parseReviewResult(raw, parsed.path), source));
```

Keep `loadTrustedPullRequestScope()` catalog validation unchanged. In the handled review catch, render a warning and set `conclusion = "success"`. Do not swallow failures from `createCheck()` or `completeCheck()`.

- [ ] **Step 4: Run reviewer tests and verify GREEN**

Run: `npm test -- tests/opencode-review-core.test.mjs tests/opencode-review-clients.test.mjs tests/opencode-review.test.mjs tests/opencode-review-workflow.test.ts tests/sweep-submission-prs.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/opencode-review-clients.mjs scripts/opencode-review.mjs tests/opencode-review-clients.test.mjs tests/opencode-review.test.mjs
git commit -m "feat: review submissions without problem context"
```

---

### Task 3: Migrate the catalog to provider-scoped identity

**Files:**
- Modify: `scripts/build-catalog.mjs`
- Modify: `data/problem-catalog.json`
- Modify: `lib/catalog.ts`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Produce: `CatalogProvider`, `CatalogProblem.problemKey`, and maps keyed by `problemKey`.
- Produce: `getProblem(problemKey)` and `getProblemSourceUrl(problemKey)`.
- Preserve optional `slug` only as LeetCode provider metadata.
- List items reference `problemKey` instead of canonical `slug`.

- [ ] **Step 1: Write failing catalog invariants**

Assert every problem satisfies:

```ts
expect(["leetcode", "programmers", "swea"]).toContain(problem.provider);
expect(problem.problemId).toMatch(/^\S+$/);
expect(problem.problemKey).toBe(`${problem.provider}:${problem.problemId}`);
expect(problem.sourceUrl).toMatch(/^https:\/\//);
```

Assert canonical `problemKey` uniqueness, all list references exist, and these entries are present:

```ts
expect(problemByKey.get("programmers:12906")).toMatchObject({
  title: "같은 숫자는 싫어",
  difficulty: "level-1",
});
expect(problemByKey.get("swea:1206")).toMatchObject({
  title: "[S/W 문제해결 기본] 1일차 - View",
  difficulty: "D3",
});
```

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `npm test -- tests/catalog.test.ts`

Expected: FAIL because the catalog uses global slugs and contains only LeetCode lists.

- [ ] **Step 3: Implement provider-aware catalog generation**

Use:

```js
const toProblemKey = (provider, problemId) => `${provider}:${String(problemId)}`;
```

Migrate every existing LeetCode problem to `provider: "leetcode"`, string `problemId`, derived `problemKey`, existing title/difficulty/slug, and `sourceUrl: https://leetcode.com/problems/<slug>/`.

Add one-item `programmers` and `swea` lists using the exact problems and URLs from the design spec. Keep generated JSON deterministic and keep the builder as its source of truth.

- [ ] **Step 4: Generate and test the catalog**

Run:

```bash
npm run catalog:build
npm test -- tests/catalog.test.ts
git diff --exit-code -- data/problem-catalog.json
```

Expected: catalog test PASS and regeneration leaves no diff.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-catalog.mjs data/problem-catalog.json lib/catalog.ts tests/catalog.test.ts
git commit -m "feat: add provider-scoped problem catalog"
```

---

### Task 4: Use problem keys in progress, validation, UI, and docs

**Files:**
- Modify: `scripts/build-progress.mjs`
- Modify: `lib/types.ts`
- Modify: `lib/progress.ts`
- Modify: `app/users/[userId]/page.tsx`
- Modify: `scripts/validate-submission-pr.mjs`
- Modify: `tests/build-progress.test.ts`
- Modify: `tests/progress.test.ts`
- Modify: `tests/validate-submission-pr.test.ts`
- Modify: `README.md`
- Modify: `submissions/README.md`
- Regenerate: `data/progress.json`

**Interfaces:**
- Replace `problemSlug` identity fields with `problemKey` in generated progress and activity data.
- Resolve list items through Task 3 `problemKey` references.
- Link UI actions to `problem.sourceUrl` and label providers as `LeetCode`, `Programmers`, or `SWEA`.
- Continue validating submission membership by `sourceKey/submissionKey`.

- [ ] **Step 1: Add minimal failing progress and validator tests**

Add fixtures containing `leetcode:1`, `programmers:1`, and `swea:1` and assert they produce three distinct progress entries. Add accepted changed paths:

```text
submissions/ada/programmers/12906/solution.java
submissions/ada/swea/1206/solution.py
```

Keep one unknown provider/list rejection assertion.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/build-progress.test.ts tests/progress.test.ts tests/validate-submission-pr.test.ts`

Expected: FAIL because progress and activity still use `problemSlug` and fixtures lack the new lists.

- [ ] **Step 3: Implement problem-key flow and provider links**

Use `problemKey` for submission IDs, maps, deduplication, activity records, recent submissions, and first-unsolved targeting. Do not derive source URLs in UI; use `item.problem.sourceUrl`.

Document the exact new paths and clarify that catalog changes merge before submission-only PRs. Do not document problem scraping or provider-specific review semantics.

- [ ] **Step 4: Regenerate progress and run focused tests**

Run:

```bash
npm run progress:build
npm test -- tests/build-progress.test.ts tests/progress.test.ts tests/validate-submission-pr.test.ts tests/dashboard-users.test.ts tests/activity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-progress.mjs lib/types.ts lib/progress.ts app/users/[userId]/page.tsx scripts/validate-submission-pr.mjs tests/build-progress.test.ts tests/progress.test.ts tests/validate-submission-pr.test.ts README.md submissions/README.md data/progress.json
git commit -m "feat: support Programmers and SWEA submissions"
```

---

### Task 5: Integrate, verify, and finish repository settings

**Files:**
- Review only: `.github/workflows/opencode-review.yml`
- Review only: `.github/workflows/sweep-submission-prs.yml`
- Review only: `.env.example`
- Operational setting: GitHub branch protection for `master`

- [ ] **Step 1: Verify no stale problem-fetch behavior remains**

Run:

```bash
rg -n "LeetCodeClient|getQuestion|normalizeQuestionData|leetcode_id|title_slug|schema_version[^\n]*1|blocking_findings|correctness\.status" scripts tests/opencode-review*.test.*
```

Expected: no production reviewer matches; historical docs are outside this search.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run catalog:build
git diff --exit-code -- data/problem-catalog.json
EXPECTED_GENERATED_AT=$(git show HEAD:data/progress.json | jq -r '.generatedAt')
npm run progress:build
jq 'walk(if type == "object" then del(.generatedAt) else . end)' data/progress.json > /tmp/progress-actual.json
git show HEAD:data/progress.json | jq 'walk(if type == "object" then del(.generatedAt) else . end)' > /tmp/progress-expected.json
diff -u /tmp/progress-expected.json /tmp/progress-actual.json
npm run build
ACTUAL_GENERATED_AT=$(jq -r '.generatedAt' data/progress.json)
ACTUAL_GENERATED_AT="$ACTUAL_GENERATED_AT" EXPECTED_GENERATED_AT="$EXPECTED_GENERATED_AT" \
  perl -pi -e 's/\Q$ENV{ACTUAL_GENERATED_AT}\E/$ENV{EXPECTED_GENERATED_AT}/g' data/progress.json
git diff --exit-code -- data/progress.json
git diff --check
```

Expected: all commands exit 0. `data/progress.json` timestamps may change during generation; the commands restore only those generated timestamps after the build and verify that all other content matches the committed file.

- [ ] **Step 3: Configure branch protection**

Read the current protection document, preserve its existing review/admin/strict settings, and update required status checks so the resulting contexts are exactly `validate` and `opencode-review`. Do not replace unrelated branch-protection fields.

Verify with:

```bash
gh api repos/whoisyourbias/leetdash/branches/master/protection/required_status_checks \
  --jq '{strict, contexts, checks}'
```

Expected: both contexts are present and `validate` remains associated with GitHub Actions where GitHub supplies app identity.

- [ ] **Step 4: Commit any final integration-only fixes**

```bash
git status --short
git add -u
git commit -m "fix: integrate multiplatform static reviews"
```

Skip this commit when there are no integration fixes.
