# OpenCode Raw Response Artifact Design

## Context

The trusted OpenCode review workflow currently preserves only sanitized failure diagnostics. That protects submitted source and model-generated text, but it prevents diagnosis when an invalid response violates the schema in a way that the fixed `field` and `issue` labels cannot fully describe.

This design intentionally changes that retention policy. The repository is public, and the user has accepted that a raw-response artifact is accessible to people who can read the repository's Actions artifacts.

## Goal

Preserve the exact model response that fails response parsing or result-invariant validation as a GitHub Actions artifact for 90 days, without printing that response in the Actions console, check-run summary, or pull-request comment.

## Non-goals

- Do not store successful model responses.
- Do not store valid `FAIL` review results; those are normal review outcomes and are already rendered through the sanitized review comment.
- Do not create an artifact when the model request fails before a response is returned.
- Do not encrypt the artifact or make it private.
- Do not change the review schema, verdict policy, timeout, or existing sanitized diagnostics.

## Approaches Considered

### 1. Failure-only Actions artifact (selected)

Write the invalid raw response to a runner-temporary file and upload it only after the review step fails. This preserves exact evidence while keeping untrusted output out of logs and comments.

### 2. Store every model response

This provides a complete audit trail but unnecessarily retains successful reviews, increases storage, and broadens public exposure.

### 3. Print the response to the Actions console

This is mechanically simpler, but it mixes untrusted model output with workflow logs and requires workflow-command suppression. It also makes accidental disclosure harder to control.

## Selected Architecture

### Response capture

`scripts/opencode-review.mjs` will accept a trusted raw-response output path from `OPENCODE_RAW_RESPONSE_PATH`. Immediately after `OpenCodeClient.review` returns, the existing parser will run inside a narrow `try`/`catch` boundary.

If `parseReviewResult` throws either:

- `MODEL_RESPONSE_INVALID` at stage `model-response`, or
- `REVIEW_RESULT_INVALID` at stage `result-validation`,

the script will write the exact returned JavaScript string as UTF-8 to the configured path. It will create the parent directory when needed. It will then rethrow the original `ReviewFailure`, preserving the current check-run and PR-comment behavior.

No response is written for a successful parse, a valid blocking verdict, or a request failure with no response.

### Capture failure behavior

Failure to create the diagnostic file must not replace or hide the original review failure. The script will suppress the file-system error and rethrow the original `ReviewFailure`. The artifact upload step will tolerate a missing file, so the primary review result remains authoritative.

### Workflow integration

`.github/workflows/opencode-review.yml` will:

1. Set `OPENCODE_RAW_RESPONSE_PATH` to `${{ runner.temp }}/opencode-review/raw-model-response.txt` for the trusted review step.
2. Add a later step guarded by `if: failure()`.
3. Upload that one file using `actions/upload-artifact@v4`.
4. Name the artifact `opencode-review-raw-response-${{ github.run_id }}`.
5. Set `if-no-files-found: ignore` so request failures and valid code-review failures do not create a secondary failure.
6. Set `retention-days: 90`.

The repository, organization, or enterprise Actions retention limit must permit 90 days. GitHub does not allow an artifact's `retention-days` value to exceed that configured limit.

## Security and Exposure

- The raw response will never be passed to `console.log`, `console.error`, `$GITHUB_STEP_SUMMARY`, a check-run output, or a pull-request comment.
- The output path comes from the trusted base-branch workflow, not pull-request code.
- The workflow continues to check out and execute only the trusted pull-request base revision.
- The artifact is deliberately unencrypted and readable under the public repository's artifact access policy.
- Deleting the workflow run also deletes its associated artifact; repository writers may delete an artifact earlier when necessary.

## Testing Strategy

### Script tests

- An invalid JSON response is written byte-for-byte to the configured path.
- A response that parses but violates result invariants is also written.
- A valid `PASS` response is not written.
- A valid blocking `FAIL` response is not written.
- A model-request failure with no response is not written.
- A raw-response file write failure preserves the original sanitized review failure.
- The raw response remains absent from comments, check summaries, and step summaries.

### Workflow tests

- The trusted review step supplies `OPENCODE_RAW_RESPONSE_PATH` under `${{ runner.temp }}`.
- The upload step uses `actions/upload-artifact@v4` and runs only after failure.
- The artifact path is the single raw-response file.
- `if-no-files-found` is `ignore`.
- `retention-days` is exactly `90`.
- The workflow does not print or interpolate the raw file contents.

## Acceptance Criteria

- A schema-invalid or invariant-invalid model response produces one downloadable artifact containing the exact response.
- The artifact expires after 90 days when the repository retention limit allows it.
- No successful or ordinary blocking review creates a raw-response artifact.
- Existing sanitized diagnostics remain unchanged.
- The complete automated test suite passes.

## References

- [GitHub: Store and share data with workflow artifacts](https://docs.github.com/actions/configuring-and-managing-workflows/persisting-workflow-data-using-artifacts)
- [GitHub: Configuring artifact retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts#setting-the-retention-period-for-an-artifact)
