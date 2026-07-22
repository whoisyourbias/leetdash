# OpenCode Submission Review Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed OpenCode Go review check and managed PR comment for every changed LeetCode solution, then require that check in the submission sweeper.

**Architecture:** Keep deterministic path, catalog, problem, prompt, result, and Markdown contracts in `opencode-review-core.mjs`; isolate HTTP clients and sanitization in `opencode-review-clients.mjs`; and put trusted GitHub-data/check/comment orchestration in `opencode-review.mjs`. A separate default-branch `workflow_run` workflow checks out the verified PR base SHA without credentials, derives applicability through GitHub REST, and treats exact-head solution content only as data. The sweeper requires the newest authoritative runs for both current-head checks and revalidates them immediately before merge.

**Tech Stack:** Node.js 20 ESM, native `fetch`, Vitest 3, GitHub Actions, GitHub REST Checks/Issues APIs, LeetCode GraphQL, OpenCode Go OpenAI-compatible chat completions.

## Global Constraints

- Configuration model is exactly `opencode-go/kimi-k2.7-code`; API model is exactly `kimi-k2.7-code`.
- OpenCode endpoint is exactly `https://opencode.ai/zen/go/v1/chat/completions`.
- Repository secret is `OPENCODE_API_KEY`; repository variable is `OPENCODE_REVIEW_MODEL`.
- Required check is `opencode-review`; managed comment marker is `<!-- leetdash-opencode-review -->`.
- Only correctness, compile, runtime, termination, platform-contract, and constraint-breaking complexity findings block merging.
- Review failures use only the six stages and six reason codes in the approved design spec.
- No API key, Authorization header, environment dump, raw external response, complete raw model output, or unnecessary submitted source may appear in logs, comments, checks, or summaries.
- LeetCode problem content is kept only in workflow memory and never written to the repository, cache, artifact, or summary.
- TDD is mandatory: each production change follows a test that was run and observed failing for the expected missing behavior.
- Preserve the user's original `myunghwan` checkout and its untracked submission directory.

---

## File Structure

- Create `scripts/opencode-review-core.mjs`: pure parsing, normalization, prompt, result validation, and Markdown rendering.
- Create `scripts/opencode-review-clients.mjs`: LeetCode, OpenCode, and GitHub REST clients with safe failure conversion.
- Create `scripts/opencode-review.mjs`: pull-request review lifecycle and CLI.
- Create `tests/opencode-review-core.test.mjs`: deterministic contract tests.
- Create `tests/opencode-review-clients.test.mjs`: HTTP, cache, redaction, and API request tests.
- Create `tests/opencode-review.test.mjs`: orchestration, comment replacement, fallback, and check lifecycle tests.
- Modify `scripts/validate-submission-pr.mjs`: export the solution-artifact predicate needed by the reviewer.
- Modify `.github/workflows/deploy-pages.yml`: keep PR validation but remove the secret-bearing review lifecycle.
- Create `.github/workflows/opencode-review.yml`: run trusted base code after completed successful PR validation workflows.
- Modify `tests/deploy-workflow.test.ts` and create `tests/opencode-review-workflow.test.ts`: assert review isolation and the trusted workflow contract.
- Modify `scripts/sweep-submission-prs.mjs`: require a list of successful checks.
- Modify `tests/sweep-submission-prs.test.mjs`: cover multiple required checks.
- Modify `.github/workflows/sweep-submission-prs.yml`: configure both checks.
- Modify `tests/sweep-workflow.test.ts`: assert both checks are configured.
- Modify `.env.example`: document the two OpenCode settings without a secret value.

---

### Task 1: Resolve submissions and normalize live problem data

**Files:**
- Create: `scripts/opencode-review-core.mjs`
- Create: `tests/opencode-review-core.test.mjs`

**Interfaces:**
- Produces: `ReviewFailure`, `parseSubmissionSolutionPath(path)`, `resolveCatalogProblem(path, catalog)`, `getLeetCodeLangSlug(extension)`, `normalizeQuestionData(rawQuestion, extension)`.
- `ReviewFailure` fields: `stage`, `reason`, `detail`, `retryable`, optional `httpStatus`, optional `requestId`.
- `resolveCatalogProblem` returns `{ path, user, sourceKey, submissionKey, filename, extension, slug, problem }`.
- `normalizeQuestionData` returns `{ content, exampleTestcases, metadata, codeTemplate, topicTags }`.

- [ ] **Step 1: Write failing path and catalog tests**

Create `tests/opencode-review-core.test.mjs` with fixtures whose catalog has a `top-interview-easy/1 -> two-sum` item and canonical problem. Assert:

```js
import { describe, expect, it } from "vitest";

import {
  ReviewFailure,
  getLeetCodeLangSlug,
  normalizeQuestionData,
  parseSubmissionSolutionPath,
  resolveCatalogProblem,
} from "../scripts/opencode-review-core.mjs";

const catalog = {
  lists: [{ key: "top-interview-easy", items: [{ submissionKey: "1", slug: "two-sum" }] }],
  problems: [{ leetcodeId: 1, slug: "two-sum", title: "Two Sum", difficulty: "easy" }],
};

describe("submission problem resolution", () => {
  it("resolves a solution path through list item and canonical problem", () => {
    expect(resolveCatalogProblem("submissions/ada/top-interview-easy/1/Solution.java", catalog)).toMatchObject({
      user: "ada",
      sourceKey: "top-interview-easy",
      submissionKey: "1",
      extension: "java",
      slug: "two-sum",
      problem: catalog.problems[0],
    });
  });

  it.each([
    ["submissions/ada/top-interview-easy/1/meta.json", "CATALOG_MAPPING_FAILED"],
    ["submissions/ada/missing/1/Solution.java", "CATALOG_MAPPING_FAILED"],
    ["submissions/ada/top-interview-easy/2/Solution.java", "CATALOG_MAPPING_FAILED"],
  ])("fails closed for %s", (path, reason) => {
    expect(() => resolveCatalogProblem(path, catalog)).toThrowError(
      expect.objectContaining({ stage: "catalog-resolve", reason }),
    );
  });

  it("parses only the canonical five-segment solution path", () => {
    expect(parseSubmissionSolutionPath("submissions/ada/top-interview-easy/1/Solution.java")).toEqual({
      path: "submissions/ada/top-interview-easy/1/Solution.java",
      user: "ada",
      sourceKey: "top-interview-easy",
      submissionKey: "1",
      filename: "Solution.java",
      extension: "java",
    });
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: FAIL because `scripts/opencode-review-core.mjs` does not exist.

- [ ] **Step 3: Implement safe failure, path parsing, and catalog resolution**

Create the module with these exact constants and exports:

```js
const solutionPathPattern = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)\/solution\.([^.\/]+)$/i;

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

function catalogFailure(detail) {
  return new ReviewFailure({
    stage: "catalog-resolve",
    reason: "CATALOG_MAPPING_FAILED",
    detail,
  });
}
```

`parseSubmissionSolutionPath` must reject nonmatching paths with fixed detail `제출 solution 경로를 해석하지 못했습니다.`. `resolveCatalogProblem` must look up the list by `sourceKey`, the item by string-equal `submissionKey`, and the canonical problem by slug; each missing link throws `catalogFailure` without including source contents.

- [ ] **Step 4: Add failing language and problem normalization tests**

Append tests that assert every approved extension mapping and normalize this fixture:

```js
const rawQuestion = {
  content: "<p>Find two numbers.</p>",
  exampleTestcases: "[2,7,11,15]\n9",
  metaData: JSON.stringify({ name: "twoSum", params: [{ name: "nums", type: "integer[]" }] }),
  codeSnippets: [
    { lang: "Java", langSlug: "java", code: "class Solution { public int[] twoSum(int[] nums, int target) {} }" },
    { lang: "Python3", langSlug: "python3", code: "class Solution:\n    def twoSum(self, nums, target):" },
  ],
  topicTags: [{ name: "Array", slug: "array" }, { name: "Hash Table", slug: "hash-table" }],
};

expect(normalizeQuestionData(rawQuestion, "java")).toEqual({
  content: rawQuestion.content,
  exampleTestcases: rawQuestion.exampleTestcases,
  metadata: { name: "twoSum", params: [{ name: "nums", type: "integer[]" }] },
  codeTemplate: rawQuestion.codeSnippets[0].code,
  topicTags: rawQuestion.topicTags,
});
```

Assert missing content, blank examples, invalid `metaData`, and a missing matching snippet each throw `{ stage: "problem-parse", reason: "PROBLEM_DATA_INVALID" }` with fixed Korean details. Assert unsupported extensions fail the same way.

- [ ] **Step 5: Run normalization tests and verify RED**

Run: `npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: FAIL because language mapping and normalization exports are missing.

- [ ] **Step 6: Implement language mapping and normalization**

Use an immutable map with the exact mappings from the design spec. Parse `metaData` inside `try/catch`, require a non-array object, choose `codeSnippets.find(snippet => snippet.langSlug === mappedSlug)`, require nonempty strings, and normalize topic tags to `{ name, slug }` string pairs. Throw only a fixed `ReviewFailure` for invalid input.

- [ ] **Step 7: Verify GREEN and commit Task 1**

Run: `npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: all Task 1 tests PASS.

Commit:

```bash
git add scripts/opencode-review-core.mjs tests/opencode-review-core.test.mjs
git commit -m "feat: resolve submission review problems"
```

---

### Task 2: Build the JSON-only prompt, validate verdicts, and render review Markdown

**Files:**
- Modify: `scripts/opencode-review-core.mjs`
- Modify: `tests/opencode-review-core.test.mjs`

**Interfaces:**
- Produces: `buildReviewPrompt({ resolved, question, source })`, `parseReviewResult(raw, expectedPath)`, `renderReviewComment({ headSha, results, runUrl })`, `renderInfrastructureFailure({ headSha, failure, runUrl })`.
- `parseReviewResult` returns a frozen, schema-validated review object.

- [ ] **Step 1: Write failing prompt-content tests**

Add a test that calls `buildReviewPrompt` with Two Sum fixtures and asserts the returned string contains all of these exact values:

```js
[
  "submissions/ada/top-interview-easy/1/Solution.java",
  "language: java",
  "leetcode_id: 1",
  "title_slug: two-sum",
  "title: Two Sum",
  "difficulty: easy",
  "<p>Find two numbers.</p>",
  "[2,7,11,15]",
  '"name": "twoSum"',
  "class Solution { public int[] twoSum",
  '"slug": "hash-table"',
  "return exactly one JSON object",
  '"schema_version": 1',
  "class Solution { return new int[] {0, 1}; }",
].forEach((value) => expect(prompt).toContain(value));
```

The source code appears only in the returned prompt; the test must not log the prompt.

- [ ] **Step 2: Run prompt test and verify RED**

Run: `npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: FAIL because `buildReviewPrompt` is missing.

- [ ] **Step 3: Implement the complete prompt template**

Use one template literal with the exact instruction and sections below. Replace each expression with the corresponding function argument; serialize metadata and tags with `JSON.stringify(value, null, 2)`. Do not interpolate environment variables or authentication data.

```js
return `You are a strict but narrowly scoped LeetCode submission judge.

Review exactly one submitted solution against the supplied problem statement, constraints, judge metadata, official language template, and examples. Determine whether the code is correct for every valid input and whether its worst-case time and space complexity fit the stated constraints.

Return exactly one JSON object matching schema_version 1 below. Do not return Markdown, code fences, prose before or after the JSON, or additional keys.

Blocking policy:
- FAIL only for an incorrect answer or missing edge case; a compile error or inevitable runtime error; non-termination; a violation of the platform/judge contract; or time/space complexity that exceeds the problem constraints.
- Style, naming, readability, optional optimizations, and alternative algorithms are never blocking by themselves. Put them only in non_blocking_suggestions.
- Do not assume unstated requirements. Judge using the supplied problem and metadata.
- If verdict is FAIL, include at least one blocking finding. Give concrete evidence and, whenever applicable, a minimal counterexample with expected and actual behavior.
- If verdict is PASS, correctness.status must be PASS, complexity.acceptable must be true, and blocking_findings must be empty.
- Echo submission_path exactly in path.

SUBMISSION
- path: ${resolved.path}
- language: ${resolved.extension}

PROBLEM IDENTITY
- leetcode_id: ${resolved.problem.leetcodeId}
- title_slug: ${resolved.slug}
- title: ${resolved.problem.title}
- difficulty: ${resolved.problem.difficulty}

PROBLEM CONTENT, EXAMPLES, AND CONSTRAINTS
${question.content}

EXAMPLE TEST CASES
${question.exampleTestcases}

JUDGE METADATA
${JSON.stringify(question.metadata, null, 2)}

OFFICIAL ${resolved.extension.toUpperCase()} CODE TEMPLATE
${question.codeTemplate}

TOPIC TAGS
${JSON.stringify(question.topicTags, null, 2)}

SUBMITTED CODE
${source}

REQUIRED JSON SHAPE
{
  "schema_version": 1,
  "verdict": "PASS | FAIL",
  "path": "${resolved.path}",
  "summary": "short verdict summary",
  "correctness": {
    "status": "PASS | FAIL",
    "reason": "correctness reasoning tied to the problem contract"
  },
  "complexity": {
    "time": "worst-case Big-O",
    "space": "worst-case auxiliary-space Big-O",
    "acceptable": true,
    "reason": "comparison with the supplied constraints"
  },
  "blocking_findings": [
    {
      "category": "correctness | compile | runtime | termination | platform-contract | complexity",
      "reason": "specific merge-blocking defect",
      "evidence": "why the defect follows from the code and problem",
      "counterexample": {
        "input": "minimal failing input, or null when not applicable",
        "expected": "expected behavior, or null when not applicable",
        "actual": "actual behavior, or null when not applicable"
      }
    }
  ],
  "non_blocking_suggestions": [
    {
      "category": "style | readability | optimization | alternative",
      "suggestion": "optional, non-blocking improvement"
    }
  ]
}`;
```

- [ ] **Step 4: Write failing schema and invariant tests**

Define these valid PASS and FAIL fixtures with a correctness counterexample:

```js
const path = "submissions/ada/top-interview-easy/1/Solution.java";
const passResult = {
  schema_version: 1,
  verdict: "PASS",
  path,
  summary: "Correct hash-map solution.",
  correctness: { status: "PASS", reason: "Returns the required pair for every valid input." },
  complexity: { time: "O(n)", space: "O(n)", acceptable: true, reason: "Fits the constraints." },
  blocking_findings: [],
  non_blocking_suggestions: [],
};
const failResult = {
  schema_version: 1,
  verdict: "FAIL",
  path,
  summary: "Returns the same index twice.",
  correctness: { status: "FAIL", reason: "The lookup occurs after inserting the current index incorrectly." },
  complexity: { time: "O(n)", space: "O(n)", acceptable: true, reason: "Complexity fits the constraints." },
  blocking_findings: [{
    category: "correctness",
    reason: "The same element can be used twice.",
    evidence: "The current index is accepted as its own complement.",
    counterexample: { input: "[3,3], 6", expected: "[0,1]", actual: "[0,0]" },
  }],
  non_blocking_suggestions: [],
};
```

Assert:

```js
expect(parseReviewResult(JSON.stringify(passResult), passResult.path)).toEqual(passResult);
expect(parseReviewResult(JSON.stringify(failResult), failResult.path)).toEqual(failResult);
```

Use table-driven mutations to reject invalid JSON, extra top-level keys, wrong schema version, mismatched path, PASS with findings, PASS with unacceptable complexity, FAIL without findings, unknown categories, empty required text, and incomplete applicable counterexamples. Every rejection must be a `ReviewFailure` with stage `model-response`/reason `MODEL_RESPONSE_INVALID` for JSON/shape failures or stage `result-validation`/reason `REVIEW_RESULT_INVALID` for cross-field invariant failures.

- [ ] **Step 5: Run result tests and verify RED**

Run: `npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: FAIL because `parseReviewResult` is missing.

- [ ] **Step 6: Implement strict result parsing**

Implement helpers `assertExactKeys`, `assertString`, `assertEnum`, and array/object validators. Exact allowed categories are:

```js
const blockingCategories = new Set(["correctness", "compile", "runtime", "termination", "platform-contract", "complexity"]);
const suggestionCategories = new Set(["style", "readability", "optimization", "alternative"]);
```

Never include raw model content in thrown errors. JSON parse and structural failures use fixed detail `모델 응답이 schema version 1 JSON 계약을 충족하지 못했습니다.`. Cross-field failures use fixed detail `모델 판정 결과의 필드가 서로 일치하지 않습니다.`.

- [ ] **Step 7: Write failing Markdown rendering tests**

Assert review Markdown starts with the marker, includes the head SHA and run URL, shows each path, verdict, complexity, blocking evidence and counterexample for FAIL, and non-blocking suggestions for PASS. Assert infrastructure Markdown exactly includes the issue #33 heading and fields `Commit`, `Stage`, `Reason`, `Detail`, `Retryable`, optional HTTP status/request ID, and workflow URL. Assert no submitted source appears.

- [ ] **Step 8: Implement Markdown rendering and verify GREEN**

Render values as Markdown text after replacing control characters and table separators. Do not use raw HTML other than the fixed marker. Run:

`npm.cmd test -- tests/opencode-review-core.test.mjs`

Expected: all Task 1 and Task 2 tests PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add scripts/opencode-review-core.mjs tests/opencode-review-core.test.mjs
git commit -m "feat: validate OpenCode review results"
```

---

### Task 3: Implement external clients, slug cache, and redaction

**Files:**
- Create: `scripts/opencode-review-clients.mjs`
- Create: `tests/opencode-review-clients.test.mjs`

**Interfaces:**
- Produces: `LeetCodeClient`, `OpenCodeClient`, `GitHubReviewClient`, `extractRequestId(response)`, `isRetryableStatus(status)`, `toSafeHttpFailure(options)`.
- Each client accepts `{ fetchImpl = fetch }` and never logs.

- [ ] **Step 1: Write failing LeetCode client and cache tests**

Define this fixture locally in the client test, then use a fake fetch that records requests and returns `{ data: { question: rawQuestion } }`:

```js
const rawQuestion = {
  content: "<p>Find two numbers.</p>",
  exampleTestcases: "[2,7,11,15]\n9",
  metaData: JSON.stringify({ name: "twoSum", params: [{ name: "nums", type: "integer[]" }] }),
  codeSnippets: [{ lang: "Java", langSlug: "java", code: "class Solution { public int[] twoSum(int[] nums, int target) {} }" }],
  topicTags: [{ name: "Array", slug: "array" }],
};
```

Assert two concurrent `getQuestion("two-sum")` calls result in one fetch and the body contains a GraphQL `question(titleSlug: $titleSlug)` query with variables `{ titleSlug: "two-sum" }`. Assert the URL is `https://leetcode.com/graphql` and no permanent file is written.

Also assert HTTP 503 produces:

```js
expect(failure).toMatchObject({
  stage: "problem-fetch",
  reason: "PROBLEM_FETCH_FAILED",
  retryable: true,
  httpStatus: 503,
  requestId: "lc-request-1",
});
```

The failure detail must not contain the fake response body or Authorization header.

- [ ] **Step 2: Run client test and verify RED**

Run: `npm.cmd test -- tests/opencode-review-clients.test.mjs`

Expected: FAIL because the clients module is missing.

- [ ] **Step 3: Implement safe HTTP helpers and LeetCode client**

Use request-ID header priority `x-request-id`, `request-id`, then `cf-ray`. Retryable statuses are 408, 425, 429, and 500-599. Cache the Promise before awaiting it and retain both success and failure for the run. Parse a successful JSON response internally but throw fixed details for invalid JSON, GraphQL errors, or missing question data. Bound the request and response body with a fixed 60-second `AbortController` timeout and clear it in `finally`; do not add a retry loop.

- [ ] **Step 4: Write failing OpenCode request tests**

Assert `OpenCodeClient.review({ model: "opencode-go/kimi-k2.7-code", apiKey: "test-secret", prompt: "review prompt" })` sends:

```js
{
  model: "kimi-k2.7-code",
  temperature: 0,
  messages: [{ role: "user", content: "review prompt" }],
}
```

to the fixed endpoint with `Authorization: Bearer test-secret`, while returning only the content of exactly one choice whose `message.role` is `assistant` and whose content is a non-blank string. Assert the API key and raw body never occur in any thrown `ReviewFailure`. Accept only the exact configured model `opencode-go/kimi-k2.7-code`; reject every other value before fetch with `MODEL_REQUEST_FAILED`.

- [ ] **Step 5: Implement OpenCode client and verify its tests GREEN**

Map request/network/non-2xx failures to `model-request`/`MODEL_REQUEST_FAILED`; map successful but unreadable or missing assistant content to `model-response`/`MODEL_RESPONSE_INVALID`. Use one fixed 60-second deadline across both fetch and response-body parsing, abort on timeout, preserve the timeout as the sanitized model-request failure, and clear the timer only in an outer `finally`.

- [ ] **Step 6: Write failing GitHub client tests**

Cover exact-head check creation and update payloads, pagination of issue comments, selection only of a `github-actions[bot]` marker comment, preservation of user marker comments, PATCH of an existing bot comment, POST on first run, and sanitized delivery failure metadata. The client must expose:

```js
createCheck({ headSha, title, summary });
completeCheck({ checkRunId, conclusion, title, summary });
upsertReviewComment({ pullNumber, body });
```

- [ ] **Step 7: Implement GitHub client and verify GREEN**

Use `https://api.github.com/repos/<repository>` with API version `2022-11-28`, `Bearer <token>`, and `application/vnd.github+json`. Never include a GitHub response body in errors.

Run: `npm.cmd test -- tests/opencode-review-clients.test.mjs`

Expected: all client tests PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add scripts/opencode-review-clients.mjs tests/opencode-review-clients.test.mjs
git commit -m "feat: add review service clients"
```

---

### Task 4: Orchestrate checks, reviews, comments, and summaries

**Files:**
- Create: `scripts/opencode-review.mjs`
- Create: `tests/opencode-review.test.mjs`
- Modify: `scripts/validate-submission-pr.mjs`

**Interfaces:**
- Export from validator: `isSubmissionArtifactName` and `hasCompletePullRequestFileList(pullRequest, files)` in addition to existing exports.
- Produce: `reviewPullRequest(options)`, `appendReviewSummary(markdown, summaryPath)`, and CLI `main()`.
- `reviewPullRequest` accepts injected `githubClient`, `leetcodeClient`, `openCodeClient`, trusted-scope loader, file readers, catalog, and changed files for tests.

- [ ] **Step 1: Write failing orchestration success/cache tests**

Create two changed Java solution paths that resolve to the same slug. Inject clients that record calls and return PASS results. Assert:

- one check is created for the exact head SHA;
- one LeetCode request occurs for the slug;
- two model reviews occur with each exact path/source;
- one managed comment is upserted;
- the check completes with `success`;
- the returned aggregate has two PASS results.

- [ ] **Step 2: Run orchestration test and verify RED**

Run: `npm.cmd test -- tests/opencode-review.test.mjs`

Expected: FAIL because the orchestrator is missing.

- [ ] **Step 3: Implement the successful review lifecycle**

Create the check first. Re-fetch PR metadata and require the triggering base/head SHAs, list PR files through GitHub REST, derive submission-only applicability with trusted catalog/user data, and filter `A`/`M` `solution.*` paths. Fetch each solution from the verified PR head repository through REST with `ref=<exact head SHA>` and never execute it. Aggregate results in changed-path order, render one comment, append the same Markdown to the summary, and complete the check.

- [ ] **Step 4: Write failing code FAIL, infrastructure failure, rerun, and comment fallback tests**

Add cases that assert:

- one model FAIL completes the check with `failure` and renders its blocking counterexample;
- GraphQL 503 renders the approved infrastructure format and completes with `failure`;
- invalid model JSON produces `model-response/MODEL_RESPONSE_INVALID` without raw output;
- result invariant failure produces `result-validation/REVIEW_RESULT_INVALID`;
- a prior managed failure comment is updated with a later PASS body;
- comment API failure keeps the completed review conclusion but adds the fixed delivery diagnostic to check and Actions summary;
- non-submission mode emits a successful not-applicable check without LeetCode, model, or comment calls;
- no changed `solution.*` in a valid submission-only PR emits a successful check and a managed no-solutions summary.

- [ ] **Step 5: Implement failure handling and verify GREEN**

Catch only `ReviewFailure` as-is; convert unknown exceptions to a fixed safe failure based on the active stage. Never log an exception object. Ensure the check completion is attempted in `finally`-equivalent control flow and that comment delivery errors cannot erase the original verdict.

Run: `npm.cmd test -- tests/opencode-review.test.mjs`

Expected: all orchestration tests PASS.

- [ ] **Step 6: Write failing CLI environment validation tests**

Spawn the CLI with controlled environment. Assert it requires `GITHUB_REPOSITORY`, `GITHUB_TOKEN`, PR number, base SHA, head SHA, and run URL. The trusted scope loader requires OpenCode configuration only after it proves the PR is submission-only and completes a sanitized failure check when that configuration is unavailable. Missing values must produce fixed names-only messages and must not dump the environment.

- [ ] **Step 7: Implement CLI parsing and validator export**

Accept only `--base`, `--head`, and `--pull-number`; reject the deprecated `--submission-only` path so omission cannot silently become N/A. Build the run URL from `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, and `GITHUB_RUN_ID`. Use the GitHub client to re-fetch PR metadata/files and exact-head source content. Require `changed_files` to be a safe nonnegative integer no greater than 3,000 and equal to the complete fetched list length before applicability is derived. Export the validator predicates needed to derive applicability without changing validation behavior.

- [ ] **Step 8: Run focused regression tests and commit Task 4**

Run:

```bash
npm.cmd test -- tests/opencode-review.test.mjs tests/validate-submission-pr.test.ts
```

Expected: all focused tests PASS.

Commit:

```bash
git add scripts/opencode-review.mjs tests/opencode-review.test.mjs scripts/validate-submission-pr.mjs
git commit -m "feat: orchestrate submission reviews"
```

---

### Task 5: Wire the review lifecycle into GitHub Actions

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`
- Create: `.github/workflows/opencode-review.yml`
- Modify: `tests/deploy-workflow.test.ts`
- Create: `tests/opencode-review-workflow.test.ts`

**Interfaces:**
- The deploy workflow retains validation and deploy behavior but has no review job, OpenCode secret, or review-write permissions.
- A separate `workflow_run` workflow responds only to completed successful PR runs of `Deploy GitHub Pages`.
- The review workflow checks out the event's verified PR base SHA with credentials disabled, then passes the exact base SHA, head SHA, and PR number to the trusted CLI. It never checks out or executes the PR head.

- [ ] **Step 1: Write failing workflow contract assertions**

Extend `tests/deploy-workflow.test.ts` to assert the deploy workflow has no review job, OpenCode setting, `checks: write`, or `pull-requests: write`. Add `tests/opencode-review-workflow.test.ts` and assert normalized workflow text contains:

```text
workflow_run:
  workflows: [Deploy GitHub Pages]
  types: [completed]
```

Assert the job requires a successful run associated with a pull request, grants only `contents: read`, `checks: write`, and `pull-requests: write`, and checks out `${{ github.event.workflow_run.pull_requests[0].base.sha }}` with `persist-credentials: false`. Require a command equivalent to:

```yaml
node scripts/opencode-review.mjs \
  --base "${{ github.event.workflow_run.pull_requests[0].base.sha }}" \
  --head "${{ github.event.workflow_run.pull_requests[0].head.sha }}" \
  --pull-number "${{ github.event.workflow_run.pull_requests[0].number }}"
```

Assert environment mappings use `secrets.GITHUB_TOKEN`, `secrets.OPENCODE_API_KEY`, and `vars.OPENCODE_REVIEW_MODEL`. Reject `pull_request_target`, any PR-head checkout, and the removed `--submission-only` flag.

- [ ] **Step 2: Run workflow test and verify RED**

Run: `npm.cmd test -- tests/deploy-workflow.test.ts tests/opencode-review-workflow.test.ts`

Expected: FAIL because the isolated trusted review workflow is missing and the deploy workflow still contains review behavior.

- [ ] **Step 3: Isolate review execution in the trusted workflow**

Remove review execution and its elevated permissions from the pull-request workflow. Add the `workflow_run` workflow using only trusted default-branch code at the verified base SHA. Give checkout no persisted credentials, pass PR-head identifiers only as data to the GitHub REST orchestration, and expose the OpenCode secret only in this trusted job.

- [ ] **Step 4: Verify workflow tests GREEN and commit Task 5**

Run: `npm.cmd test -- tests/deploy-workflow.test.ts tests/opencode-review-workflow.test.ts tests/opencode-review.test.mjs`

Expected: all focused tests PASS.

Commit:

```bash
git add .github/workflows/deploy-pages.yml .github/workflows/opencode-review.yml tests/deploy-workflow.test.ts tests/opencode-review-workflow.test.ts
git commit -m "ci: isolate trusted OpenCode review"
```

---

### Task 6: Require both current-head checks in the sweeper

**Files:**
- Modify: `scripts/sweep-submission-prs.mjs`
- Modify: `tests/sweep-submission-prs.test.mjs`
- Modify: `.github/workflows/sweep-submission-prs.yml`
- Modify: `tests/sweep-workflow.test.ts`

**Interfaces:**
- Replace `requiredCheck` with `requiredChecks`, defaulting to `["validate", "opencode-review"]`.
- Replace `SWEEP_REQUIRED_CHECK` with `SWEEP_REQUIRED_CHECKS=validate,opencode-review`.
- Require `SWEEP_REQUIRED_CHECK_APP=github-actions` and accept only the unique newest run by check-run ID from that GitHub App.

- [ ] **Step 1: Change sweeper tests first**

Define:

```js
const successfulChecks = [
  { id: 101, name: "validate", status: "completed", conclusion: "success", app: { slug: "github-actions" } },
  { id: 201, name: "opencode-review", status: "completed", conclusion: "success", app: { slug: "github-actions" } },
];
```

Use it in every eligible orchestration fixture, including an explicit valid `changed_files` count. Add one test for each missing, incomplete, and failed `opencode-review` state and assert reason `opencode-review check is not successful for abc123.`. Add regressions proving a newer failed/in-progress run masks an older success, another app cannot spoof success, missing app provenance fails closed, tied latest IDs are ambiguous, and missing/invalid/mismatched/over-3,000 PR-file counts fail closed. Add pre-merge regressions where refreshed draft/base/author/repository/file ownership/file-count metadata revoke eligibility and where a refreshed head SHA drives the fresh checks and exact merge. Keep the existing validate-failure assertion.

- [ ] **Step 2: Run sweeper tests and verify RED**

Run: `npm.cmd test -- tests/sweep-submission-prs.test.mjs`

Expected: FAIL because check provenance, newest-run selection, and the pre-merge check re-fetch are missing.

- [ ] **Step 3: Implement authoritative newest-check gating**

Normalize constructor/CLI input by splitting comma-separated names, trimming, removing blanks, and preserving order. For each required name, reject exact-name runs with missing provenance, filter to the configured app slug, require safe integer IDs, and evaluate only the unique greatest ID. Continue using `/commits/<headSha>/check-runs`. Immediately before merge, re-fetch the PR object and changed-file list, verify file completeness, fetch checks for the refreshed exact head SHA, and repeat the full draft/base/conflict/ownership/catalog/file/check evaluation. Merge only with that refreshed exact head SHA.

- [ ] **Step 4: Write failing workflow configuration assertion**

Extend `tests/sweep-workflow.test.ts` to require:

```yaml
SWEEP_REQUIRED_CHECKS: validate,opencode-review
SWEEP_REQUIRED_CHECK_APP: github-actions
```

and reject the singular environment name.

- [ ] **Step 5: Modify sweeper workflow and verify GREEN**

Run:

```bash
npm.cmd test -- tests/sweep-submission-prs.test.mjs tests/sweep-workflow.test.ts
```

Expected: all sweeper tests PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add scripts/sweep-submission-prs.mjs tests/sweep-submission-prs.test.mjs .github/workflows/sweep-submission-prs.yml tests/sweep-workflow.test.ts
git commit -m "feat: require OpenCode review before merge"
```

---

### Task 7: Security regression, full verification, and safe repository rollout

**Files:**
- Modify only files found incomplete by the verification below.
- External configuration: repository variable and, after live readiness, branch protection.

**Interfaces:**
- No new public interface; this task verifies all approved contracts together.

- [ ] **Step 1: Add any missing end-to-end redaction assertions before fixes**

Search tests for every forbidden value class. If any is absent, add a test with sentinel values `secret-api-key`, `Bearer secret-token`, `raw-model-body`, `raw-graphql-body`, and `submitted-source-sentinel`; aggregate captured logs, comments, checks, summaries, and thrown safe details; assert none contains a sentinel. Run the focused test and observe it fail before changing production code.

- [ ] **Step 2: Fix only the demonstrated redaction or integration gap**

Use fixed messages and structured safe fields. Do not add a generic raw-error fallback.

- [ ] **Step 3: Run complete local verification**

Run, in order:

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
git diff --check master...HEAD
```

Expected: 0 failed tests, typecheck exit 0, production build exit 0, and no whitespace errors.

- [ ] **Step 4: Review the requirement checklist**

Confirm from tests and code:

- live problem statement, examples, metadata, official template, and tags reach the prompt;
- one slug request is cached per run;
- code FAIL shows blocking findings and counterexamples;
- all six review failures are fail-closed and sanitized;
- failure comment becomes success on rerun;
- comment delivery fallback reaches check and Actions summary;
- current head SHA owns both required checks;
- no secret or raw response is emitted.

- [ ] **Step 5: Commit verification fixes if any**

If Task 7 changed files, stage only those files and commit them with:

```bash
git add scripts tests .github .env.example
git commit -m "test: harden review gate redaction"
```

If Task 7 changed no files, do not create an empty commit.

- [ ] **Step 6: Configure the repository variable**

Using an authenticated GitHub REST request, create or update:

```text
OPENCODE_REVIEW_MODEL=opencode-go/kimi-k2.7-code
```

Re-read the Actions variables endpoint and verify the exact value. Do not print or request the API key.

- [ ] **Step 7: Gate branch-protection mutation on live readiness**

List Actions secret names and verify `OPENCODE_API_KEY` exists. Verify a completed `opencode-review` check has been emitted by the new workflow for a real pull-request head SHA. Only when both conditions are true, update `master` required checks to preserve `validate` and add `opencode-review`, then re-read branch protection and verify both contexts.

If either condition is false, leave branch protection unchanged at `validate` and report the exact missing readiness condition. This is a safe rollout state, not permission to store a fake secret or weaken fail-closed behavior.

- [ ] **Step 8: Request whole-branch review**

Create a review package from `master...HEAD` and dispatch the final reviewer against the approved design spec and this plan. Fix all Critical and Important findings with focused tests, then repeat the complete verification commands before reporting completion.

---

## Final Verification Checklist

- [ ] Every new exported function has a test that was observed failing first.
- [ ] Full suite, typecheck, and build pass on the final commit.
- [ ] `git status --short` contains no implementation leftovers.
- [ ] Only `feat/opencode-review` worktree files changed; the original user checkout remains untouched.
- [ ] Repository variable is configured exactly.
- [ ] Secret existence and live check readiness determine whether branch protection is updated.
- [ ] Final reviewer has no unresolved Critical or Important findings.
