# OpenCode Per-File Korean Review Design

## Context

The `OpenCode Submission Review` workflow currently reviews every added or modified `solution.*` file sequentially, waits for all model requests to finish, and then writes one aggregate pull-request comment. If a later file fails, the workflow replaces the aggregate output with one warning, so completed reviews from earlier files are no longer visible. The current prompt also requests English section headings and does not require Korean prose.

This change keeps the review informational while publishing each file's result as soon as its OpenCode request finishes. It also makes Korean the required review language.

## Goals

- Publish a managed pull-request comment immediately after each changed `solution.*` file is reviewed.
- Preserve completed file reviews when another file later fails.
- Continue reviewing remaining files after a path, source, model-request, or model-response failure for one file.
- Update the same file-specific comment on workflow reruns instead of creating duplicates.
- Request concise Korean Markdown from OpenCode while preserving code identifiers, paths, and Big-O notation.
- Keep one compact managed summary comment for the current head commit.
- Preserve the existing trusted-scope validation and informational check semantics.

## Non-goals

- Creating inline comments on GitHub diff lines.
- Replacing the fixed `github-actions[bot]` GitHub identity with a GitHub App or personal bot account.
- Reviewing `README.md`, `meta.json`, deleted files, renamed files, or unchanged solution files.
- Running file reviews in parallel.
- Combining multiple files into one model prompt or adding cross-file reasoning.
- Making model findings block automatic merging.

## Comment branding

The human-facing review persona is `찰싹봇`. GitHub still records every managed comment as authored by `github-actions[bot]`; the workflow does not add GitHub App credentials or another account token.

File and summary comments render a compact trusted header containing:

- the `찰싹봇` name;
- the selected red-devil coach mascot;
- the reviewed file path or run summary title.

The final mascot asset is stored at `public/chalsakbot.png`. Comment rendering builds an immutable image URL from the trusted repository name and checked-out base SHA, so old comments retain the image version used by their workflow run. The image is decorative and receives descriptive Korean alt text. If GitHub cannot load the image, the bot name and review content remain fully usable.

The mascot is presentation-only. It is never included in the OpenCode prompt, model response, trust decision, or merge eligibility.

## Comment model

The workflow maintains two comment types, all authored by `github-actions[bot]`:

1. One file comment per reviewed solution path.
2. One summary comment for the workflow run.

Each file comment uses a stable hidden marker derived from a SHA-256 digest of the repository-relative path:

```html
<!-- leetdash-opencode-review-file:<path-digest> -->
```

The digest prevents path-controlled text from being embedded in the marker. The visible comment includes the exact sanitized path and triggering head SHA. A rerun for the same path updates the existing bot-authored comment even when the head SHA changes.

The existing aggregate marker remains the summary marker:

```html
<!-- leetdash-opencode-review -->
```

This lets the first run after deployment replace the old aggregate review comment with the new compact summary rather than leaving a duplicate legacy comment.

The workflow only updates or deletes comments that have the expected marker and were authored by `github-actions[bot]`. User-authored marker lookalikes remain untouched.

## Review flow

1. Create the `opencode-review` check for the exact triggering head SHA.
2. Re-fetch the pull request and its complete changed-file list from GitHub.
3. Verify the PR number, base SHA, head SHA, head repository, author, file count, ownership, paths, and catalog mappings using trusted base-branch code and data.
4. For a non-submission PR, complete the check successfully as not applicable without calling OpenCode or managing review comments.
5. Select added or modified `solution.*` files in GitHub's returned order.
6. Load existing managed bot comments once and index file comments by their path digest.
7. Process selected files sequentially:
   - parse the submission path;
   - fetch the source from the verified fork repository at the exact head SHA;
   - build a prompt containing only that path, language, and source;
   - call OpenCode;
   - sanitize the returned Markdown;
   - immediately create or update that file's managed comment;
   - record the per-file status for the final summary.
8. If a file fails during path parsing, source loading, model request, or model response handling, create or update that file's comment with a sanitized warning and continue with the next file.
9. After every target file has been attempted, remove bot-authored managed file comments whose paths are no longer in the current changed-solution set.
10. Create or update the summary comment with counts for reviewed files, warnings, and comment-delivery failures.
11. Complete the check with the existing informational semantics.

The summary is written after all file attempts. File comments are durable incremental output and do not wait for that final step.

## Korean prompt contract

Each file still receives an independent prompt. The prompt requires Markdown with these headings in order:

```markdown
#### 요약
#### 잠재적 위험
#### 복잡도
#### 가독성
```

All explanations and suggestions must be natural Korean. Source identifiers, API names, repository paths, language keywords, and Big-O expressions remain unchanged where translating them would reduce precision. When no finding exists, the model writes `제출 코드만으로 확인된 사항 없음.`

The existing limitations remain explicit in the prompt: the model receives no problem statement, expected behavior, platform contract, or input limits, so it must not make correctness verdicts or assume required signatures.

## Failure semantics

The review remains informational:

- Possible risks and readability suggestions do not fail the check.
- A per-file path, source, OpenCode, timeout, or response failure produces a sanitized file warning, processing continues, and the completed check remains successful.
- A failure to deliver one file comment is recorded in the final summary and processing continues. It does not change an otherwise successful informational check.
- Failure before trusted PR scope is established keeps the fail-closed behavior and fails the check.
- Failure to create or complete the GitHub check is not swallowed; the Actions job fails.
- If the 45-minute job timeout stops the workflow, the check cannot complete successfully and the sweeper cannot merge the PR.

OpenCode retains its 180-second timeout per file. Sequential processing is intentional so request volume and comment ordering remain predictable.

## Comment size and sanitization

Model Markdown continues to be sanitized before publication:

- HTML and control characters are escaped or removed;
- mentions and active links are neutralized;
- submitted source echoed by the model is redacted;
- untrusted text cannot create the managed marker;
- each file comment is truncated to the existing safe GitHub comment limit with a visible truncation notice.

Failure comments contain only stable stage, reason, detail, retryability, optional HTTP status, optional request ID, commit SHA, and workflow URL. They never include secrets, authorization headers, raw provider bodies, exception messages, or submitted source.

## Components

### `scripts/opencode-review-core.mjs`

- Add stable file-marker generation.
- Render branded Korean file review comments, per-file warnings, and the compact final summary.
- Retain Markdown sanitization, source redaction support, and comment-length bounds.

### `scripts/opencode-review-clients.mjs`

- Replace the single-comment lookup with managed-comment discovery that distinguishes summary and file markers.
- Add create/update operations using the discovered comment IDs.
- Add deletion of stale bot-authored managed file comments.
- Preserve pagination, author checks, safe error conversion, and API response redaction.

### `scripts/opencode-review.mjs`

- Change the file loop to isolate errors per file.
- Publish each success or warning immediately.
- Continue after an individual file failure.
- Track reviewed, warned, and delivery-failed counts.
- Reconcile stale managed file comments only after the current target set is known and every target has been attempted.
- Publish the final managed summary and complete the check.

### `public/chalsakbot.png`

- Store the approved square `찰싹봇` mascot image as a project asset.
- Use the trusted base SHA when constructing the image URL embedded in GitHub comments.

## Testing

Tests must cover:

- two changed solutions causing two sequential OpenCode calls and two immediate file-comment writes;
- the first file comment existing before the second OpenCode request begins;
- a failure on one file producing a warning while later files are still reviewed;
- reruns updating matching file comments without duplicates;
- different paths receiving different stable markers;
- user-authored marker spoof comments remaining untouched;
- stale bot-authored file comments being deleted only after successful trusted-scope discovery;
- the legacy aggregate comment becoming the summary comment;
- `찰싹봇` name, Korean alt text, trusted base-SHA image URL, and graceful text-only fallback;
- no new GitHub App, PAT, or elevated workflow permission being introduced;
- Korean headings and Korean-only prose instructions in the model prompt;
- source identifiers and Big-O notation being allowed unchanged;
- Markdown sanitization, source redaction, mention/link neutralization, and per-comment truncation;
- file-comment delivery failure appearing in the final summary without stopping later reviews;
- trusted-scope failures continuing to fail the check;
- model findings and per-file operational warnings continuing to complete the informational check successfully;
- non-submission and no-solution PR behavior;
- workflow permissions, exact-head source reads, required checks, and sweeper behavior remaining unchanged.

## Acceptance criteria

- A PR with multiple changed solution files receives one managed review comment per file as each API response completes.
- A failed file review does not hide earlier results or prevent later file reviews.
- Workflow reruns update existing file comments and the existing summary comment without creating duplicates.
- Comments for solution paths no longer present in the current review target set are removed safely.
- OpenCode review prose and headings are requested in Korean.
- File and summary comments display the `찰싹봇` name and approved mascot while remaining authored by `github-actions[bot]`.
- Review findings and per-file service warnings remain informational, while untrusted or incomplete PR snapshots remain merge-blocking.
