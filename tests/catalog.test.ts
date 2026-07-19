import { describe, expect, it } from "vitest";
import { catalog, getListProblems, problemBySlug } from "@/lib/catalog";

describe("problem catalog", () => {
  it("loads the three planned lists with expected counts", () => {
    expect(catalog.lists.map((list) => [list.key, list.items.length])).toEqual([
      ["top-interview-easy", 49],
      ["leetcode-75", 75],
      ["top-interview-150", 150],
    ]);
  });

  it("has a canonical problem entry for every list item", () => {
    for (const list of catalog.lists) {
      for (const item of getListProblems(list)) {
        expect(problemBySlug.has(item.slug)).toBe(true);
        expect(item.problem.slug).toBe(item.slug);
      }
    }
  });

  it("has a numeric, per-list unique submission key for every list item", () => {
    for (const list of catalog.lists) {
      const submissionKeys = new Set<string>();
      for (const item of list.items) {
        expect(item.submissionKey).toMatch(/^\d+$/);
        expect(submissionKeys.has(item.submissionKey)).toBe(false);
        submissionKeys.add(item.submissionKey);
      }
    }
  });

  it("uses source-specific submission keys instead of canonical slugs", () => {
    const topInterviewEasy = catalog.lists.find((list) => list.key === "top-interview-easy");
    const leetcode75 = catalog.lists.find((list) => list.key === "leetcode-75");
    const topInterview150 = catalog.lists.find((list) => list.key === "top-interview-150");

    expect(topInterviewEasy?.items.find((item) => item.slug === "two-sum")?.submissionKey).toBe("546");
    expect(leetcode75?.items.find((item) => item.slug === "merge-strings-alternately")?.submissionKey).toBe("1768");
    expect(topInterview150?.items.find((item) => item.slug === "merge-sorted-array")?.submissionKey).toBe("88");

    for (const problem of catalog.problems) {
      expect(Object.keys(problem).sort()).toEqual(["difficulty", "leetcodeId", "slug", "title"]);
    }
  });
});
