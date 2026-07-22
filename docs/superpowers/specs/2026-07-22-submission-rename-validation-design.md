# Submission Rename Validation Design

## Goal

Allow contributors to correct submission artifact filenames without weakening submission ownership, catalog, path, or deletion checks.

## Behavior

- Accept GitHub pull-request files whose status is `renamed` when the destination path belongs to the PR author, targets a catalog entry, and ends in a supported artifact name.
- Validate the destination as the effective changed file. The source name may be invalid, which permits typo correction.
- Reject a rename whose destination moves into another participant's submission tree.
- Continue rejecting deleted files.
- Keep added and modified file behavior unchanged.

## Local Diff Handling

The validator currently invokes `git diff --no-renames`, which converts a rename into a rejected deletion plus an addition. Remove that option so Git can report ordinary renames as `R<score>`, and extend the name-status parser to retain the destination path. Explicit changed-file fixtures continue to support GitHub-style `renamed` entries through the shared validator.

## Sweeper Consistency

The automatic merge sweeper receives GitHub API file objects. It will accept `status: renamed` and validate `filename` as the destination. It will not treat `previous_filename` as an independently changed path, because ownership and artifact safety are enforced on the final repository state and deletions remain separately forbidden.

## Tests

- A real Git rename from an invalid artifact name to `Solution.java` passes the command-line validator.
- A GitHub-style rename to a valid destination passes sweeper eligibility.
- Rename into another user's path remains rejected by destination ownership validation.
- Existing deletion rejection tests remain green, with an updated deletion-only diagnostic.
