# User Activity Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static, Git-history-derived user activity calendar to the operator dashboard and user detail pages.

**Architecture:** `scripts/build-progress.mjs` enriches each generated user with solved activity grouped by `Asia/Seoul` date from first Git add commits. `lib/activity.ts` converts generated activity into fixed calendar windows for page rendering. A small server component renders the read-only calendar on the home dashboard and user detail page.

**Tech Stack:** Next.js 16 static export, React 19 server components, TypeScript 5.9, Node.js build script, Vitest, lucide-react, global CSS.

## Global Constraints

- Use Git commit history as the source of truth for activity dates.
- Prefer `solutionPath` when present; fall back to the submission `meta.json` path when there is no solution file.
- Use `git log --diff-filter=A --format=%cI -- <path>` and the oldest returned timestamp for the path.
- Convert timestamps to `Asia/Seoul` calendar dates before grouping.
- Count only `SOLVED` submissions toward daily activity.
- Keep branch-only submissions out of the official calendar because the static build only sees the checked-out branch.
- Do not add authentication, live database reads, or runtime GitHub API calls.
- Do not require participants to write `meta.json.solvedAt`.
- Do not implement streak scoring.
- Home dashboard activity window is 35 days.
- User detail activity window is 90 days.
- If Git history is unavailable or a path lookup fails, build progress successfully and omit unavailable activity dates.
- GitHub Pages checkout must use `fetch-depth: 0`.

---

## File Structure

- Modify `scripts/build-progress.mjs`: derive per-user solved activity from Git add timestamps and write it into `data/progress.json`.
- Modify `tests/build-progress.test.ts`: cover Git-based activity grouping and non-Git fallback behavior.
- Modify `lib/types.ts`: add generated activity types to `ProgressUser`.
- Create `lib/activity.ts`: build fixed calendar windows, date keys, totals, max intensity, and last-active dates for UI.
- Create `tests/activity.test.ts`: verify `lib/activity.ts` date conversion and calendar window behavior.
- Modify `lib/progress.ts`: attach 35-day and 90-day activity windows to dashboard and user detail data.
- Create `app/components/activity-calendar.tsx`: render read-only calendar cells with accessible labels.
- Modify `app/page.tsx`: add operator-facing activity calendar section between summary cards and user table.
- Modify `app/users/[userId]/page.tsx`: add 90-day activity calendar section above per-list tables.
- Modify `app/globals.css`: add responsive, stable-dimension activity calendar styles.
- Modify `.github/workflows/deploy-pages.yml`: checkout full Git history.
- Modify `README.md`: document activity calendar source and full-history CI requirement.

---

### Task 1: Generate Activity From Git History

**Files:**
- Modify: `tests/build-progress.test.ts`
- Modify: `scripts/build-progress.mjs`

**Interfaces:**
- Consumes: existing `collectUserSubmissions({ user, submissionTargets, allPaths, generatedAt })` output.
- Produces: generated user objects shaped as `{ ...user, submissions, activity }`.
- Produces: `activity: Array<{ date: string; solved: number; submissions: Array<{ problemSlug: string; sourceKey: string; submissionKey: string }> }>` sorted by `date` ascending.

- [ ] **Step 1: Write failing generator tests**

Add these helper functions near the existing `writeJson` helper in `tests/build-progress.test.ts`:

```ts
async function runGit(repo: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  await execFileAsync("git", args, {
    cwd: repo,
    env: { ...process.env, ...env },
  });
}

async function commitAll(repo: string, message: string, timestamp: string) {
  const env = {
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_DATE: timestamp,
  };

  await runGit(repo, ["add", "."], env);
  await runGit(repo, ["commit", "-m", message], env);
}
```

Add this test inside the existing `describe("build-progress", () => { ... })` block:

```ts
it("builds per-user daily activity from git add timestamps", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "progress-radar-git-"));
  await mkdir(path.join(repo, "data"), { recursive: true });
  await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "546"), { recursive: true });
  await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "721"), { recursive: true });
  await mkdir(path.join(repo, "submissions", "ada", "leetcode-75", "1768"), { recursive: true });

  await runGit(repo, ["init"]);
  await runGit(repo, ["config", "user.email", "study@example.com"]);
  await runGit(repo, ["config", "user.name", "Study Bot"]);

  await writeJson(path.join(repo, "data", "problem-catalog.json"), {
    problems: [
      { leetcodeId: 1, slug: "two-sum", title: "Two Sum", difficulty: "easy" },
      { leetcodeId: 20, slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "easy" },
      {
        leetcodeId: 1768,
        slug: "merge-strings-alternately",
        title: "Merge Strings Alternately",
        difficulty: "easy",
      },
    ],
    lists: [
      {
        key: "top-interview-easy",
        items: [
          { slug: "two-sum", order: 1, section: "Array", submissionKey: "546" },
          { slug: "valid-parentheses", order: 2, section: "Others", submissionKey: "721" },
        ],
      },
      {
        key: "leetcode-75",
        items: [{ slug: "merge-strings-alternately", order: 1, section: "Array / String", submissionKey: "1768" }],
      },
    ],
  });
  await writeJson(path.join(repo, "data", "users.json"), {
    users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
  });

  await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "546", "solution.ts"), "// solved\n");
  await commitAll(repo, "add two sum", "2026-07-17T15:30:00.000Z");

  await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "721", "Solution.java"), "// solved\n");
  await writeJson(path.join(repo, "submissions", "ada", "leetcode-75", "1768", "meta.json"), {
    status: "reviewing",
    notes: "Does not count as solved activity.",
  });
  await commitAll(repo, "add valid parentheses and reviewing meta", "2026-07-18T02:10:00+09:00");

  await execFileAsync(process.execPath, [scriptPath], {
    cwd: repo,
    env: { ...process.env, SOURCE_REPOSITORY_URL: "https://github.com/example/progress", BRANCH: "master" },
  });

  const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
  expect(progress.users[0].activity).toEqual([
    {
      date: "2026-07-18",
      solved: 2,
      submissions: [
        { problemSlug: "two-sum", sourceKey: "top-interview-easy", submissionKey: "546" },
        { problemSlug: "valid-parentheses", sourceKey: "top-interview-easy", submissionKey: "721" },
      ],
    },
  ]);
});
```

In the existing `builds per-user progress from checked-in submission folders` test, add this assertion after the `toMatchObject` assertion for `progress.users[0]`:

```ts
expect(progress.users[0].activity).toEqual([]);
```

- [ ] **Step 2: Run the generator tests and verify they fail**

Run:

```bash
npm test -- tests/build-progress.test.ts
```

Expected result: the new Git activity test fails because `progress.users[0].activity` is missing.

- [ ] **Step 3: Implement Git timestamp lookup and activity aggregation**

In `scripts/build-progress.mjs`, add these imports at the top:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";
```

Add this constant after the existing `ignoredDirectories` constant:

```js
const execFileAsync = promisify(execFile);
const gitAddedAtCache = new Map();
let warnedAboutGitActivity = false;
const seoulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
```

Add these helper functions after `blobUrl(relativePath)`:

```js
function warnGitActivity(message) {
  if (warnedAboutGitActivity) {
    return;
  }

  warnedAboutGitActivity = true;
  console.warn(message);
}

function toSeoulDateKey(value) {
  const parts = Object.fromEntries(
    seoulDateFormatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function getGitAddedAt(relativePath) {
  if (gitAddedAtCache.has(relativePath)) {
    return gitAddedAtCache.get(relativePath);
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--diff-filter=A", "--follow", "--format=%cI", "--", relativePath],
      { cwd: repoRoot, maxBuffer: 1024 * 1024 },
    );
    const timestamps = stdout.trim().split(/\r?\n/).filter(Boolean);
    const addedAt = timestamps.at(-1);
    gitAddedAtCache.set(relativePath, addedAt);
    return addedAt;
  } catch {
    warnGitActivity("Warning: unable to read Git history; activity calendar dates will be incomplete.");
    gitAddedAtCache.set(relativePath, undefined);
    return undefined;
  }
}

function getActivityArtifactPath({ user, submission, allPaths }) {
  if (submission.solutionPath) {
    return submission.solutionPath;
  }

  const metaPath = `${user.submissionsPath}/${submission.sourceKey}/${submission.submissionKey}/meta.json`;
  return allPaths.has(metaPath) ? metaPath : undefined;
}

async function buildUserActivity({ user, submissions, allPaths }) {
  const days = new Map();

  for (const submission of submissions) {
    if (submission.status !== "SOLVED") {
      continue;
    }

    const artifactPath = getActivityArtifactPath({ user, submission, allPaths });
    if (!artifactPath) {
      continue;
    }

    const addedAt = await getGitAddedAt(artifactPath);
    if (!addedAt) {
      continue;
    }

    const date = toSeoulDateKey(addedAt);
    const day = days.get(date) ?? { date, solved: 0, submissions: [] };
    day.solved += 1;
    day.submissions.push({
      problemSlug: submission.problemSlug,
      sourceKey: submission.sourceKey,
      submissionKey: submission.submissionKey,
    });
    days.set(date, day);
  }

  return [...days.values()].sort((left, right) => left.date.localeCompare(right.date));
}
```

Replace the `for (const user of users) { ... }` body in `buildProgress()` with:

```js
for (const user of users) {
  const submissions = await collectUserSubmissions({ user, submissionTargets, allPaths, generatedAt });
  usersWithSubmissions.push({
    ...user,
    submissions,
    activity: await buildUserActivity({ user, submissions, allPaths }),
  });
}
```

- [ ] **Step 4: Run the generator tests and verify they pass**

Run:

```bash
npm test -- tests/build-progress.test.ts
```

Expected result: all tests in `tests/build-progress.test.ts` pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add scripts/build-progress.mjs tests/build-progress.test.ts
git commit -m "feat: generate user activity from git history"
```

---

### Task 2: Add Typed Calendar Window Helpers

**Files:**
- Create: `tests/activity.test.ts`
- Create: `lib/activity.ts`
- Modify: `lib/types.ts`
- Modify: `lib/progress.ts`

**Interfaces:**
- Consumes: `ActivityDay` from `lib/types.ts`.
- Produces: `getSeoulDateKey(value: Date | string): string`.
- Produces: `buildActivityCalendar(activity: ActivityDay[], dayCount: number, endDate?: Date | string): ActivityCalendarWindow`.
- Produces: `ActivityCalendarWindow` with `{ days, totalSolved, maxSolved, lastActiveDate }`.
- Produces: dashboard users with `activityCalendar: ActivityCalendarWindow`.
- Produces: user detail data with `activityCalendar: ActivityCalendarWindow`.

- [ ] **Step 1: Write failing activity helper tests**

Create `tests/activity.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { buildActivityCalendar, getSeoulDateKey } from "@/lib/activity";
import type { ActivityDay } from "@/lib/types";

const submissions = [{ problemSlug: "two-sum", sourceKey: "top-interview-easy", submissionKey: "546" }];

describe("activity calendar helpers", () => {
  it("converts timestamps to Asia/Seoul date keys", () => {
    expect(getSeoulDateKey("2026-07-17T15:30:00.000Z")).toBe("2026-07-18");
  });

  it("builds a fixed calendar window with totals, intensity, and last active date", () => {
    const activity: ActivityDay[] = [
      { date: "2026-07-16", solved: 5, submissions },
      { date: "2026-07-17", solved: 1, submissions },
      { date: "2026-07-18", solved: 2, submissions },
    ];

    const calendar = buildActivityCalendar(activity, 3, "2026-07-19T12:00:00+09:00");

    expect(calendar.days.map((day) => day.date)).toEqual(["2026-07-17", "2026-07-18", "2026-07-19"]);
    expect(calendar.days.map((day) => day.solved)).toEqual([1, 2, 0]);
    expect(calendar.days.map((day) => day.intensity)).toEqual([2, 4, 0]);
    expect(calendar.totalSolved).toBe(3);
    expect(calendar.maxSolved).toBe(2);
    expect(calendar.lastActiveDate).toBe("2026-07-18");
  });

  it("keeps last active date even when the last activity is outside the visible window", () => {
    const activity: ActivityDay[] = [{ date: "2026-07-10", solved: 1, submissions }];

    const calendar = buildActivityCalendar(activity, 3, "2026-07-19T12:00:00+09:00");

    expect(calendar.days.map((day) => day.solved)).toEqual([0, 0, 0]);
    expect(calendar.totalSolved).toBe(0);
    expect(calendar.maxSolved).toBe(0);
    expect(calendar.lastActiveDate).toBe("2026-07-10");
  });
});
```

- [ ] **Step 2: Run the activity helper tests and verify they fail**

Run:

```bash
npm test -- tests/activity.test.ts
```

Expected result: the test run fails because `@/lib/activity` does not exist.

- [ ] **Step 3: Add generated activity types**

In `lib/types.ts`, add these types after `Submission`:

```ts
export type ActivitySubmission = {
  problemSlug: string;
  sourceKey: string;
  submissionKey: string;
};

export type ActivityDay = {
  date: string;
  solved: number;
  submissions: ActivitySubmission[];
};
```

Change `ProgressUser` in `lib/types.ts` to:

```ts
export type ProgressUser = User & {
  submissions: Submission[];
  activity: ActivityDay[];
};
```

- [ ] **Step 4: Implement calendar window helpers**

Create `lib/activity.ts` with:

```ts
import type { ActivityDay, ActivitySubmission } from "@/lib/types";

export type ActivityIntensity = 0 | 1 | 2 | 3 | 4;

export type ActivityCalendarCell = {
  date: string;
  solved: number;
  submissions: ActivitySubmission[];
  intensity: ActivityIntensity;
};

export type ActivityCalendarWindow = {
  days: ActivityCalendarCell[];
  totalSolved: number;
  maxSolved: number;
  lastActiveDate: string | null;
};

const seoulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getSeoulDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = Object.fromEntries(
    seoulDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function getIntensity(solved: number, maxSolved: number): ActivityIntensity {
  if (solved <= 0 || maxSolved <= 0) {
    return 0;
  }

  if (maxSolved === 1) {
    return 4;
  }

  return Math.max(1, Math.ceil((solved / maxSolved) * 4)) as ActivityIntensity;
}

export function buildActivityCalendar(
  activity: ActivityDay[],
  dayCount: number,
  endDate: Date | string = new Date(),
): ActivityCalendarWindow {
  const normalizedDayCount = Math.max(1, Math.floor(dayCount));
  const endDateKey = getSeoulDateKey(endDate);
  const startDateKey = addDays(endDateKey, -(normalizedDayCount - 1));
  const activityByDate = new Map(activity.map((day) => [day.date, day]));

  const rawDays = Array.from({ length: normalizedDayCount }, (_, index) => {
    const date = addDays(startDateKey, index);
    const source = activityByDate.get(date);
    return {
      date,
      solved: source?.solved ?? 0,
      submissions: source?.submissions ?? [],
    };
  });
  const maxSolved = rawDays.reduce((max, day) => Math.max(max, day.solved), 0);
  const days = rawDays.map((day) => ({
    ...day,
    intensity: getIntensity(day.solved, maxSolved),
  }));
  const totalSolved = days.reduce((sum, day) => sum + day.solved, 0);
  const lastActiveDate =
    [...activity]
      .filter((day) => day.solved > 0 && day.date <= endDateKey)
      .sort((left, right) => left.date.localeCompare(right.date))
      .at(-1)?.date ?? null;

  return {
    days,
    totalSolved,
    maxSolved,
    lastActiveDate,
  };
}
```

- [ ] **Step 5: Wire calendar windows into `lib/progress.ts`**

In `lib/progress.ts`, update imports:

```ts
import { buildActivityCalendar, type ActivityCalendarWindow } from "@/lib/activity";
import { catalog, getListProblems, type CatalogList } from "@/lib/catalog";
import progressData from "@/data/progress.json";
import { SubmissionStatus, type ActivityDay, type ProgressData, type Submission, type User } from "@/lib/types";
```

Add `activity` and `activityCalendar` to `UserDashboardRow`:

```ts
export type UserDashboardRow = User & {
  submissions: Submission[];
  activity: ActivityDay[];
  activityCalendar: ActivityCalendarWindow;
  progress: ListProgress[];
  solvedTotal: number;
  reviewingTotal: number;
  skippedTotal: number;
  recentSolvedAt: string | null;
};
```

Change `buildUserRow` to accept and expose activity:

```ts
function buildUserRow(
  user: User & { submissions: Submission[]; activity?: ActivityDay[] },
): UserDashboardRow {
  const submissions = new Map(user.submissions.map((submission) => [submission.problemSlug, submission]));
  const progress = catalog.lists.map((list) => summarizeList(list, submissions));
  const activity = user.activity ?? [];
  const recentSolvedAt =
    user.submissions
      .filter((submission) => submission.status === SubmissionStatus.SOLVED && submission.solvedAt)
      .sort((a, b) => new Date(b.solvedAt ?? 0).getTime() - new Date(a.solvedAt ?? 0).getTime())[0]?.solvedAt ?? null;

  return {
    ...user,
    activity,
    activityCalendar: buildActivityCalendar(activity, 35),
    progress,
    solvedTotal: user.submissions.filter((submission) => submission.status === SubmissionStatus.SOLVED).length,
    reviewingTotal: user.submissions.filter((submission) => submission.status === SubmissionStatus.REVIEWING).length,
    skippedTotal: user.submissions.filter((submission) => submission.status === SubmissionStatus.SKIPPED).length,
    recentSolvedAt,
  };
}
```

In `getUserDetail`, change the final return statement to:

```ts
  return { user, lists, activityCalendar: buildActivityCalendar(user.activity ?? [], 90) };
```

- [ ] **Step 6: Run helper tests and typecheck**

Run:

```bash
npm test -- tests/activity.test.ts
npm run typecheck
```

Expected result: the activity tests pass and typecheck succeeds.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add lib/activity.ts lib/progress.ts lib/types.ts tests/activity.test.ts
git commit -m "feat: add activity calendar data helpers"
```

---

### Task 3: Render Activity Calendars

**Files:**
- Create: `app/components/activity-calendar.tsx`
- Modify: `app/page.tsx`
- Modify: `app/users/[userId]/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ActivityCalendarWindow` from `lib/activity.ts`.
- Produces: `ActivityCalendar({ calendar, label }: { calendar: ActivityCalendarWindow; label: string })`.
- Produces: home page section using `user.activityCalendar`.
- Produces: user detail page section using `detail.activityCalendar`.

- [ ] **Step 1: Create the calendar component**

Create `app/components/activity-calendar.tsx` with:

```tsx
import type { ActivityCalendarWindow } from "@/lib/activity";
import { formatDate } from "@/lib/format";

export function ActivityCalendar({ calendar, label }: { calendar: ActivityCalendarWindow; label: string }) {
  return (
    <div className="activity-calendar" aria-label={label}>
      {calendar.days.map((day) => {
        const solvedLabel = day.solved === 0 ? "풀이 없음" : `${day.solved}개 풀이`;
        return (
          <span
            aria-label={`${formatDate(day.date)} ${solvedLabel}`}
            className={`activity-day activity-level-${day.intensity}`}
            key={day.date}
            title={`${formatDate(day.date)}: ${solvedLabel}`}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add the home dashboard activity section**

In `app/page.tsx`, update imports:

```tsx
import Link from "next/link";
import { Users } from "lucide-react";
import { ActivityCalendar } from "@/app/components/activity-calendar";
import { catalog } from "@/lib/catalog";
import { formatDate, formatDateTime, formatPercent } from "@/lib/format";
import { formatCatalogListTitle } from "@/lib/i18n";
import { getDashboardData } from "@/lib/progress";
```

Add this section after the closing `</section>` for the `list-grid` list averages and before the existing user table panel:

```tsx
      <section className="panel activity-panel" aria-labelledby="activity-title">
        <div className="panel-header">
          <div>
            <h2 id="activity-title">활동 달력</h2>
            <p className="panel-subtitle">최근 35일 동안 master에 추가된 풀이를 사용자별로 표시합니다</p>
          </div>
        </div>
        {data.users.length === 0 ? (
          <div className="empty">아직 등록된 활성 사용자가 없습니다. data/users.json에 참가자를 추가하세요.</div>
        ) : (
          <div className="activity-user-list">
            {data.users.map((user) => (
              <div className="activity-user-row" key={user.id}>
                <div className="user-cell">
                  <Link className="user-name" href={`/users/${user.id}`}>
                    {user.displayName}
                  </Link>
                  <span className="muted mono">@{user.githubUsername}</span>
                </div>
                <ActivityCalendar calendar={user.activityCalendar} label={`${user.displayName} 최근 35일 활동`} />
                <div className="activity-summary">
                  <span>
                    최근 35일 <strong>{user.activityCalendar.totalSolved}</strong>개
                  </span>
                  <span>최근 활동 {formatDate(user.activityCalendar.lastActiveDate)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
```

- [ ] **Step 3: Add the user detail activity section**

In `app/users/[userId]/page.tsx`, update imports:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ActivityCalendar } from "@/app/components/activity-calendar";
import { getProblemLeetCodeUrl } from "@/lib/catalog";
import { difficultyLabel, formatDate, formatPercent, statusLabel } from "@/lib/format";
import { formatCatalogListTitle, formatCatalogSection, formatProblemTitle } from "@/lib/i18n";
import { getUserDetail, listStaticUsers } from "@/lib/progress";
```

Change the detail destructuring to:

```tsx
  const { user, lists, activityCalendar } = detail;
```

Add this section after the user detail `list-grid` section and before `{lists.map((list) => (`:

```tsx
      <section className="panel activity-panel" aria-labelledby="user-activity-title">
        <div className="panel-header">
          <div>
            <h2 id="user-activity-title">활동 달력</h2>
            <p className="panel-subtitle">최근 90일 동안 master에 추가된 풀이입니다</p>
          </div>
          <div className="activity-summary compact">
            <span>
              최근 90일 <strong>{activityCalendar.totalSolved}</strong>개
            </span>
            <span>최근 활동 {formatDate(activityCalendar.lastActiveDate)}</span>
          </div>
        </div>
        <div className="activity-detail-calendar">
          <ActivityCalendar calendar={activityCalendar} label={`${user.displayName} 최근 90일 활동`} />
        </div>
      </section>
```

- [ ] **Step 4: Add responsive activity styles**

Append these styles before the existing `@media (max-width: 900px)` block in `app/globals.css`:

```css
.activity-panel {
  overflow: hidden;
}

.activity-user-list {
  display: flex;
  flex-direction: column;
}

.activity-user-row {
  align-items: center;
  border-bottom: 1px solid var(--border);
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(190px, 1.1fr) minmax(280px, 4fr) minmax(140px, auto);
  padding: 14px 18px;
}

.activity-user-row:last-child {
  border-bottom: 0;
}

.activity-calendar {
  --activity-cell-size: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.activity-day {
  border: 1px solid var(--border);
  border-radius: 3px;
  flex: 0 0 var(--activity-cell-size);
  height: var(--activity-cell-size);
  width: var(--activity-cell-size);
}

.activity-level-0 {
  background: var(--surface-muted);
}

.activity-level-1 {
  background: var(--accent-soft);
  border-color: #b5e9df;
}

.activity-level-2 {
  background: #8dded2;
  border-color: #69cfc2;
}

.activity-level-3 {
  background: #35a79a;
  border-color: #278c81;
}

.activity-level-4 {
  background: var(--accent);
  border-color: var(--accent-strong);
}

.activity-summary {
  color: var(--muted);
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 4px;
  line-height: 1.35;
}

.activity-summary strong {
  color: var(--text);
}

.activity-summary.compact {
  align-items: flex-end;
}

.activity-detail-calendar {
  padding: 18px;
}
```

Inside the existing `@media (max-width: 900px)` block, add:

```css
  .activity-user-row {
    align-items: flex-start;
    grid-template-columns: 1fr;
  }

  .activity-summary.compact {
    align-items: flex-start;
  }
```

- [ ] **Step 5: Run UI typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected result: both commands pass.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add app/components/activity-calendar.tsx app/page.tsx 'app/users/[userId]/page.tsx' app/globals.css
git commit -m "feat: render user activity calendars"
```

---

### Task 4: CI, Documentation, And Full Verification

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`
- Generated by verification: `data/progress.json`

**Interfaces:**
- Consumes: Task 1 Git history lookup behavior.
- Produces: GitHub Actions checkout with full history.
- Produces: README guidance for activity calendar generation.

- [ ] **Step 1: Update GitHub Actions checkout depth**

In `.github/workflows/deploy-pages.yml`, change the checkout step to:

```yaml
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0
```

- [ ] **Step 2: Document the activity calendar**

In `README.md`, add this paragraph after the sentence `` `npm run build`는 항상 `next build` 전에 진행 데이터 생성기를 실행합니다.``:

```md
진행 데이터 생성기는 Git 히스토리에서 각 풀이 파일의 최초 추가 커밋 날짜를 읽어 사용자별 활동 달력도 만듭니다. 풀이 파일이 없고 `meta.json`만 있는 완료 제출은 `meta.json`의 최초 추가 커밋 날짜를 사용합니다. 날짜는 Asia/Seoul 기준 일자로 묶이며, Git 히스토리를 읽을 수 없는 로컬 환경에서는 활동 달력이 비어 있을 수 있지만 빌드는 계속 진행됩니다.
```

In `README.md`, add this bullet to the deployment environment section after the existing workflow environment variable block:

```md
GitHub Actions checkout은 활동 달력 생성을 위해 `fetch-depth: 0`으로 전체 히스토리를 가져옵니다.
```

- [ ] **Step 3: Rebuild generated progress data**

Run:

```bash
npm run progress:build
```

Expected result: the command prints `Built progress for 1 users and 1 submissions.` in the current repository. `data/progress.json` includes an `activity` array for the registered user. If this detached worktree cannot resolve the add commit for the existing checked-in solution, the `activity` array is empty and the command still exits successfully.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run progress:build
npm run typecheck
npm test
npm run build
```

Expected result: all commands exit successfully.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add .github/workflows/deploy-pages.yml README.md data/progress.json
git commit -m "chore: document activity calendar build requirements"
```

---

## Final Review Checklist

- [ ] `data/progress.json` has `activity` on every generated user.
- [ ] Home dashboard renders a 35-day activity calendar for every active user.
- [ ] User detail page renders a 90-day activity calendar.
- [ ] Reviewing and skipped submissions do not add activity cells.
- [ ] Non-Git local builds do not fail because of activity lookup.
- [ ] `.github/workflows/deploy-pages.yml` uses `fetch-depth: 0`.
- [ ] `npm run progress:build`, `npm run typecheck`, `npm test`, and `npm run build` pass.
