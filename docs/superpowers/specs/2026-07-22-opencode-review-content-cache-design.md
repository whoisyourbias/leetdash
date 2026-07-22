# OpenCode Review Content Cache Design

## Goal

Avoid calling OpenCode again when a pull request is reopened or its review workflow is rerun and a previously successful file review still matches the file's exact contents.

## Scope

This change extends the managed per-file PR comments introduced by the Korean Chalsakbot review flow. It does not add an external cache, change workflow triggers, alter the informational check conclusion, or reuse prior warnings.

## Managed Comment Metadata

Keep the existing path-derived marker unchanged so existing file comments remain discoverable:

```text
<!-- leetdash-opencode-review-file:<path-sha256> -->
```

Successful file comments add a second leading metadata marker:

```text
<!-- leetdash-opencode-review-content:<content-sha256> -->
```

The content digest is SHA-256 over the exact UTF-8 source text returned from the trusted GitHub contents API. Warning comments omit the content marker. This makes warnings retryable on every later workflow run.

## Cache Decision

For every current `solution.*` target, the orchestrator still reads the trusted source before deciding whether to call OpenCode.

1. Compute the source content digest.
2. Find the existing managed comment by its path-derived key.
3. Reuse the comment only when it contains a valid content marker with the same digest.
4. Otherwise call OpenCode and immediately update or create the file comment.

A reused review does not call OpenCode and does not rewrite its existing file comment. It contributes to a separate `리뷰 유지` count in the summary.

## Compatibility and Failure Behavior

- Existing comments without content metadata are reviewed once and upgraded.
- Existing warning comments are reviewed again because they have no content digest.
- A changed file always receives a new review and updates the existing path-specific comment.
- A malformed content marker is treated as a cache miss.
- If managed-comment discovery fails, no cache decision is possible. The orchestrator reviews each file as today but avoids comment mutations to prevent duplicates.
- Stale managed file comments are still deleted after all current targets have been attempted or reused.
- Comment delivery failures remain informational and do not expose provider request IDs.

## Interfaces

`parseManagedReviewMarker()` returns an optional `contentKey` for managed file comments. `renderReviewFileComment()` accepts the trusted source content digest and emits the content marker. `reviewPullRequest()` reads each source once, compares its digest with the discovered comment, and only delegates cache misses to the OpenCode review path.

## Testing

- Same path and same content digest skips OpenCode and preserves the existing file comment.
- Same path with changed content calls OpenCode and updates the same comment ID.
- A prior warning, legacy marker, or malformed digest calls OpenCode again.
- Multiple files can mix reused and newly reviewed results while preserving sequential delivery.
- Summary counts distinguish newly completed, reused, warning, and delivery-failure results.
- Existing stale-comment cleanup and comment-discovery failure behavior remain covered.

## Security

The digest is computed locally from trusted source retrieval and is never accepted as proof from the pull request author. Cache metadata is recognized only on comments authored by `github-actions[bot]`, using the existing exact-leading-marker rules. No OpenCode response or untrusted Markdown is allowed to create an active cache marker.
