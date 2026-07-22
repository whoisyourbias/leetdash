import catalogData from "@/data/problem-catalog.json";

export type CatalogProvider = "leetcode" | "programmers" | "swea";

export type CatalogProblem = {
  provider: CatalogProvider;
  problemId: string;
  problemKey: string;
  title: string;
  difficulty: string;
  sourceUrl: string;
  slug?: string;
};

export type CatalogListItem = {
  problemKey: string;
  order: number;
  section: string;
  submissionKey: string;
};

export type CatalogList = {
  key: string;
  title: string;
  url: string;
  summary: string[];
  problems: CatalogProblem[];
  items: CatalogListItem[];
};

export type ProblemCatalog = {
  generatedAt: string;
  sources: string[];
  lists: CatalogList[];
  problems: CatalogProblem[];
};

export const catalog = catalogData as ProblemCatalog;

export const problemByKey = new Map(catalog.problems.map((problem) => [problem.problemKey, problem]));
export const listByKey = new Map(catalog.lists.map((list) => [list.key, list]));
export const catalogProblemKeys = new Set(catalog.problems.map((problem) => problem.problemKey));

export function getProblem(problemKey: string) {
  const problem = problemByKey.get(problemKey);
  if (!problem) {
    throw new Error(`Unknown problem key: ${problemKey}`);
  }
  return problem;
}

export function getList(key: string) {
  const list = listByKey.get(key);
  if (!list) {
    throw new Error(`Unknown problem list: ${key}`);
  }
  return list;
}

export function getListProblems(list: CatalogList) {
  return list.items.map((item) => ({
    ...item,
    problem: getProblem(item.problemKey),
  }));
}

export function getProblemSourceUrl(problemKey: string) {
  return getProblem(problemKey).sourceUrl;
}
