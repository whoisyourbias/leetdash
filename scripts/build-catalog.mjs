import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2] ?? "/private/tmp/honood-readme.md";
const markdown = readFileSync(inputPath, "utf8");

const topInterviewEasySubmissionKeysBySlug = new Map(
  Object.entries({
    "remove-duplicates-from-sorted-array": "727",
    "best-time-to-buy-and-sell-stock-ii": "564",
    "rotate-array": "646",
    "contains-duplicate": "578",
    "single-number": "549",
    "intersection-of-two-arrays-ii": "674",
    "plus-one": "559",
    "move-zeroes": "567",
    "two-sum": "546",
    "valid-sudoku": "769",
    "rotate-image": "770",
    "reverse-string": "879",
    "reverse-integer": "880",
    "first-unique-character-in-a-string": "881",
    "valid-anagram": "882",
    "valid-palindrome": "883",
    "string-to-integer-atoi": "884",
    "find-the-index-of-the-first-occurrence-in-a-string": "885",
    "count-and-say": "886",
    "longest-common-prefix": "887",
    "delete-node-in-a-linked-list": "553",
    "remove-nth-node-from-end-of-list": "603",
    "reverse-linked-list": "560",
    "merge-two-sorted-lists": "771",
    "palindrome-linked-list": "772",
    "linked-list-cycle": "773",
    "maximum-depth-of-binary-tree": "555",
    "validate-binary-search-tree": "625",
    "symmetric-tree": "627",
    "binary-tree-level-order-traversal": "628",
    "convert-sorted-array-to-binary-search-tree": "631",
    "merge-sorted-array": "587",
    "first-bad-version": "774",
    "climbing-stairs": "569",
    "best-time-to-buy-and-sell-stock": "572",
    "maximum-subarray": "566",
    "house-robber": "576",
    "shuffle-an-array": "670",
    "min-stack": "562",
    "fizz-buzz": "743",
    "count-primes": "744",
    "power-of-three": "745",
    "roman-to-integer": "878",
    "number-of-1-bits": "565",
    "hamming-distance": "762",
    "reverse-bits": "648",
    "pascals-triangle": "601",
    "valid-parentheses": "721",
    "missing-number": "722",
  }),
);

function getTopInterviewEasySubmissionKey(slug) {
  const submissionKey = topInterviewEasySubmissionKeysBySlug.get(slug);
  if (!submissionKey) {
    throw new Error(`Missing Top Interview Easy submissionKey for slug: ${slug}`);
  }

  return submissionKey;
}

function sliceSection(startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  if (start === -1) {
    throw new Error(`Missing section: ${startHeading}`);
  }

  const end = markdown.indexOf(endHeading, start + startHeading.length);
  return markdown.slice(start, end === -1 ? undefined : end);
}

function parseStudyPlan({ key, title, url, summary, source }) {
  let currentSection = "";
  let order = 0;
  const problems = new Map();
  const items = [];

  for (const line of source.split(/\r?\n/)) {
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const problemMatch = line.match(
      /^\d+\.\s+\[(\d+)\\?\.\s+(.+?)\]\(https:\/\/leetcode\.com\/problems\/([^/?]+)\/\?[^)]*\)\s+\[(EASY|MEDIUM|HARD)\]/,
    );

    if (!problemMatch) {
      continue;
    }

    order += 1;
    const problem = {
      leetcodeId: Number(problemMatch[1]),
      slug: problemMatch[3],
      title: problemMatch[2].replace(/\\'/g, "'"),
      difficulty: problemMatch[4].toLowerCase(),
    };

    problems.set(problem.slug, problem);
    items.push({ slug: problem.slug, order, section: currentSection, submissionKey: String(problem.leetcodeId) });
  }

  return {
    key,
    title,
    url,
    summary,
    problems: [...problems.values()],
    items,
  };
}

const topInterviewEasyRows = [
  ["Array", 26, "remove-duplicates-from-sorted-array", "Remove Duplicates from Sorted Array", "easy"],
  ["Array", 122, "best-time-to-buy-and-sell-stock-ii", "Best Time to Buy and Sell Stock II", "medium"],
  ["Array", 189, "rotate-array", "Rotate Array", "medium"],
  ["Array", 217, "contains-duplicate", "Contains Duplicate", "easy"],
  ["Array", 136, "single-number", "Single Number", "easy"],
  ["Array", 350, "intersection-of-two-arrays-ii", "Intersection of Two Arrays II", "easy"],
  ["Array", 66, "plus-one", "Plus One", "easy"],
  ["Array", 283, "move-zeroes", "Move Zeroes", "easy"],
  ["Array", 1, "two-sum", "Two Sum", "easy"],
  ["Array", 36, "valid-sudoku", "Valid Sudoku", "medium"],
  ["Array", 48, "rotate-image", "Rotate Image", "medium"],
  ["Strings", 344, "reverse-string", "Reverse String", "easy"],
  ["Strings", 7, "reverse-integer", "Reverse Integer", "medium"],
  ["Strings", 387, "first-unique-character-in-a-string", "First Unique Character in a String", "easy"],
  ["Strings", 242, "valid-anagram", "Valid Anagram", "easy"],
  ["Strings", 125, "valid-palindrome", "Valid Palindrome", "easy"],
  ["Strings", 8, "string-to-integer-atoi", "String to Integer (atoi)", "medium"],
  [
    "Strings",
    28,
    "find-the-index-of-the-first-occurrence-in-a-string",
    "Find the Index of the First Occurrence in a String",
    "easy",
  ],
  ["Strings", 38, "count-and-say", "Count and Say", "medium"],
  ["Strings", 14, "longest-common-prefix", "Longest Common Prefix", "easy"],
  ["Linked List", 237, "delete-node-in-a-linked-list", "Delete Node in a Linked List", "medium"],
  ["Linked List", 19, "remove-nth-node-from-end-of-list", "Remove Nth Node From End of List", "medium"],
  ["Linked List", 206, "reverse-linked-list", "Reverse Linked List", "easy"],
  ["Linked List", 21, "merge-two-sorted-lists", "Merge Two Sorted Lists", "easy"],
  ["Linked List", 234, "palindrome-linked-list", "Palindrome Linked List", "easy"],
  ["Linked List", 141, "linked-list-cycle", "Linked List Cycle", "easy"],
  ["Trees", 104, "maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree", "easy"],
  ["Trees", 98, "validate-binary-search-tree", "Validate Binary Search Tree", "medium"],
  ["Trees", 101, "symmetric-tree", "Symmetric Tree", "easy"],
  ["Trees", 102, "binary-tree-level-order-traversal", "Binary Tree Level Order Traversal", "medium"],
  ["Trees", 108, "convert-sorted-array-to-binary-search-tree", "Convert Sorted Array to Binary Search Tree", "easy"],
  ["Sorting and Searching", 88, "merge-sorted-array", "Merge Sorted Array", "easy"],
  ["Sorting and Searching", 278, "first-bad-version", "First Bad Version", "easy"],
  ["Dynamic Programming", 70, "climbing-stairs", "Climbing Stairs", "easy"],
  ["Dynamic Programming", 121, "best-time-to-buy-and-sell-stock", "Best Time to Buy and Sell Stock", "easy"],
  ["Dynamic Programming", 53, "maximum-subarray", "Maximum Subarray", "medium"],
  ["Dynamic Programming", 198, "house-robber", "House Robber", "medium"],
  ["Design", 384, "shuffle-an-array", "Shuffle an Array", "medium"],
  ["Design", 155, "min-stack", "Min Stack", "medium"],
  ["Math", 412, "fizz-buzz", "Fizz Buzz", "easy"],
  ["Math", 204, "count-primes", "Count Primes", "medium"],
  ["Math", 326, "power-of-three", "Power of Three", "easy"],
  ["Math", 13, "roman-to-integer", "Roman to Integer", "easy"],
  ["Others", 191, "number-of-1-bits", "Number of 1 Bits", "easy"],
  ["Others", 461, "hamming-distance", "Hamming Distance", "easy"],
  ["Others", 190, "reverse-bits", "Reverse Bits", "easy"],
  ["Others", 118, "pascals-triangle", "Pascal's Triangle", "easy"],
  ["Others", 20, "valid-parentheses", "Valid Parentheses", "easy"],
  ["Others", 268, "missing-number", "Missing Number", "easy"],
];

const topInterviewEasy = {
  key: "top-interview-easy",
  title: "Top Interview Questions Easy",
  url: "https://leetcode.com/explore/featured/card/top-interview-questions-easy/",
  summary: ["Explore card for common easy interview preparation topics"],
  problems: topInterviewEasyRows.map(([, leetcodeId, slug, title, difficulty]) => ({
    leetcodeId,
    slug,
    title,
    difficulty,
  })),
  items: topInterviewEasyRows.map(([section, , slug], index) => ({
    slug,
    order: index + 1,
    section,
    submissionKey: getTopInterviewEasySubmissionKey(slug),
  })),
};

const leetcode75 = parseStudyPlan({
  key: "leetcode-75",
  title: "LeetCode 75",
  url: "https://leetcode.com/studyplan/leetcode-75/",
  summary: ["75 Essential & Trending Problems", "Best for 1~3 months of prep time"],
  source: sliceSection("## [LeetCode 75]", "## [Top Interview 150]"),
});

const topInterview150 = parseStudyPlan({
  key: "top-interview-150",
  title: "Top Interview 150",
  url: "https://leetcode.com/studyplan/top-interview-150/",
  summary: ["150 Original & Classic Questions", "Best for 3+ months of prep time"],
  source: sliceSection("## [Top Interview 150]", "## [Top 100 Liked]"),
});

const lists = [topInterviewEasy, leetcode75, topInterview150];
const problemsBySlug = new Map();
for (const list of lists) {
  for (const problem of list.problems) {
    const existing = problemsBySlug.get(problem.slug);
    if (!existing || existing.title.length < problem.title.length) {
      problemsBySlug.set(problem.slug, problem);
    }
  }
}

const catalog = {
  generatedAt: "2026-07-18",
  sources: [
    "https://leetcode.com/explore/featured/card/top-interview-questions-easy/",
    "https://leetcode.com/studyplan/leetcode-75/",
    "https://leetcode.com/studyplan/top-interview-150/",
    "https://github.com/honood/leetcode/blob/main/README.md",
    "https://blog.nuomi1.com/archives/2018/12/leetcode-top-interview-questions-easy-swift-exercises.html",
  ],
  lists,
  problems: [...problemsBySlug.values()].sort((a, b) => a.leetcodeId - b.leetcodeId),
};

writeFileSync(resolve(root, "data/problem-catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      lists: lists.map((list) => ({ key: list.key, items: list.items.length })),
      uniqueProblems: catalog.problems.length,
    },
    null,
    2,
  ),
);
