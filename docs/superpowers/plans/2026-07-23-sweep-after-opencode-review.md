# Reliable Post-Review Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run submission sweep only after OpenCode review publishes an unambiguous successful gate, and make merge API failures visible as failed Actions runs.

**Architecture:** Keep the rich `opencode-review` Check Run for review details, and add the distinct commit-status context `opencode-review-gate` as the merge gate. The review workflow owns status publication, while the sweeper reads validation Check Runs and review commit statuses independently and refreshes both immediately before merge. Automatic sweep moves from validation completion to successful review-workflow completion.

**Tech Stack:** GitHub Actions YAML, Node.js 20 ESM, GitHub REST API, Vitest

## Global Constraints

- Preserve the detailed Check Run name `opencode-review`.
- Use commit-status context `opencode-review-gate`; never reuse the Check Run name for the status.
- Keep hourly and manual sweep triggers.
- Continue scanning other pull requests after a merge failure, then fail the sweep CLI after summary/deploy handling.
- Never resolve or mutate human review conversations.
- Do not migrate live branch protection until the implementation exists on the default branch.

---

## File Map

- `.github/workflows/opencode-review.yml`: grants commit-status write permission.
- `.github/workflows/sweep-submission-prs.yml`: triggers after successful review and configures separate required checks/statuses.
- `scripts/opencode-review-clients.mjs`: publishes `opencode-review-gate` commit statuses.
- `scripts/opencode-review.mjs`: brackets review execution with pending and terminal gate states.
- `scripts/sweep-submission-prs.mjs`: retrieves/evaluates commit statuses and exposes merge failures to the CLI.
- `tests/opencode-review-clients.test.mjs`: verifies exact GitHub status requests.
- `tests/opencode-review.test.mjs`: verifies pending/success/failure status transitions.
- `tests/opencode-review-workflow.test.ts`: verifies least-privilege status permission.
- `tests/sweep-submission-prs.test.mjs`: verifies status selection, refresh, and failure propagation.
- `tests/sweep-workflow.test.ts`: verifies post-review triggering and environment configuration.

---

### Task 1: Publish a dedicated OpenCode review gate

**Files:**
- Modify: `tests/opencode-review-clients.test.mjs`
- Modify: `tests/opencode-review.test.mjs`
- Modify: `tests/opencode-review-workflow.test.ts`
- Modify: `scripts/opencode-review-clients.mjs`
- Modify: `scripts/opencode-review.mjs`
- Modify: `.github/workflows/opencode-review.yml`

**Interfaces:**
- Produces: `GitHubReviewClient.setCommitStatus({ sha, state, description, targetUrl }) -> Promise<object | null>`
- Produces: status context `opencode-review-gate` with `pending`, `success`, or `failure` state.
- Preserves: `createCheck()` and `completeCheck()` with Check Run name `opencode-review`.

- [ ] **Step 1: Write failing client and workflow tests**

Add a `GitHubReviewClient` test that calls:

```js
await client.setCommitStatus({
  sha: "head-123",
  state: "pending",
  description: "OpenCode review is running.",
  targetUrl: "https://github.example/example/leetdash/actions/runs/9",
});
```

Assert a `POST /repos/example/leetdash/statuses/head-123` request with:

```js
{
  context: "opencode-review-gate",
  state: "pending",
  description: "OpenCode review is running.",
  target_url: "https://github.example/example/leetdash/actions/runs/9",
}
```

Extend `tests/opencode-review-workflow.test.ts` to require this exact permission block:

```yaml
permissions:
  contents: read
  checks: write
  pull-requests: write
  statuses: write
```

Keep assertions that `contents: write` and `actions: write` are absent.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/opencode-review-clients.test.mjs tests/opencode-review-workflow.test.ts --exclude '.worktrees/**'
```

Expected: failures because `setCommitStatus` and `statuses: write` do not exist.

- [ ] **Step 3: Implement the GitHub status client and workflow permission**

Add this method to `GitHubReviewClient`:

```js
setCommitStatus({ sha, state, description, targetUrl }) {
  return this.request("POST", `/statuses/${sha}`, {
    body: {
      context: "opencode-review-gate",
      state,
      description,
      target_url: targetUrl,
    },
  });
}
```

Add `statuses: write` to the review job permissions without broadening any other permission.

- [ ] **Step 4: Write failing review lifecycle tests**

Extend the `main()` tests with a `statuses` array and a stub:

```js
setCommitStatus: async (value) => { statuses.push(value); },
```

For a successful review, assert:

```js
expect(statuses).toEqual([
  {
    sha: headSha,
    state: "pending",
    description: "OpenCode review is running.",
    targetUrl: "https://github.example/example/leetdash/actions/runs/9",
  },
  {
    sha: headSha,
    state: "success",
    description: "OpenCode review passed.",
    targetUrl: "https://github.example/example/leetdash/actions/runs/9",
  },
]);
```

Add a failure test where `reviewPullRequest` fails through check creation or completion. Assert that pending is followed by a best-effort failure status, the original error is still rejected, and a failure-status delivery error does not replace the original error.

- [ ] **Step 5: Run the lifecycle tests and verify RED**

Run:

```bash
npx vitest run tests/opencode-review.test.mjs --exclude '.worktrees/**'
```

Expected: lifecycle assertions fail because `main()` does not publish commit statuses.

- [ ] **Step 6: Implement pending and terminal status publication**

In `main()`, publish pending immediately before `reviewPullRequest()`. Wrap review execution and terminal publication in `try/catch`:

```js
await githubClient.setCommitStatus({
  sha: args.head,
  state: "pending",
  description: "OpenCode review is running.",
  targetUrl: runUrl,
});
try {
  const result = await reviewPullRequest(reviewOptions);
  const passed = result.conclusion !== "failure";
  await githubClient.setCommitStatus({
    sha: args.head,
    state: passed ? "success" : "failure",
    description: passed ? "OpenCode review passed." : "OpenCode review failed.",
    targetUrl: runUrl,
  });
  return { exitCode: passed ? 0 : 1, result };
} catch (error) {
  try {
    await githubClient.setCommitStatus({
      sha: args.head,
      state: "failure",
      description: "OpenCode review failed.",
      targetUrl: runUrl,
    });
  } catch {
    // Preserve the original review failure.
  }
  throw error;
}
```

Build the existing `reviewPullRequest` argument object once as `reviewOptions`; do not change review applicability or comment behavior.

- [ ] **Step 7: Verify GREEN and commit Task 1**

Run:

```bash
npx vitest run tests/opencode-review-clients.test.mjs tests/opencode-review.test.mjs tests/opencode-review-workflow.test.ts --exclude '.worktrees/**'
```

Expected: all selected tests pass.

Commit:

```bash
git add .github/workflows/opencode-review.yml scripts/opencode-review-clients.mjs scripts/opencode-review.mjs tests/opencode-review-clients.test.mjs tests/opencode-review.test.mjs tests/opencode-review-workflow.test.ts
git commit -m "fix: publish dedicated OpenCode review gate"
```

---

### Task 2: Sweep only after a successful review gate

**Files:**
- Modify: `tests/sweep-workflow.test.ts`
- Modify: `tests/sweep-submission-prs.test.mjs`
- Modify: `.github/workflows/sweep-submission-prs.yml`
- Modify: `scripts/sweep-submission-prs.mjs`

**Interfaces:**
- Consumes: commit status context `opencode-review-gate`.
- Produces: `GitHubClient.listCommitStatuses(sha) -> Promise<Array<CommitStatus>>`.
- Changes: `evaluatePullRequest({ ..., checkRuns, commitStatuses, requiredChecks, requiredStatuses, requiredCheckApp, requiredStatusCreator })`.

- [ ] **Step 1: Write failing workflow tests**

Change `tests/sweep-workflow.test.ts` to assert:

```js
expect(workflow).toContain('workflows: ["OpenCode Submission Review"]');
expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
expect(workflow).toContain("SWEEP_REQUIRED_CHECKS: validate");
expect(workflow).toContain("SWEEP_REQUIRED_STATUSES: opencode-review-gate");
expect(workflow).toContain("SWEEP_REQUIRED_STATUS_CREATOR: github-actions[bot]");
expect(workflow).not.toContain('workflows: ["Deploy GitHub Pages"]');
```

Retain schedule and manual-dispatch assertions.

- [ ] **Step 2: Run the workflow test and verify RED**

Run:

```bash
npx vitest run tests/sweep-workflow.test.ts --exclude '.worktrees/**'
```

Expected: failures because sweep still triggers after validation and requires the old Check Run.

- [ ] **Step 3: Write failing status eligibility tests**

Replace the review entry in `successfulChecks` with a dedicated fixture:

```js
const successfulChecks = [
  { id: 101, name: "validate", status: "completed", conclusion: "success", app: { slug: "github-actions" } },
];
const successfulStatuses = [
  { id: 301, context: "opencode-review-gate", state: "success", creator: { login: "github-actions[bot]" } },
];
```

Pass `commitStatuses: successfulStatuses` to eligible evaluations. Add cases that reject missing, pending, failure, malformed-ID, wrong-creator, and ambiguous-latest statuses. Add a case where status ID 302 pending masks ID 301 success.

Expected skip reason:

```text
opencode-review-gate status is not successful for abc123.
```

Add REST retrieval coverage that paginates `GET /commits/abc123/statuses?per_page=100&page=N` and returns all statuses without filtering by context.

Extend `FakeGitHubClient` with `statusesBySha`, `statusCalls`, and `listCommitStatuses(sha)`. Assert that both Check Runs and statuses are fetched for the initial SHA and refreshed SHA immediately before merge.

- [ ] **Step 4: Run the sweeper tests and verify RED**

Run:

```bash
npx vitest run tests/sweep-submission-prs.test.mjs --exclude '.worktrees/**'
```

Expected: failures because the evaluator and client do not consume commit statuses.

- [ ] **Step 5: Implement status selection and retrieval**

Add defaults:

```js
const defaultRequiredChecks = ["validate"];
const defaultRequiredStatuses = ["opencode-review-gate"];
const defaultRequiredStatusCreator = "github-actions[bot]";
```

Add `selectLatestCommitStatus(statuses, context, expectedCreator)` using the same fail-closed rules as Check Runs: exact context, exact creator login, safe integer IDs, highest ID, and exactly one entry at the highest ID. A successful gate has `state === "success"`.

Add paginated retrieval:

```js
listCommitStatuses(sha) {
  return this.paginateArray(`/commits/${sha}/statuses`);
}
```

Add `commitStatuses`, `requiredStatuses`, and `requiredStatusCreator` to evaluation. Keep validation Check Run provenance unchanged. In both initial and refreshed sweep snapshots, fetch Check Runs and commit statuses for the same head SHA and require both sources to pass.

Read configuration from:

```js
const requiredStatuses = process.env.SWEEP_REQUIRED_STATUSES ?? defaultRequiredStatuses;
const requiredStatusCreator = process.env.SWEEP_REQUIRED_STATUS_CREATOR ?? defaultRequiredStatusCreator;
```

- [ ] **Step 6: Update automatic workflow ordering**

Change the automatic trigger to:

```yaml
workflow_run:
  workflows: ["OpenCode Submission Review"]
  types:
    - completed
```

Change the job condition to:

```yaml
if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
```

Configure `SWEEP_REQUIRED_CHECKS: validate`, `SWEEP_REQUIRED_STATUSES: opencode-review-gate`, and `SWEEP_REQUIRED_STATUS_CREATOR: github-actions[bot]`. Keep schedule, manual dispatch, concurrency, and existing permissions.

- [ ] **Step 7: Verify GREEN and commit Task 2**

Run:

```bash
npx vitest run tests/sweep-submission-prs.test.mjs tests/sweep-workflow.test.ts --exclude '.worktrees/**'
```

Expected: all selected tests pass.

Commit:

```bash
git add .github/workflows/sweep-submission-prs.yml scripts/sweep-submission-prs.mjs tests/sweep-submission-prs.test.mjs tests/sweep-workflow.test.ts
git commit -m "fix: sweep after successful review gate"
```

---

### Task 3: Fail the workflow when a merge API call fails

**Files:**
- Modify: `tests/sweep-submission-prs.test.mjs`
- Modify: `scripts/sweep-submission-prs.mjs`

**Interfaces:**
- Produces: `assertNoMergeFailures(result) -> void`, throwing a sanitized aggregate error after orchestration is complete.
- Preserves: `sweepSubmissionPullRequests()` continues scanning and returns all per-PR results.

- [ ] **Step 1: Write the failing aggregate-failure test**

Export `assertNoMergeFailures` in the test import and assert:

```js
expect(() => assertNoMergeFailures({
  mergedCount: 1,
  results: [
    { number: 7, status: "merge_failed", reason: "sensitive upstream detail" },
    { number: 8, status: "merged" },
  ],
})).toThrow("1 pull request failed to merge.");
```

Also assert that zero merge failures do not throw and that the thrown message does not include upstream response bodies.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/sweep-submission-prs.test.mjs --exclude '.worktrees/**'
```

Expected: import or assertion failure because `assertNoMergeFailures` does not exist.

- [ ] **Step 3: Implement aggregate failure after summary/deploy handling**

Add:

```js
function assertNoMergeFailures(result) {
  const count = result.results.filter((item) => item.status === "merge_failed").length;
  if (count > 0) {
    throw new Error(`${count} pull request${count === 1 ? "" : "s"} failed to merge.`);
  }
}
```

In CLI `main()`, preserve this order:

```js
const result = await sweepSubmissionPullRequests(options);
appendStepSummary(result);
assertNoMergeFailures(result);
```

This keeps scanning, deploy dispatch, and the complete step summary before the workflow turns red.

- [ ] **Step 4: Verify GREEN and commit Task 3**

Run:

```bash
npx vitest run tests/sweep-submission-prs.test.mjs --exclude '.worktrees/**'
```

Expected: all selected tests pass.

Commit:

```bash
git add scripts/sweep-submission-prs.mjs tests/sweep-submission-prs.test.mjs
git commit -m "fix: fail sweep runs on merge errors"
```

---

### Task 4: Full verification and branch-protection handoff

**Files:**
- Verify only; no additional source file is required.

**Interfaces:**
- Operational output: `master` requires `validate` and `opencode-review-gate`, both from GitHub Actions app ID `15368`.

- [ ] **Step 1: Run repository verification**

Run:

```bash
npm test -- --exclude '.worktrees/**'
npm run typecheck
npm run build
git diff --check
```

Expected: tests, typecheck, build, and whitespace validation all pass.

- [ ] **Step 2: Inspect the final diff and protection precondition**

Run:

```bash
git diff master...HEAD --check
git diff master...HEAD --stat
gh api repos/whoisyourbias/leetdash/branches/master/protection/required_status_checks
```

Expected before deployment: existing protection still lists `validate` and `opencode-review`; no live setting has changed prematurely.

- [ ] **Step 3: Commit any verification-only corrections**

If verification requires source corrections, repeat the corresponding RED/GREEN cycle and commit only those corrections. Otherwise create no empty commit.

- [ ] **Step 4: After the implementation reaches `master`, migrate protection atomically**

Send this JSON to `PATCH /repos/whoisyourbias/leetdash/branches/master/protection/required_status_checks`:

```json
{
  "strict": false,
  "checks": [
    { "context": "validate", "app_id": 15368 },
    { "context": "opencode-review-gate", "app_id": 15368 }
  ]
}
```

Do not perform this step while the implementation exists only on a feature branch.

- [ ] **Step 5: Verify protection and live behavior**

Read back branch protection and confirm the exact two checks above, `required_conversation_resolution.enabled` remains `true`, and `opencode-review` is absent from required checks. Rerun validation for one open PR so the deployed review workflow publishes `opencode-review-gate`; confirm the successful review workflow triggers sweep afterward.

For PR #49, expect a normal skip or merge rejection until its human review conversation is manually resolved. For PR #50, expect merge once the new gate is successful and all other protections pass.
