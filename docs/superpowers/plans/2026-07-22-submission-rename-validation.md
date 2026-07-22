# Submission Rename Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow valid submission artifact renames while continuing to reject deletions and invalid destination paths.

**Architecture:** Normalize both Git name-status records and GitHub API file records into the existing validator contract. Treat a rename's destination as the changed path, then reuse ownership, catalog, and artifact-name validation without weakening deletion handling.

**Tech Stack:** Node.js 20, ECMAScript modules, TypeScript test fixtures, Vitest

## Global Constraints

- A rename is accepted only when its destination belongs to the PR author, targets a catalog entry, and uses a supported artifact name.
- The source name may be invalid.
- Moves into another participant's tree remain rejected.
- Deleted files remain rejected.
- Added and modified behavior remains unchanged.

---

### Task 1: Command-Line Validator Rename Support

**Files:**
- Modify: `tests/validate-submission-pr.test.ts`
- Modify: `scripts/validate-submission-pr.mjs`

**Interfaces:**
- Consumes: `getChangedFiles({ base, head, changedFilesPath })` internal Git diff discovery
- Produces: normalized `{ status: "R100", path: <destination> }` entries accepted by `validateSubmissionFiles`

- [ ] **Step 1: Write the failing real-Git rename test**

Add a test that initializes the fixture as a Git repository, commits an invalid `solution.jvaa`, renames it to `Solution.java`, and invokes the validator with `--base` and `--head`. Assert `submission_only=true`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/validate-submission-pr.test.ts -t "accepts a valid submission filename rename"`

Expected: FAIL because `--no-renames` yields a deleted source entry.

- [ ] **Step 3: Implement minimal Git rename parsing**

Remove `--no-renames` from the diff invocation. Update NUL parsing so `R*` and `C*` records consume source and destination paths and store the destination. Extend `isAllowedSubmissionStatus` to accept statuses beginning with `R` and GitHub status `renamed`. Change the rejection message to say deletions are forbidden.

- [ ] **Step 4: Run validator tests and verify GREEN**

Run: `npm test -- tests/validate-submission-pr.test.ts`

Expected: all validator tests pass.

- [ ] **Step 5: Commit the validator change**

Run:

```bash
git add scripts/validate-submission-pr.mjs tests/validate-submission-pr.test.ts
git commit -m "fix: allow valid submission file renames"
```

### Task 2: Automatic Merge Sweeper Consistency

**Files:**
- Modify: `tests/sweep-submission-prs.test.mjs`
- Reuse: `scripts/validate-submission-pr.mjs`

**Interfaces:**
- Consumes: GitHub API file objects normalized by `normalizePullRequestFile(file)`
- Produces: `{ status: "renamed", path: file.filename }` accepted by the shared validator

- [ ] **Step 1: Change the rename regression test to require eligibility**

Use `status: "renamed"`, an invalid `previous_filename`, and valid destination `filename`. Expect `{ eligible: true }`. Add a separate test whose destination belongs to another registered user and expect the existing ownership rejection.

- [ ] **Step 2: Run focused sweeper tests and verify RED**

Run: `npm test -- tests/sweep-submission-prs.test.mjs -t "renamed"`

Expected: the valid rename test fails because the shared status predicate rejects `renamed`.

- [ ] **Step 3: Verify Task 1's shared predicate supplies GREEN**

Run: `npm test -- tests/sweep-submission-prs.test.mjs`

Expected: all sweeper tests pass after only test expectation updates, demonstrating both paths share policy.

- [ ] **Step 4: Run full verification**

Run: `npm test`

Expected: all test files pass with zero failures.

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 5: Commit sweeper regressions**

Run:

```bash
git add tests/sweep-submission-prs.test.mjs
git commit -m "test: cover submission rename merge eligibility"
```
