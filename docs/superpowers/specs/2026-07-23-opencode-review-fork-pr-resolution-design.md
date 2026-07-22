# OpenCode Review Fork PR Resolution Design

## Problem

`OpenCode Submission Review` runs after `Deploy GitHub Pages` through a
`workflow_run` trigger so that review secrets are available only to trusted
default-branch code. The workflow currently reads the pull request number and
base/head SHAs exclusively from
`github.event.workflow_run.pull_requests[0]`.

For pull requests whose head repository is a fork, GitHub can deliver the
completed `workflow_run` event without a usable `pull_requests[0]` entry. The
upstream validation succeeds, but the review job is skipped by its job-level
condition. No `opencode-review` check is created, so branch protection and the
submission sweeper leave the pull request blocked.

## Goals

- Run the trusted OpenCode review for successful validation runs from both
  same-repository and fork pull requests.
- Keep secrets and executable code isolated from fork-controlled revisions.
- Resolve exactly one open pull request for the triggering head repository,
  branch, and commit SHA before starting the review.
- Preserve the existing exact base/head SHA validation in
  `loadTrustedPullRequestScope`.
- Fail closed when the workflow-run metadata cannot identify one pull request.

## Non-goals

- Do not use `pull_request_target`.
- Do not execute files, actions, package hooks, or scripts from the pull request
  head.
- Do not change OpenCode prompts, response handling, review comments, required
  checks, or sweeper eligibility.
- Do not add an artifact handoff from the validation workflow.

## Chosen Approach

The workflow first checks out the repository default branch with credentials
disabled. It then runs trusted repository code that queries the GitHub Pulls
API using the workflow-run head owner and branch. The resolver filters the API
result to one open pull request whose head repository, head branch, head SHA,
base repository, and base branch all exactly match the workflow-run and target
repository metadata.

The workflow passes metadata through environment variables rather than
interpolating fork-controlled branch or repository names into shell source.
The resolver writes only the validated pull request number and base/head SHAs
to `GITHUB_OUTPUT`. A second checkout moves to the validated base SHA, again
with persisted credentials disabled, and the existing review script receives
those outputs.

This keeps the security property of the current architecture: the secret-bearing
job executes only code from the base repository. Pull request source remains
data fetched at an exact, verified head SHA.

## Components

### Pull request resolver

Add `scripts/resolve-opencode-review-pr.mjs` with a pure selection helper, a
small GitHub Pulls API client, and a CLI entry point suitable for GitHub
Actions. Add its unit coverage in
`tests/resolve-opencode-review-pr.test.mjs`.

Inputs:

- Base repository full name from `GITHUB_REPOSITORY`.
- Base branch from `github.event.repository.default_branch`.
- Head repository full name from
  `github.event.workflow_run.head_repository.full_name`.
- Head branch from `github.event.workflow_run.head_branch`.
- Head SHA from `github.event.workflow_run.head_sha`.
- GitHub token and `GITHUB_OUTPUT` path.

Behavior:

1. Validate repository names, branch names, and the 40-character head SHA.
2. Query open pull requests with `head=<owner>:<branch>` and
   `base=<default-branch>`.
3. Filter the response by exact base repository, base branch, head repository,
   head branch, and head SHA.
4. Require exactly one match.
5. Write `pull-number`, `base-sha`, and `head-sha` outputs.
6. Return a non-zero exit code with a sanitized diagnostic on missing,
   malformed, ambiguous, or failed API results.

The existing `opencode-review.mjs` scope loader remains the second trust check:
it re-fetches the chosen pull request and verifies its number, base SHA, head
SHA, head repository, author, and complete file list before reviewing content.

### Workflow

Change the job-level condition to depend only on a successful upstream
`pull_request` run. Do not gate on `workflow_run.pull_requests[0]`.

The job sequence becomes:

1. Checkout the trusted default branch with `persist-credentials: false`.
2. Resolve the triggering pull request through trusted code and GitHub REST.
3. Checkout the resolved pull request base SHA with
   `persist-credentials: false`.
4. Invoke the existing review CLI with resolved number/base/head outputs.

The concurrency key uses stable workflow-run metadata instead of the missing
pull-request array, combining the head repository and head SHA.

## Error Handling

- Resolver configuration errors and GitHub API failures stop the job before an
  OpenCode request.
- Zero or multiple exact matches stop the job. The resolver never guesses.
- The review script retains its current explicit `opencode-review` check
  lifecycle after resolution succeeds.
- Diagnostics must not include tokens, response bodies, or submitted source.

## Testing

- Unit-test exact matching for a fork pull request.
- Unit-test rejection of zero, ambiguous, mismatched-repository,
  mismatched-branch, and mismatched-SHA results.
- Test pagination/API request construction where the client boundary changes.
- Update workflow contract tests to require trusted default-branch checkout,
  resolver invocation, output-based base checkout and review arguments, and no
  `pull_requests[0]` or `pull_request_target` dependency.
- Run the targeted resolver/workflow tests, all OpenCode review tests, then the
  full test suite and typecheck.

## Live Verification

After the change reaches the default branch, re-run validation for pull
requests #49 and #50 or push a harmless commit to each fork branch. Success is:

- The review job is no longer skipped.
- An `opencode-review` check is created for each exact fork head SHA.
- Review comments are produced for reviewable submission files.
- The sweeper sees successful `validate` and `opencode-review` checks.
