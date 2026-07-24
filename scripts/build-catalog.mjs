import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2];
const markdown = inputPath ? readFileSync(inputPath, "utf8") : "";

const toProblemKey = (provider, problemId) => `${provider}:${String(problemId)}`;

function createLeetCodeProblem({ leetcodeId, slug, title, difficulty }) {
  const problemId = String(leetcodeId);
  return {
    provider: "leetcode",
    problemId,
    problemKey: toProblemKey("leetcode", problemId),
    slug,
    title,
    difficulty,
    sourceUrl: `https://leetcode.com/problems/${slug}/`,
  };
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
    const problem = createLeetCodeProblem({
      leetcodeId: Number(problemMatch[1]),
      slug: problemMatch[3],
      title: problemMatch[2].replace(/\\'/g, "'"),
      difficulty: problemMatch[4].toLowerCase(),
    });

    problems.set(problem.problemKey, problem);
    items.push({ problemKey: problem.problemKey, order, section: currentSection, submissionKey: problem.problemId });
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
  problems: topInterviewEasyRows.map(([, leetcodeId, slug, title, difficulty]) => createLeetCodeProblem({
    leetcodeId,
    slug,
    title,
    difficulty,
  })),
  items: topInterviewEasyRows.map(([section, leetcodeId, slug], index) => ({
    problemKey: toProblemKey("leetcode", leetcodeId),
    order: index + 1,
    section,
    submissionKey: String(leetcodeId),
  })),
};

let leetcode75, topInterview150;

if (inputPath) {
  // Parse from markdown input file
  leetcode75 = parseStudyPlan({
    key: "leetcode-75",
    title: "LeetCode 75",
    url: "https://leetcode.com/studyplan/leetcode-75/",
    summary: ["75 Essential & Trending Problems", "Best for 1~3 months of prep time"],
    source: sliceSection("## [LeetCode 75]", "## [Top Interview 150]"),
  });

  topInterview150 = parseStudyPlan({
    key: "top-interview-150",
    title: "Top Interview 150",
    url: "https://leetcode.com/studyplan/top-interview-150/",
    summary: ["150 Original & Classic Questions", "Best for 3+ months of prep time"],
    source: sliceSection("## [Top Interview 150]", "## [Top 100 Liked]"),
  });
} else {
  // No input file: read LeetCode lists from the existing catalog
  const existingCatalog = JSON.parse(readFileSync(resolve(root, "data/problem-catalog.json"), "utf8"));
  leetcode75 = existingCatalog.lists.find((l) => l.key === "leetcode-75");
  topInterview150 = existingCatalog.lists.find((l) => l.key === "top-interview-150");

  if (!leetcode75 || !topInterview150) {
    throw new Error(
      "Existing problem-catalog.json missing leetcode-75 or top-interview-150 lists. " +
        "Run with an input markdown file first."
    );
  }
}

async function fetchProgrammersProblems() {
  const BASE_URL = "https://school.programmers.co.kr/api/v2/school/challenges";
  const LEVELS = [0, 1, 2, 3];
  const DELAY_MS = 300;

  async function fetchPage(page) {
    const params = new URLSearchParams();
    for (const level of LEVELS) {
      params.append("levels[]", level);
    }
    params.set("page", String(page));
    const url = `${BASE_URL}?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "leetdash-catalog-builder/1.0" },
    });
    if (!res.ok) throw new Error(`API ${res.status} for page ${page}`);
    return res.json();
  }

  const first = await fetchPage(1);
  const all = [...first.result];
  for (let p = 2; p <= first.totalPages; p++) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
    const data = await fetchPage(p);
    all.push(...data.result);
  }
  return all;
}

function createProgrammersProblem(raw) {
  const problemId = String(raw.id);
  return {
    provider: "programmers",
    problemId,
    problemKey: toProblemKey("programmers", problemId),
    title: raw.title,
    difficulty: `level-${raw.level}`,
    sourceUrl: `https://school.programmers.co.kr/learn/courses/30/lessons/${problemId}`,
  };
}

async function fetchSweaProblems() {
  const { spawn } = await import("node:child_process");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const scriptPath = resolve(__dirname, "fetch-swea.mjs");

  return new Promise((resolvePromise, reject) => {
    const proc = spawn("node", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0 && stdout) {
        try {
          const data = JSON.parse(stdout);
          resolvePromise(data);
        } catch (e) {
          reject(new Error(`Failed to parse fetch-swea output: ${e.message}\n${stderr}`));
        }
      } else {
        reject(new Error(`fetch-swea exited with code ${code}\n${stderr}`));
      }
    });
    proc.on("error", reject);
  });
}

function createSweaList(rawProblems) {
  // Filter out "Unknown" difficulty (mock tests, samples) — they have no D level badge
  const known = rawProblems.filter((p) => p.difficulty !== "Unknown");

  const problems = known.map((p) => ({
    provider: "swea",
    problemId: p.id,
    problemKey: toProblemKey("swea", p.id),
    title: p.title,
    difficulty: p.difficulty,
    sourceUrl: `https://swexpertacademy.com/main/code/problem/problemDetail.do?problemId=${p.id}`,
  }));
  const items = known.map((p, idx) => ({
    problemKey: toProblemKey("swea", p.id),
    order: idx + 1,
    section: p.difficulty,
    submissionKey: p.id,
  }));
  return {
    key: "swea",
    title: "SWEA",
    url: "https://swexpertacademy.com/main/code/problem/problemList.do",
    summary: ["SW Expert Academy problems sorted by level"],
    problems,
    items,
  };
}

const providerList = (problem, title) => ({
  key: problem.provider,
  title,
  url: problem.sourceUrl,
  summary: [],
  problems: [problem],
  items: [{ problemKey: problem.problemKey, order: 1, section: "", submissionKey: problem.problemId }],
});

async function main() {
  // Base LeetCode lists
  const lists = [
    topInterviewEasy,
    leetcode75,
    topInterview150,
  ];

  // Fetch Programmers problems from API unless a markdown input file was provided
  const SHOULD_FETCH_PROGRAMMERS = !process.argv[2];
  let programmersSourceUrl = "";

  if (SHOULD_FETCH_PROGRAMMERS) {
    console.error("[build-catalog] Fetching Programmers problems from API...");
    const rawProblems = await fetchProgrammersProblems();
    // Sort by level (asc), then by id (asc)
    rawProblems.sort((a, b) => a.level - b.level || Number(a.id) - Number(b.id));

    const programmerProblems = rawProblems.map(createProgrammersProblem);
    const programmerItems = rawProblems.map((p, idx) => ({
      problemKey: toProblemKey("programmers", String(p.id)),
      order: idx + 1,
      section: `Level ${p.level}`,
      submissionKey: String(p.id),
    }));

    programmersSourceUrl = "https://school.programmers.co.kr/learn/challenges?levels=0&levels=1&levels=2&levels=3";

    lists.push({
      key: "programmers",
      title: "Programmers",
      url: programmersSourceUrl,
      summary: ["Programmers coding test problems sorted by level"],
      problems: programmerProblems,
      items: programmerItems,
    });

    console.error(`[build-catalog] Programmers: ${programmerProblems.length} problems added`);
  } else {
    // Fallback: single hardcoded entry (legacy mode with markdown input)
    const programmersProblem = {
      provider: "programmers",
      problemId: "12906",
      problemKey: toProblemKey("programmers", "12906"),
      title: "같은 숫자는 싫어",
      difficulty: "level-1",
      sourceUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/12906",
    };
    programmersSourceUrl = programmersProblem.sourceUrl;
    lists.push(providerList(programmersProblem, "Programmers"));
  }

  // SWEA (fetch all problems from SW Expert Academy)
  console.error("[build-catalog] Fetching SWEA problems...");
  const sweaRaw = await fetchSweaProblems();
  lists.push(createSweaList(sweaRaw));
  console.error(`[build-catalog] SWEA: ${lists[lists.length - 1].problems.length} problems added`);

  // Build unique problems map
  const problemsByKey = new Map();
  for (const list of lists) {
    for (const problem of list.problems) {
      const existing = problemsByKey.get(problem.problemKey);
      if (!existing || existing.title.length < problem.title.length) {
        problemsByKey.set(problem.problemKey, problem);
      }
    }
  }

  const catalog = {
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: [
      "https://leetcode.com/explore/featured/card/top-interview-questions-easy/",
      "https://leetcode.com/studyplan/leetcode-75/",
      "https://leetcode.com/studyplan/top-interview-150/",
      "https://github.com/honood/leetcode/blob/main/README.md",
      "https://blog.nuomi1.com/archives/2018/12/leetcode-top-interview-questions-easy-swift-exercises.html",
      programmersSourceUrl,
      "https://swexpertacademy.com/main/code/problem/problemList.do",
    ],
    lists,
    problems: [...problemsByKey.values()].sort((a, b) => {
      const providerOrder = ["leetcode", "programmers", "swea"];
      return providerOrder.indexOf(a.provider) - providerOrder.indexOf(b.provider) || Number(a.problemId) - Number(b.problemId);
    }),
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
}

main().catch((err) => {
  console.error(`[build-catalog] FATAL: ${err.message}`);
  process.exit(1);
});
