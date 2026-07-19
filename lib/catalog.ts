import catalogData from "@/data/problem-catalog.json";

export type Difficulty = "easy" | "medium" | "hard";

export type CatalogProblem = {
  leetcodeId: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
};

export type CatalogListItem = {
  slug: string;
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

export const problemBySlug = new Map(catalog.problems.map((problem) => [problem.slug, problem]));
export const listByKey = new Map(catalog.lists.map((list) => [list.key, list]));
export const catalogSlugs = new Set(catalog.problems.map((problem) => problem.slug));

export function getProblem(slug: string) {
  const problem = problemBySlug.get(slug);
  if (!problem) {
    throw new Error(`Unknown problem slug: ${slug}`);
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
    problem: getProblem(item.slug),
  }));
}

export function getProblemLeetCodeUrl(slug: string) {
  return `https://leetcode.com/problems/${slug}/`;
}
