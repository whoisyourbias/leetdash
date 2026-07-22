# Multiplatform Static Review Design

## Context

Issue #33 added a trusted-base OpenCode review workflow and an `opencode-review` merge signal. The implementation is present, but repository branch protection still requires only `validate`. Open issues #42 and #35 change the review contract and add Programmers and SWEA submissions.

The original #35 proposal depended on provider-specific problem statements and judge contracts. Issue #42 explicitly replaces that direction with a code-only informational review. Implementing both issue bodies literally would build problem-provider infrastructure and then delete it.

## Goals

- Preserve the #33 trusted-base workflow, exact-head source loading, managed comment, secret redaction, and current-head sweeper checks.
- Review only the submission path, language, and source code.
- Never infer the original problem statement, input limits, judge contract, or expected answer.
- Make handled review results and handled review failures informational, while continuing to require a completed successful `opencode-review` check.
- Add one Programmers problem and one SWEA problem to the catalog and submission paths.
- Replace global slug identity with a provider-scoped canonical key without storing third-party problem bodies.

## Non-Goals

- Fetching or storing problem statements, examples, templates, or judge metadata.
- Programmers HTML parsing, SWEA login, cookies, or repository secrets for third-party sites.
- Compiling, running, or judging submitted solutions.
- SQL and assignment-style Programmers problems.
- Review history pages or commit-SHA review persistence.
- A generic provider plugin system.

## Review Contract

The reviewer consumes only:

```text
submission_path
submission_language
submission_code
```

The model returns exactly one schema version 2 JSON object:

```json
{
  "schema_version": 2,
  "path": "submissions/ada/programmers/12906/solution.java",
  "overall": "No issue found | Possible issue | Improvement",
  "summary": "one-line review summary",
  "bug_risks": [
    {
      "category": "index-range | overflow | nullability | edge-case | condition",
      "location": "source location",
      "reason": "evidence visible in the submitted code",
      "trigger": "condition under which the risk can occur"
    }
  ],
  "complexity": {
    "time": "complexity of the submitted code",
    "space": "auxiliary-space complexity of the submitted code"
  },
  "readability": [
    {
      "category": "naming | function-split | duplication | magic-number",
      "location": "source location",
      "suggestion": "short improvement"
    }
  ]
}
```

`overall` is derived by priority:

1. `Possible issue` when `bug_risks` is non-empty.
2. `Improvement` when `bug_risks` is empty and `readability` is non-empty.
3. `No issue found` otherwise.

Complexity is always reported, but it does not by itself select `Improvement`. The schema has no verdict, correctness field, algorithm hint, blocking finding, counterexample, or acceptable flag.

The prompt forbids claims about correctness, expected outputs, platform-specific signatures, or whether complexity fits unknown limits. An `edge-case` finding must name a boundary condition visible from the code and must remain a possible risk, not a correctness verdict.

## Failure And Merge Policy

- A valid schema v2 result always completes `opencode-review` with `success`.
- Handled configuration, source-loading, model-request, model-response, and result-validation failures render a sanitized warning and also complete the check with `success`.
- Failure details never include API keys, authorization headers, environment dumps, raw provider responses, or unnecessary source code.
- Snapshot or GitHub check lifecycle failures that prevent creation or completion of the authoritative check remain workflow failures.
- The sweeper continues requiring current-head, GitHub Actions-owned, completed/success checks named `validate` and `opencode-review`, including its pre-merge refresh.
- Repository branch protection must require both contexts.

## Catalog Model

Canonical identity is `(provider, problemId)` and its serialized form is `problemKey = provider + ":" + problemId`.

```ts
type CatalogProvider = "leetcode" | "programmers" | "swea";

type CatalogProblem = {
  provider: CatalogProvider;
  problemId: string;
  problemKey: string;
  title: string;
  difficulty: string;
  sourceUrl: string;
  slug?: string;
};
```

`slug` remains optional provider-specific metadata for existing LeetCode URLs; it is not a canonical key. Catalog maps, progress IDs, submission deduplication, and activity records use `problemKey`.

Each list item references `problemKey` and retains `submissionKey`, `order`, and `section`. `sourceKey` remains the list/submission directory key. For the initial provider lists:

- `sourceKey=programmers`, `provider=programmers`, `submissionKey=12906`.
- `sourceKey=swea`, `provider=swea`, `submissionKey=1206`.

The initial problems are:

- Programmers 12906, `같은 숫자는 싫어`, difficulty `level-1`, source URL `https://school.programmers.co.kr/learn/courses/30/lessons/12906`.
- SWEA 1206, `[S/W 문제해결 기본] 1일차 - View`, difficulty `D3`, source URL `https://swexpertacademy.com/main/code/problem/problemList.do?problemTitle=1206`.

No problem content is copied into the catalog.

## Data Flow

1. Trusted-base validation loads catalog and users, verifies the complete PR file snapshot, author ownership, and `sourceKey/submissionKey` membership.
2. The reviewer parses each changed `solution.*` path only to obtain path and language.
3. Exact-head source is read as data through GitHub REST.
4. OpenCode receives path, language, and source.
5. The schema v2 response is validated and rendered into the existing managed comment.
6. Progress generation resolves list item `problemKey` references and deduplicates submissions by `problemKey`.
7. UI links use each canonical problem's `sourceUrl` and show its provider label.

## Minimal Test Strategy

- Core reviewer tests: prompt exclusions, exact schema keys/enums, overall priority, and concise comment rendering.
- Orchestration tests: no problem client call, successful informational findings, and sanitized handled failures completing success.
- Catalog tests: allowed providers, exact `problemKey` derivation, canonical uniqueness, and valid list references.
- Progress/validator tests: same numeric problem ID across providers remains distinct; both new submission paths validate.
- Existing sweeper and workflow tests remain regression coverage; no duplicate integration suite is added.
- Final verification runs the full test suite, typecheck, catalog/progress generation checks, and production build.

## Execution Order

The reviewer contract and catalog migration may be implemented in parallel because they own mostly separate files. Integration happens after both are green: the reviewer stops resolving canonical problems, while trusted validation continues enforcing catalog membership. The #42 reviewer change is committed before the #35 catalog integration.
