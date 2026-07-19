# User Activity Calendar Design

## Context

LeetCode Progress Radar is a static Next.js dashboard for a small study group. Progress is generated at build time by `scripts/build-progress.mjs`, written to `data/progress.json`, and rendered by server components in `app/page.tsx`, `app/users/[userId]/page.tsx`, and `app/lists/[listKey]/page.tsx`.

The dashboard already shows aggregate progress by user and list. The next operator-facing feature should make consistency visible without requiring participants to maintain extra metadata.

## Goal

Add a user-by-user activity calendar that shows which days each participant added solved submissions. The feature should help the study operator quickly see recent study health and participation cadence.

## Non-Goals

- Do not add authentication, live database reads, or runtime GitHub API calls.
- Do not require participants to write `meta.json.solvedAt`.
- Do not implement streak scoring in this first version.
- Do not count branch-only submissions that have not been merged into the built branch.

## Activity Source

Use Git commit history as the source of truth for activity dates.

For each counted submission, derive the activity timestamp from the first commit that added its submission artifact:

1. Prefer `solutionPath` when present.
2. Fall back to the submission `meta.json` path when there is no solution file.
3. Run `git log --diff-filter=A --format=%cI -- <path>` and use the oldest returned commit timestamp for that path.
4. Convert timestamps to `Asia/Seoul` calendar dates for display and grouping.

If Git history is unavailable or a path has no add commit, keep the submission in progress totals but omit it from the activity calendar. The build should not fail solely because activity dates cannot be derived.

## Data Model

Extend generated `data/progress.json` with per-user daily activity:

```ts
type ActivityDay = {
  date: string; // YYYY-MM-DD in Asia/Seoul
  solved: number;
  submissions: Array<{
    problemSlug: string;
    sourceKey: string;
    submissionKey: string;
  }>;
};
```

Each `ProgressUser` receives an `activity` array sorted by date ascending. A canonical problem is counted once per user, matching the existing progress aggregation behavior. Only `SOLVED` submissions count toward daily activity.

`lib/progress.ts` should expose calendar-ready data, including:

- a recent window for the home dashboard, defaulting to the last 35 days;
- per-user totals inside that window;
- the maximum daily count, for intensity styling;
- all historical activity for the user detail page.

## UI

Add an operator-facing section to the home dashboard after the summary cards and before the existing user table.

The section shows one row per active user:

- user name and GitHub handle;
- recent 35-day activity calendar;
- total solved submissions in the recent window;
- last active date, or an empty state if no activity is known.

Calendar cells use restrained intensity levels based on the daily solved count. Empty days remain visible so gaps are obvious. Each cell has an accessible label with the date and solved count.

On the user detail page, add a wider activity calendar section above the per-list tables. It shows the last 90 days, using the same data and styling primitives.

## Build And CI

The GitHub Pages workflow must checkout full history so build-time Git lookup works:

```yaml
- name: Checkout
  uses: actions/checkout@v6
  with:
    fetch-depth: 0
```

Local builds without full history should still succeed. In that case, calendars may show fewer or no activity dates.

## Error Handling

- If `git` is unavailable, emit a warning and build progress without activity data.
- If a single path lookup fails, skip that path and continue.
- If multiple submissions map to the same canonical problem, use the retained submission from the existing ranking rules before activity aggregation.
- Invalid `meta.json` entries remain visible through existing progress handling but do not count as solved activity unless their normalized status is `SOLVED`.

## Testing

Add focused tests around `scripts/build-progress.mjs`:

- activity dates are derived from Git add commits;
- daily activity groups multiple solved submissions on the same Seoul date;
- reviewing and skipped submissions do not count;
- missing Git history does not fail the progress build.

Add typecheck/build verification after implementation.

## Fixed Decisions

The initial UI window is fixed at 35 days on the home dashboard and 90 days on user detail. These values can become configurable later if operators ask for it.
