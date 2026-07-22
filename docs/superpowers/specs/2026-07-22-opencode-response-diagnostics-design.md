# OpenCode Response Diagnostics Design

## Goal

Make schema-version-1 model-response failures actionable without exposing the model response, submitted source, or other attacker-controlled content.

## Scope

Change only the response-schema validation path in `scripts/opencode-review-core.mjs` and its tests. Keep the existing failure stage (`model-response`), reason (`MODEL_RESPONSE_INVALID`), retry behavior, and public failure rendering.

## Design

Each schema validator will create the existing `ReviewFailure` with a detail suffix made only from code-owned labels:

- `field`: a fixed schema path such as `response`, `summary`, `complexity.acceptable`, or `blocking_findings[].category`
- `issue`: a fixed classification such as `json-parse`, `object-shape`, `enum`, `boolean`, `non-empty-string`, or `all-null-or-all-text`

No received value, unexpected key name, raw JSON fragment, submission path, prompt, or source code will be included. Array elements use `[]`, never a response-derived index.

The diagnostic remains in `failure.detail`, so the existing check-run summary and managed PR comment show it without workflow or rendering changes.

## Alternatives Considered

1. Add structured diagnostic properties to `ReviewFailure`. This is easier to query but expands the error and rendering contracts unnecessarily.
2. Re-run validation after failure to infer the cause. This duplicates validation and can drift from the authoritative parser.
3. Attach fixed diagnostics at the point each assertion fails. This is the smallest change and is selected.

## Tests

Use table-driven parser tests to prove representative invalid responses report the expected fixed field and issue. Add adversarial strings as unexpected keys and invalid content, then assert they never appear in the failure detail or rendered infrastructure output. Existing acceptance and invariant tests must continue to pass.

## Success Criteria

- A rerun distinguishes JSON parsing, object shape, field type/value, enum, and counterexample consistency failures.
- Diagnostics identify the schema field but contain no model-generated values.
- All existing tests and the new regression tests pass.
