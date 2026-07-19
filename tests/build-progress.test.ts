import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(__dirname, "..", "scripts", "build-progress.mjs");

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

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

describe("build-progress", () => {
  it("builds per-user progress from checked-in submission folders", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "progress-radar-"));
    await mkdir(path.join(repo, "data"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "546"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "leetcode-75", "1"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "leetcode-75", "1768"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-150", "88"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "721"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "solutions", "20"), { recursive: true });
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "two-sum"), { recursive: true });

    await writeJson(path.join(repo, "data", "problem-catalog.json"), {
      problems: [
        { leetcodeId: 1, slug: "two-sum", title: "Two Sum", difficulty: "easy" },
        {
          leetcodeId: 88,
          slug: "merge-sorted-array",
          title: "Merge Sorted Array",
          difficulty: "easy",
        },
        {
          leetcodeId: 1768,
          slug: "merge-strings-alternately",
          title: "Merge Strings Alternately",
          difficulty: "easy",
        },
        {
          leetcodeId: 20,
          slug: "valid-parentheses",
          title: "Valid Parentheses",
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
          items: [
            { slug: "two-sum", order: 1, section: "Hash Map", submissionKey: "1" },
            { slug: "merge-strings-alternately", order: 2, section: "Array / String", submissionKey: "1768" },
          ],
        },
        {
          key: "top-interview-150",
          items: [{ slug: "merge-sorted-array", order: 1, section: "Array / String", submissionKey: "88" }],
        },
      ],
    });
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "546", "solution.ts"), "// solved\n");
    await writeJson(path.join(repo, "submissions", "ada", "leetcode-75", "1", "meta.json"), {
      status: "reviewing",
      notes: "Duplicate source should lose to solved.",
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "two-sum", "solution.ts"), "// ignored\n");
    await writeJson(path.join(repo, "submissions", "ada", "solutions", "20", "meta.json"), {
      status: "solved",
      notes: "Old path should be ignored.",
    });
    await writeJson(path.join(repo, "submissions", "ada", "leetcode-75", "1768", "meta.json"), {
      status: "reviewing",
      language: "TypeScript",
      notes: "Needs another pass.",
    });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "721", "Solution.java"), "// solved\n");
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-150", "88", "solution.py"), "# solved\n");

    await execFileAsync(process.execPath, [scriptPath], {
      cwd: repo,
      env: { ...process.env, SOURCE_REPOSITORY_URL: "https://github.com/example/progress", BRANCH: "master" },
    });

    const progress = JSON.parse(await readFile(path.join(repo, "data", "progress.json"), "utf8"));
    expect(progress.users).toHaveLength(1);
    expect(progress.users[0]).toMatchObject({
      id: "ada",
      active: true,
      submissionsPath: "submissions/ada",
    });
    expect(progress.users[0].activity).toEqual([]);
    expect(progress.users[0].submissions).toEqual([
      expect.objectContaining({
        problemSlug: "merge-sorted-array",
        status: "SOLVED",
        sourceKey: "top-interview-150",
        submissionKey: "88",
        language: "PY",
        solutionPath: "submissions/ada/top-interview-150/88/solution.py",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top-interview-150/88/solution.py",
        source: "solution-file",
      }),
      expect.objectContaining({
        problemSlug: "merge-strings-alternately",
        status: "REVIEWING",
        sourceKey: "leetcode-75",
        submissionKey: "1768",
        language: "TypeScript",
        notes: "Needs another pass.",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/leetcode-75/1768/meta.json",
        source: "meta",
      }),
      expect.objectContaining({
        problemSlug: "two-sum",
        status: "SOLVED",
        sourceKey: "top-interview-easy",
        submissionKey: "546",
        language: "TS",
        solutionPath: "submissions/ada/top-interview-easy/546/solution.ts",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top-interview-easy/546/solution.ts",
        source: "solution-file",
      }),
      expect.objectContaining({
        problemSlug: "valid-parentheses",
        status: "SOLVED",
        sourceKey: "top-interview-easy",
        submissionKey: "721",
        language: "JAVA",
        solutionPath: "submissions/ada/top-interview-easy/721/Solution.java",
        githubUrl: "https://github.com/example/progress/blob/master/submissions/ada/top-interview-easy/721/Solution.java",
        source: "solution-file",
      }),
    ]);
  });

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
});
