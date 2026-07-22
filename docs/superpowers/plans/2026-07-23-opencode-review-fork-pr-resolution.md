# OpenCode Review Fork PR Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trusted OpenCode review resolve and review successful fork pull-request runs without depending on `workflow_run.pull_requests[0]`.

**Architecture:** A new trusted resolver queries open pull requests by the workflow-run head owner and branch, then requires one exact base repository, base branch, head repository, head branch, and head SHA match. The workflow checks out the default branch before running the resolver, checks out the validated base SHA afterward, and passes only validated outputs to the existing review CLI.

**Tech Stack:** GitHub Actions YAML, Node.js 20 ESM, GitHub REST API, Vitest 3.

## Global Constraints

- Never use `pull_request_target`.
- Never checkout or execute pull-request head code in the secret-bearing workflow.
- Pass fork-controlled repository and branch metadata through environment variables, never shell interpolation.
- Reject missing, malformed, zero-match, and ambiguous resolution results.
- Preserve the existing `loadTrustedPullRequestScope` exact number/base/head verification.
- Keep branch protection and sweeper check names unchanged.

---

### Task 1: Trusted Fork Pull Request Resolver

**Files:**
- Create: `scripts/resolve-opencode-review-pr.mjs`
- Create: `tests/resolve-opencode-review-pr.test.mjs`

**Interfaces:**
- Produces: `selectPullRequest(pulls, expected) -> { pullNumber, baseSha, headSha }`.
- Produces: `listCandidatePullRequests({ fetchImpl, repository, token, baseBranch, headRepository, headBranch }) -> Promise<Array>`.
- Produces: `main({ env, fetchImpl, appendOutput, stderr }) -> Promise<{ exitCode, resolution? }>`.
- Produces GitHub step outputs: `pull-number`, `base-sha`, and `head-sha`.

- [ ] **Step 1: Write the failing selection tests**

Create `tests/resolve-opencode-review-pr.test.mjs` with fixtures for PR #49-shaped fork metadata. Assert that the exact fork match resolves and that zero or multiple exact matches throw only `OpenCode pull-request resolution failed.`.

```js
import { describe, expect, it, vi } from "vitest";
import { main, selectPullRequest } from "../scripts/resolve-opencode-review-pr.mjs";

const sha = (character) => character.repeat(40);
const expected = {
  baseRepository: "whoisyourbias/leetdash",
  baseBranch: "master",
  headRepository: "jhee22/leetdash",
  headBranch: "jeehee",
  headSha: sha("c"),
};

function pull(overrides = {}) {
  return {
    number: 49,
    state: "open",
    base: { ref: "master", sha: sha("b"), repo: { full_name: "whoisyourbias/leetdash" } },
    head: { ref: "jeehee", sha: sha("c"), repo: { full_name: "jhee22/leetdash" } },
    ...overrides,
  };
}

describe("selectPullRequest", () => {
  it("selects one exact fork pull request", () => {
    expect(selectPullRequest([pull()], expected)).toEqual({
      pullNumber: 49,
      baseSha: sha("b"),
      headSha: sha("c"),
    });
  });

  it("rejects zero exact matches", () => {
    expect(() => selectPullRequest([
      pull({ head: { ref: "jeehee", sha: sha("d"), repo: { full_name: "jhee22/leetdash" } } }),
    ], expected)).toThrow("OpenCode pull-request resolution failed.");
  });

  it("rejects ambiguous exact matches", () => {
    expect(() => selectPullRequest([pull(), pull({ number: 50 })], expected))
      .toThrow("OpenCode pull-request resolution failed.");
  });
});
```

- [ ] **Step 2: Run the selection tests and verify RED**

Run:

```bash
npx vitest run tests/resolve-opencode-review-pr.test.mjs
```

Expected: FAIL because `scripts/resolve-opencode-review-pr.mjs` does not exist.

- [ ] **Step 3: Implement the minimal pure selector**

Create `scripts/resolve-opencode-review-pr.mjs` with:

```js
const resolutionFailureMessage = "OpenCode pull-request resolution failed.";
const repositoryPattern = /^[^/\s]+\/[^/\s]+$/;
const shaPattern = /^[0-9a-f]{40}$/;

class PullRequestResolutionFailure extends Error {
  constructor() {
    super(resolutionFailureMessage);
    this.name = "PullRequestResolutionFailure";
  }
}

function selectPullRequest(pulls, expected) {
  if (!Array.isArray(pulls)) throw new PullRequestResolutionFailure();
  const matches = pulls.filter((pull) => (
    pull?.state === "open"
    && pull?.base?.repo?.full_name === expected.baseRepository
    && pull?.base?.ref === expected.baseBranch
    && pull?.head?.repo?.full_name === expected.headRepository
    && pull?.head?.ref === expected.headBranch
    && pull?.head?.sha === expected.headSha
    && Number.isInteger(pull?.number)
    && pull.number > 0
    && shaPattern.test(pull?.base?.sha ?? "")
  ));
  if (matches.length !== 1) throw new PullRequestResolutionFailure();
  return {
    pullNumber: matches[0].number,
    baseSha: matches[0].base.sha,
    headSha: matches[0].head.sha,
  };
}
```

Export the helper without adding API or CLI behavior yet.

- [ ] **Step 4: Run the selection tests and verify GREEN**

Run:

```bash
npx vitest run tests/resolve-opencode-review-pr.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Add failing API and CLI tests**

Extend the same test file to assert:

- The GitHub request is `GET /repos/whoisyourbias/leetdash/pulls` with
  `state=open`, `base=master`, `head=jhee22:jeehee`, `per_page=100`, and
  sequential `page` values.
- The CLI validates all seven required environment values before fetching.
- A successful CLI appends exactly:
  `pull-number=49\nbase-sha=<base>\nhead-sha=<head>\n`.
- API failures, invalid JSON, malformed metadata, and output failures return
  exit code 1 and emit only the sanitized failure message.

Use injected `fetchImpl`, `appendOutput`, and `stderr` functions. Do not mutate
`process.env` or the real filesystem in unit tests.

- [ ] **Step 6: Run the expanded tests and verify RED**

Run:

```bash
npx vitest run tests/resolve-opencode-review-pr.test.mjs
```

Expected: FAIL because API pagination and `main` are not implemented.

- [ ] **Step 7: Implement API pagination and CLI orchestration**

In `scripts/resolve-opencode-review-pr.mjs`:

- Validate repository names with `repositoryPattern`.
- Validate branches as non-empty strings without CR or LF.
- Validate the head SHA with `shaPattern`.
- Derive the query head as `<head owner>:<head branch>` after splitting the
  already validated head repository.
- Fetch pages until a page has fewer than 100 entries.
- Never read an error response body.
- Append validated output values through the injected output writer.
- In the executable entry point, inject `process.env`, global `fetch`,
  `appendFile(GITHUB_OUTPUT, value, "utf8")`, and `console.error`.
- Catch every failure at the CLI boundary, print only
  `OpenCode pull-request resolution failed.`, and return exit code 1.

- [ ] **Step 8: Run resolver tests and verify GREEN**

Run:

```bash
npx vitest run tests/resolve-opencode-review-pr.test.mjs
```

Expected: all resolver tests pass with no network or filesystem access.

- [ ] **Step 9: Commit the resolver**

```bash
git add scripts/resolve-opencode-review-pr.mjs tests/resolve-opencode-review-pr.test.mjs
git commit -m "fix: resolve fork PRs for OpenCode review"
```

---

### Task 2: Trusted Workflow Integration

**Files:**
- Modify: `.github/workflows/opencode-review.yml`
- Modify: `tests/opencode-review-workflow.test.ts`

**Interfaces:**
- Consumes resolver outputs: `steps.resolve-pr.outputs.pull-number`,
  `steps.resolve-pr.outputs.base-sha`, and
  `steps.resolve-pr.outputs.head-sha`.
- Preserves existing CLI: `node scripts/opencode-review.mjs --base SHA --head SHA --pull-number NUMBER`.

- [ ] **Step 1: Replace the old workflow assertions with failing fork-safe contract assertions**

Update `tests/opencode-review-workflow.test.ts` to require:

```ts
expect(workflow).not.toContain("workflow_run.pull_requests[0]");
expect(workflow).toContain("github.event.workflow_run.event == 'pull_request'");
expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
expect(workflow).toContain("ref: ${{ github.event.repository.default_branch }}");
expect(workflow).toContain("id: resolve-pr");
expect(workflow).toContain("node scripts/resolve-opencode-review-pr.mjs");
expect(workflow).toContain("OPENCODE_HEAD_REPOSITORY: ${{ github.event.workflow_run.head_repository.full_name }}");
expect(workflow).toContain("OPENCODE_HEAD_BRANCH: ${{ github.event.workflow_run.head_branch }}");
expect(workflow).toContain("OPENCODE_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}");
expect(workflow).toContain("ref: ${{ steps.resolve-pr.outputs.base-sha }}");
expect(workflow).toContain('--base "${{ steps.resolve-pr.outputs.base-sha }}"');
expect(workflow).toContain('--head "${{ steps.resolve-pr.outputs.head-sha }}"');
expect(workflow).toContain('--pull-number "${{ steps.resolve-pr.outputs.pull-number }}"');
```

Retain assertions for minimal permissions, `persist-credentials: false`, no
`pull_request_target`, and no head checkout.

- [ ] **Step 2: Run the workflow test and verify RED**

Run:

```bash
npx vitest run tests/opencode-review-workflow.test.ts
```

Expected: FAIL on the removed `pull_requests[0]` dependency and missing resolver step.

- [ ] **Step 3: Implement the fork-safe workflow sequence**

Modify `.github/workflows/opencode-review.yml` so that:

- Concurrency uses `head_repository.full_name` plus `head_sha`.
- The job condition checks only upstream event type and success.
- The first checkout uses the default branch and disables persisted credentials.
- The resolver step has `id: resolve-pr`, runs the new trusted script, and
  receives the GitHub token plus base/head metadata through `env`.
- A second checkout uses only `steps.resolve-pr.outputs.base-sha` and disables
  persisted credentials.
- The review CLI receives only the three resolver outputs.

- [ ] **Step 4: Run workflow and resolver tests and verify GREEN**

Run:

```bash
npx vitest run tests/resolve-opencode-review-pr.test.mjs tests/opencode-review-workflow.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 5: Commit workflow integration**

```bash
git add .github/workflows/opencode-review.yml tests/opencode-review-workflow.test.ts
git commit -m "fix: run OpenCode review for fork PRs"
```

---

### Task 3: Regression and Repository Verification

**Files:**
- Verify: `scripts/resolve-opencode-review-pr.mjs`
- Verify: `.github/workflows/opencode-review.yml`
- Verify: all repository tests and typecheck inputs

**Interfaces:**
- Consumes no new interfaces.
- Produces fresh verification evidence for the completed branch.

- [ ] **Step 1: Run all OpenCode and workflow tests**

```bash
npx vitest run \
  tests/resolve-opencode-review-pr.test.mjs \
  tests/opencode-review-core.test.mjs \
  tests/opencode-review-clients.test.mjs \
  tests/opencode-review.test.mjs \
  tests/opencode-review-workflow.test.ts \
  tests/sweep-submission-prs.test.mjs \
  tests/sweep-workflow.test.ts
```

Expected: all selected test files pass.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: exit code 0 with zero failed test files.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Inspect the final diff and whitespace**

```bash
git diff --check origin/master...HEAD
git diff --stat origin/master...HEAD
git status --short --branch
```

Expected: no whitespace errors; only the spec, plan, resolver, resolver test,
workflow, and workflow test are changed; `.superpowers/` remains untracked and
untouched in the original checkout only.

- [ ] **Step 5: Record live follow-up**

Do not mutate PR #49 or #50 from this implementation branch. Report that live
verification requires landing the workflow on the default branch, then
re-running their validation workflows or pushing new fork commits.
