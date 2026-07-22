# Sweep After OpenCode Review Design

## Problem

Submission pull requests can remain open even when validation and OpenCode review succeed.

- `Sweep Submission PRs` and `OpenCode Submission Review` both start from the completed `Deploy GitHub Pages` workflow, so sweep can inspect a pull request before review finishes.
- The custom `opencode-review` Check Run can attach to an older GitHub Actions check suite after validation is rerun on the same head SHA. The sweeper scans every Check Run on the SHA and accepts the old-suite success, while branch protection evaluates the latest required check state and rejects the merge.
- Merge API failures are converted to `merge_failed` result rows without failing the workflow, so Actions reports a green sweep that merged nothing.
- PR #49 is independently blocked by an unresolved review conversation. Automation must not resolve human review threads.

## Chosen Design

### Workflow ordering

`OpenCode Submission Review` remains triggered by successful `Deploy GitHub Pages` pull-request runs. `Sweep Submission PRs` changes its automatic trigger to the completed `OpenCode Submission Review` workflow and only runs automatically when that workflow succeeds. The hourly schedule and manual dispatch remain as recovery paths.

This produces the automatic sequence:

1. Pull-request validation completes.
2. OpenCode review runs and publishes its result.
3. Sweep reevaluates every open submission pull request.
4. Eligible pull requests are merged.

### Review result channels

The existing `opencode-review` Check Run remains the detailed review record. It carries the rich summary and details URL but is no longer used as the branch-protection gate.

The review workflow also publishes a commit status with the distinct context `opencode-review-gate`:

- `pending` before review work starts
- `success` when review and GitHub delivery complete
- `failure` when review or delivery fails

The distinct name is mandatory. GitHub requires both a Check Run and a commit status when they share a required context name, which would preserve the suite-association failure.

The workflow receives `statuses: write`. Status publication targets the trusted pull request head SHA resolved by `resolve-opencode-review-pr.mjs`.

### Sweep eligibility

Validation remains an app-scoped Check Run requirement named `validate`. OpenCode eligibility changes from the `opencode-review` Check Run to the latest commit status named `opencode-review-gate`.

The sweeper fetches both Check Runs and commit statuses for the current head SHA and repeats both reads immediately before merge. It accepts the review gate only when the latest matching status is `success`. A missing, pending, failed, malformed, or ambiguous status skips the pull request.

### Failure semantics

The sweeper continues scanning after an individual merge failure so one blocked pull request cannot starve later eligible pull requests. It writes the complete step summary and dispatches deployment for any successful merges. After those actions, if any result is `merge_failed`, the CLI exits non-zero so the workflow is visibly red.

Expected eligibility skips remain successful workflow outcomes because they are normal states, not automation failures.

### Branch protection migration

After the new workflow is available on the default branch, the `master` branch protection rule must require:

- `validate` from GitHub Actions, preserving its current app restriction
- `opencode-review-gate` from GitHub Actions

The old required `opencode-review` context must be removed in the same update. Existing review-conversation protection remains enabled.

The migration is applied only after the implementation is committed and verified. The resulting protection configuration is read back and compared with the intended two checks.

## Error Handling

- If the pending gate cannot be published, review stops because merge safety cannot be represented.
- If final status publication fails, the workflow fails and sweep is not automatically triggered because it only accepts successful review workflow completion.
- If review fails after pending publication, the workflow makes a best effort to publish `failure` without hiding the original error.
- Merge failures are reported per pull request and make the sweep job fail after all candidates are processed.
- Human review conversations are never mutated by automation.

## Testing

Automated tests cover:

- workflow ordering from OpenCode review completion to sweep
- `statuses: write` permission
- pending, success, and failure gate publication
- preservation of the detailed `opencode-review` Check Run
- latest commit-status selection and rejection of missing or non-success gates
- refreshed status retrieval immediately before merge
- continued scanning after merge failure followed by a non-zero CLI outcome

The full repository test suite, type checks, and production build run after the focused regression tests pass.

## Out of Scope

- Automatically resolving PR #49's human review conversation
- Changing participant submission validation rules
- Replacing branch protection with a ruleset or merge queue
- Automatically pushing or merging the implementation branch
