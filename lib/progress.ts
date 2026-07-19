import { catalog, getListProblems, type CatalogList } from "@/lib/catalog";
import progressData from "@/data/progress.json";
import { SubmissionStatus, type ProgressData, type Submission, type User } from "@/lib/types";

export type ListProgress = {
  key: string;
  title: string;
  total: number;
  solved: number;
  reviewing: number;
  skipped: number;
  percent: number;
};

export type UserDashboardRow = User & {
  submissions: Submission[];
  progress: ListProgress[];
  solvedTotal: number;
  reviewingTotal: number;
  skippedTotal: number;
  recentSolvedAt: string | null;
};

function summarizeList(list: CatalogList, submissions: Map<string, Submission>): ListProgress {
  const items = getListProblems(list);
  let solved = 0;
  let reviewing = 0;
  let skipped = 0;

  for (const item of items) {
    const submission = submissions.get(item.slug);
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

function buildUserRow(
  user: User & { submissions: Submission[] },
): UserDashboardRow {
  const submissions = new Map(user.submissions.map((submission) => [submission.problemSlug, submission]));
  const progress = catalog.lists.map((list) => summarizeList(list, submissions));
  const recentSolvedAt =
    user.submissions
      .filter((submission) => submission.status === SubmissionStatus.SOLVED && submission.solvedAt)
      .sort((a, b) => new Date(b.solvedAt ?? 0).getTime() - new Date(a.solvedAt ?? 0).getTime())[0]?.solvedAt ?? null;

  return {
    ...user,
    progress,
    solvedTotal: user.submissions.filter((submission) => submission.status === SubmissionStatus.SOLVED).length,
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

  const rows = users.map((user) => buildUserRow(user));
  const totalUsers = rows.length;
  const allSubmissions = rows.flatMap((row) => row.submissions);
  const solvedSubmissions = allSubmissions.filter((submission) => submission.status === SubmissionStatus.SOLVED);

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
      solvedSubmissions: solvedSubmissions.length,
      solvedLastSevenDays,
    },
    listAverages,
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

  const submissions = new Map(user.submissions.map((submission) => [submission.problemSlug, submission]));
  const lists = catalog.lists.map((list) => ({
    ...list,
    progress: summarizeList(list, submissions),
    items: getListProblems(list).map((item) => ({
      ...item,
      submission: submissions.get(item.slug) ?? null,
    })),
  }));

  return { user, lists };
}

export async function getListDetail(listKey: string) {
  const list = catalog.lists.find((candidate) => candidate.key === listKey);
  if (!list) {
    return null;
  }

  const users = data.users.filter((user) => user.active);

  const usersWithProgress = users.map((user) => {
    const submissions = new Map(user.submissions.map((submission) => [submission.problemSlug, submission]));
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
