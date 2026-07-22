# OpenCode Review File Permalink Design

## Goal

Let readers open the complete reviewed source file at the exact reviewed commit directly from each Chalsakbot file comment.

## Scope

- Add a commit-pinned GitHub blob permalink to every successful per-file review comment.
- Add the same permalink to every per-file warning comment when the file path is known.
- Keep the existing issue-comment delivery model, managed-comment markers, review cache, summary comments, and model prompt unchanged.
- Do not create GitHub inline diff comments or split model findings into multiple comments.

## Link Source and Format

The link uses the pull request's validated head repository rather than the base repository so fork pull requests resolve correctly. Its format is:

```text
<github-server>/<head-owner>/<head-repository>/blob/<head-sha>/<encoded-path>
```

The GitHub server URL, `owner/repository`, commit SHA, and repository-relative path are validated before URL construction. Each path segment is encoded independently so directory separators remain intact while spaces and other reserved characters are safe.

## Data Flow

`loadTrustedPullRequestScope` already returns the validated `headRepository`. The CLI keeps that value and passes it, together with the GitHub server URL, into `reviewPullRequest`. The orchestrator builds a permalink for each reviewable file and supplies it to the success or warning renderer. The renderer changes the plain `파일: path` metadata row into a Markdown link whose label remains the readable path.

Direct unit-test callers may supply the repository and server URL explicitly. Missing or invalid permalink configuration is treated as a trusted-scope/configuration failure instead of emitting an unsafe or misleading URL.

## Comment and Cache Behavior

Newly created or updated file comments contain the permalink. A successful review whose content digest matches an existing managed comment remains untouched, preserving the current no-rewrite cache behavior. Such a cached legacy comment acquires the permalink only after the file content changes and the review comment is updated; this avoids turning a model-cache hit into a comment mutation.

Summary comments do not receive source links because they cover zero or more files.

## Error Handling and Security

- Only HTTPS GitHub server URLs without embedded credentials are accepted.
- Repository names must have exactly one non-empty owner/repository pair without whitespace.
- Head SHAs must be hexadecimal commit identifiers.
- Paths must be repository-relative, non-empty, and contain no empty, dot, dot-dot, or backslash segments.
- Invalid link inputs use the existing sanitized review failure path and never expose raw external response bodies or secrets.

## Tests

Tests are added before production changes and cover:

- exact permalink generation for a fork head repository and pinned SHA;
- safe encoding of individual path segments;
- rejection of unsafe server, repository, SHA, and path inputs;
- successful and warning file-comment rendering with a clickable path;
- CLI propagation of the validated head repository;
- preservation of the existing unchanged-review cache behavior;
- the full project test, type-check, and build commands.

## Success Criteria

For a newly reviewed or warned `solution.*` file, the Chalsakbot file comment displays its path as a clickable link. Opening it shows the entire file from the PR head repository at the exact SHA reviewed by the bot. Existing review ordering, cache reuse, informational check conclusion, and summary behavior remain unchanged.
