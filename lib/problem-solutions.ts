import catalogData from "@/data/problem-catalog.json";
import progressData from "@/data/progress.json";
import { mergeDynamicProblems, type CatalogProblem, type ProblemCatalog } from "@/lib/catalog";
import { getSelectedSubmission } from "@/lib/submission-selection";
import { type ProgressData, type Submission, type User } from "@/lib/types";

export type ComparableProblemParam = {
  provider: CatalogProblem["provider"];
  problemId: string;
};

export type ProblemDetailUser = Pick<User, "id" | "displayName" | "githubUsername" | "active">;

export type ProblemSolver = {
  user: ProblemDetailUser;
  submission: {
    id: string;
    status: Submission["status"];
    language?: string;
    submittedAt?: string;
    solutionRawUrl?: string;
    solutionPermalink?: string;
    solutionPathKey?: string;
    solutionContentKey?: string;
  };
};

export type ProblemSolutionDetail = {
  problem: Pick<
    CatalogProblem,
    "provider" | "problemId" | "problemKey" | "title" | "difficulty" | "sourceUrl" | "slug"
  >;
  users: ProblemDetailUser[];
  solvers: ProblemSolver[];
};

type ProgressUser = ProgressData["users"][number];
const baseCatalog = catalogData as ProblemCatalog;

function pickUserIdentity(user: ProgressUser): ProblemDetailUser {
  return {
    id: user.id,
    displayName: user.displayName,
    githubUsername: user.githubUsername,
    active: user.active,
  };
}

function toSolverSubmission(submission: Submission): ProblemSolver["submission"] {
  return {
    id: submission.id,
    status: submission.status,
    ...(submission.language ? { language: submission.language } : {}),
    ...(submission.submittedAt ? { submittedAt: submission.submittedAt } : {}),
    ...(submission.solutionRawUrl ? { solutionRawUrl: submission.solutionRawUrl } : {}),
    ...(submission.solutionPermalink ? { solutionPermalink: submission.solutionPermalink } : {}),
    ...(submission.solutionPathKey ? { solutionPathKey: submission.solutionPathKey } : {}),
    ...(submission.solutionContentKey ? { solutionContentKey: submission.solutionContentKey } : {}),
  };
}

function buildSolvers(data: ProgressData, problemKey: string): ProblemSolver[] {
  return data.users
    .map((user) => {
      const submission = getSelectedSubmission(user, problemKey);
      if (!submission?.solutionPath) {
        return null;
      }
      return { user: pickUserIdentity(user), submission: toSolverSubmission(submission) };
    })
    .filter((solver): solver is ProblemSolver => solver !== null)
    .sort((left, right) => left.user.displayName.localeCompare(right.user.displayName));
}

function compareProblemId(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    return Number(left) - Number(right);
  }
  return left.localeCompare(right);
}

export function listComparableProblemParams(
  data: ProgressData = progressData as ProgressData,
  catalogInput: ProblemCatalog = mergeDynamicProblems(baseCatalog, data.dynamicProblems),
): ComparableProblemParam[] {
  const problemsByKey = new Map(catalogInput.problems.map((problem) => [problem.problemKey, problem]));
  const seen = new Set<string>();
  const params: ComparableProblemParam[] = [];

  for (const user of data.users) {
    const problemKeys = new Set(user.submissions.map((submission) => submission.problemKey));
    for (const problemKey of problemKeys) {
      if (seen.has(problemKey)) {
        continue;
      }
      const submission = getSelectedSubmission(user, problemKey);
      if (!submission?.solutionPath) {
        continue;
      }
      const problem = problemsByKey.get(problemKey);
      if (!problem) {
        continue;
      }
      seen.add(problemKey);
      params.push({ provider: problem.provider, problemId: problem.problemId });
    }
  }

  return params.sort(
    (left, right) => left.provider.localeCompare(right.provider) || compareProblemId(left.problemId, right.problemId),
  );
}

export function getProblemSolutionDetail(
  provider: string,
  problemId: string,
  data: ProgressData = progressData as ProgressData,
  catalogInput: ProblemCatalog = mergeDynamicProblems(baseCatalog, data.dynamicProblems),
): ProblemSolutionDetail | null {
  const problem = catalogInput.problems.find(
    (candidate) => candidate.provider === provider && candidate.problemId === problemId,
  );
  if (!problem) {
    return null;
  }

  const solvers = buildSolvers(data, problem.problemKey);
  if (solvers.length === 0) {
    return null;
  }

  return {
    problem: {
      provider: problem.provider,
      problemId: problem.problemId,
      problemKey: problem.problemKey,
      title: problem.title,
      difficulty: problem.difficulty,
      sourceUrl: problem.sourceUrl,
      ...(problem.slug ? { slug: problem.slug } : {}),
    },
    users: [...data.users]
      .map(pickUserIdentity)
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    solvers,
  };
}
