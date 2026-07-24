import { buildActivityCalendar, getSeoulDateKey, type ActivityCalendarWindow } from "@/lib/activity";
import { catalog, getList, getListProblems, getProblem, type CatalogList } from "@/lib/catalog";
import progressData from "@/data/progress.json";
import { FIRST_UNSOLVED_PROBLEM_ELEMENT_ID } from "@/lib/user-problem-focus";
import {
  SubmissionStatus,
  type ActivityDay,
  type ProgressData,
  type Submission,
  type User,
} from "@/lib/types";

export type ListProgress = {
  key: string;
  title: string;
  total: number;
  solved: number;
  reviewing: number;
  skipped: number;
  percent: number;
};

export type DashboardActivityStatus = "active" | "watch" | "idle";

export type UserDashboardRow = User & {
  submissions: Submission[];
  activity: ActivityDay[];
  activityCalendar: ActivityCalendarWindow;
  progress: ListProgress[];
  solvedTotal: number;
  solvedLast7Days: number;
  solvedLast35Days: number;
  daysSinceLastSolved: number | null;
  activityStatus: DashboardActivityStatus;
  activityStatusLabel: string;
  activityStatusRank: number;
  reviewingTotal: number;
  skippedTotal: number;
  recentSolvedAt: string | null;
};

export type RecentSolvedSubmission = {
  id: string;
  userId: string;
  displayName: string;
  githubUsername: string;
  problemKey: string;
  problemTitle: string;
  sourceKey: string;
  listTitle: string;
  submittedAt: string;
  githubUrl?: string;
};

export type FirstUnsolvedProblemTarget = {
  elementId: typeof FIRST_UNSOLVED_PROBLEM_ELEMENT_ID;
  listKey: string;
  problemKey: string;
};

type RecentSubmissionUser = Pick<User, "id" | "displayName" | "githubUsername"> & {
  submissions: Submission[];
};

function getDateKeyTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function getDaysSinceDateKey(dateKey: string | null, endDate: Date | string) {
  if (!dateKey) {
    return null;
  }

  const endDateKey = getSeoulDateKey(endDate);
  const days = (getDateKeyTime(endDateKey) - getDateKeyTime(dateKey)) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor(days));
}

function getDashboardActivityStatus(daysSinceLastSolved: number | null): DashboardActivityStatus {
  if (daysSinceLastSolved === null || daysSinceLastSolved > 35) {
    return "idle";
  }

  if (daysSinceLastSolved > 7) {
    return "watch";
  }

  return "active";
}

function getDashboardActivityStatusLabel(status: DashboardActivityStatus) {
  const labels: Record<DashboardActivityStatus, string> = {
    active: "활발",
    watch: "주의",
    idle: "휴면",
  };

  return labels[status];
}

function getDashboardActivityStatusRank(status: DashboardActivityStatus) {
  const ranks: Record<DashboardActivityStatus, number> = {
    active: 3,
    watch: 2,
    idle: 1,
  };

  return ranks[status];
}

function summarizeList(list: CatalogList, submissions: Map<string, Submission>): ListProgress {
  const items = getListProblems(list);
  let solved = 0;
  let reviewing = 0;
  let skipped = 0;

  for (const item of items) {
    const submission = submissions.get(item.problemKey);
    if (!submission) {
      continue;
    }

    if (submission.status === SubmissionStatus.SOLVED) {
      solved += 1;
    } else if (submission.status === SubmissionStatus.REVIEWING) {
      reviewing += 1;
    } else if (submission.status === SubmissionStatus.SKIPPED) {
      skipped += 1;
    }
  }

  return {
    key: list.key,
    title: list.title,
    total: items.length,
    solved,
    reviewing,
    skipped,
    percent: items.length === 0 ? 0 : (solved / items.length) * 100,
  };
}

export function buildRecentSolvedSubmissions(users: RecentSubmissionUser[], limit = 10): RecentSolvedSubmission[] {
  return users
    .flatMap((user) =>
      user.submissions
        .filter((submission) => submission.status === SubmissionStatus.SOLVED && submission.submittedAt)
        .map((submission) => {
          const problem = getProblem(submission.problemKey);
          const list = getList(submission.sourceKey);

          return {
            id: submission.id,
            userId: user.id,
            displayName: user.displayName,
            githubUsername: user.githubUsername,
            problemKey: submission.problemKey,
            problemTitle: problem.title,
            sourceKey: submission.sourceKey,
            listTitle: list.title,
            submittedAt: submission.submittedAt ?? "",
            githubUrl: submission.githubUrl,
          };
        }),
    )
    .sort(
      (left, right) =>
        new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime() ||
        left.displayName.localeCompare(right.displayName) ||
        left.problemTitle.localeCompare(right.problemTitle),
    )
    .slice(0, limit);
}

function buildUserRow(
  user: User & { submissions: Submission[]; activity?: ActivityDay[] },
  endDate: Date | string = new Date(),
): UserDashboardRow {
  const submissions = new Map(user.submissions.map((submission) => [submission.problemKey, submission]));
  const progress = catalog.lists.map((list) => summarizeList(list, submissions));
  const activity = user.activity ?? [];
  const activityCalendar = buildActivityCalendar(activity, 35, endDate);
  const recentActivityCalendar = buildActivityCalendar(activity, 7, endDate);
  const daysSinceLastSolved = getDaysSinceDateKey(activityCalendar.lastActiveDate, endDate);
  const activityStatus = getDashboardActivityStatus(daysSinceLastSolved);
  const recentSolvedAt =
    user.submissions
      .filter((submission) => submission.status === SubmissionStatus.SOLVED && submission.solvedAt)
      .sort((a, b) => new Date(b.solvedAt ?? 0).getTime() - new Date(a.solvedAt ?? 0).getTime())[0]?.solvedAt ?? null;

  return {
    ...user,
    activity,
    activityCalendar,
    progress,
    solvedTotal: user.submissions.filter((submission) => submission.status === SubmissionStatus.SOLVED).length,
    solvedLast7Days: recentActivityCalendar.totalSolved,
    solvedLast35Days: activityCalendar.totalSolved,
    daysSinceLastSolved,
    activityStatus,
    activityStatusLabel: getDashboardActivityStatusLabel(activityStatus),
    activityStatusRank: getDashboardActivityStatusRank(activityStatus),
    reviewingTotal: user.submissions.filter((submission) => submission.status === SubmissionStatus.REVIEWING).length,
    skippedTotal: user.submissions.filter((submission) => submission.status === SubmissionStatus.SKIPPED).length,
    recentSolvedAt,
  };
}

const data = progressData as ProgressData;

export async function listStaticUsers() {
  return data.users;
}

export async function getDashboardData() {
  const users = data.users.filter((user) => user.active);
  const endDate = new Date();

  const rows = users.map((user) => buildUserRow(user, endDate));
  const totalUsers = rows.length;
  const allSubmissions = rows.flatMap((row) => row.submissions);
  const solvedSubmissions = allSubmissions.filter((submission) => submission.status === SubmissionStatus.SOLVED);
  const totalTrackedProgress = rows.reduce(
    (sum, row) => sum + row.progress.reduce((progressSum, progress) => progressSum + progress.total, 0),
    0,
  );
  const solvedTrackedProgress = rows.reduce(
    (sum, row) => sum + row.progress.reduce((progressSum, progress) => progressSum + progress.solved, 0),
    0,
  );

  const listAverages = catalog.lists.map((list) => {
    const perUser = rows.map((row) => row.progress.find((progress) => progress.key === list.key)?.percent ?? 0);
    const average = perUser.length === 0 ? 0 : perUser.reduce((sum, value) => sum + value, 0) / perUser.length;
    return { key: list.key, title: list.title, average };
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const solvedLastSevenDays = solvedSubmissions.filter(
    (submission) => submission.solvedAt && new Date(submission.solvedAt).getTime() >= sevenDaysAgo,
  ).length;

  return {
    users: rows,
    totals: {
      users: totalUsers,
      lists: catalog.lists.length,
      uniqueProblems: catalog.problems.length,
      overallCompletionPercent: totalTrackedProgress === 0 ? 0 : (solvedTrackedProgress / totalTrackedProgress) * 100,
      solvedSubmissions: solvedSubmissions.length,
      solvedLastSevenDays,
      solvedLast7Days: rows.reduce((sum, row) => sum + row.solvedLast7Days, 0),
      solvedLast35Days: rows.reduce((sum, row) => sum + row.solvedLast35Days, 0),
    },
    listAverages,
    recentSolvedSubmissions: buildRecentSolvedSubmissions(rows),
    generatedAt: data.generatedAt,
  };
}

export async function getAdminUsers() {
  return [...data.users]
    .sort((a, b) => Number(b.active) - Number(a.active) || a.displayName.localeCompare(b.displayName))
    .map((user) => ({
      ...user,
      _count: {
        submissions: user.submissions.length,
      },
    }));
}

export async function getUserDetail(userId: string) {
  const user = data.users.find((candidate) => candidate.id === userId) ?? null;

  if (!user) {
    return null;
  }

  const submissions = new Map(user.submissions.map((submission) => [submission.problemKey, submission]));
  const lists = catalog.lists
    .map((list) => ({
      ...list,
      progress: summarizeList(list, submissions),
      items: getListProblems(list).map((item) => ({
        ...item,
        submission: submissions.get(item.problemKey) ?? null,
      })),
    }))
    .sort((a, b) => b.progress.solved - a.progress.solved);
  let firstUnsolvedProblemTarget: FirstUnsolvedProblemTarget | null = null;

  for (const list of lists) {
    for (const item of list.items) {
      if (item.submission?.status === SubmissionStatus.SOLVED) {
        continue;
      }

      firstUnsolvedProblemTarget = {
        elementId: FIRST_UNSOLVED_PROBLEM_ELEMENT_ID,
        listKey: list.key,
        problemKey: item.problemKey,
      };
      break;
    }

    if (firstUnsolvedProblemTarget) {
      break;
    }
  }

  return {
    user,
    lists,
    activityCalendar: buildActivityCalendar(user.activity ?? [], 90),
    firstUnsolvedProblemTarget,
  };
}

export async function getListDetail(listKey: string) {
  const list = catalog.lists.find((candidate) => candidate.key === listKey);
  if (!list) {
    return null;
  }

  const users = data.users.filter((user) => user.active);

  const usersWithProgress = users.map((user) => {
    const submissions = new Map(user.submissions.map((submission) => [submission.problemKey, submission]));
    return {
      ...user,
      progress: summarizeList(list, submissions),
      submissions,
    };
  });
  const rows = usersWithProgress.sort(
    (a, b) => b.progress.percent - a.progress.percent || a.displayName.localeCompare(b.displayName),
  );

  return { list, users: rows };
}
