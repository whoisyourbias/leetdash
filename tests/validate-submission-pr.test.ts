import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(__dirname, "..", "scripts", "validate-submission-pr.mjs");

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createRepoFixture() {
  const repo = await mkdtemp(path.join(tmpdir(), "submission-pr-"));
  await mkdir(path.join(repo, "data"), { recursive: true });
  await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "1"), { recursive: true });
  await mkdir(path.join(repo, "submissions", "ada", "programmers", "12906"), { recursive: true });
  await mkdir(path.join(repo, "submissions", "ada", "swea", "1206"), { recursive: true });
  await writeJson(path.join(repo, "data", "problem-catalog.json"), {
    lists: [
      {
        key: "top-interview-easy",
        items: [{ problemKey: "leetcode:1", submissionKey: "1" }],
      },
      { key: "programmers", items: [{ problemKey: "programmers:12906", submissionKey: "12906" }] },
      { key: "swea", items: [{ problemKey: "swea:1206", submissionKey: "1206" }] },
    ],
  });
  await writeJson(path.join(repo, "data", "users.json"), {
    users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
  });
  await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "Solution.java"), "class Solution {}\n");
  await writeFile(path.join(repo, "submissions", "ada", "programmers", "12906", "solution.java"), "class Solution {}\n");
  await writeFile(path.join(repo, "submissions", "ada", "swea", "1206", "solution.py"), "# solved\n");
  return repo;
}

async function runValidator(repo: string, changedFiles: string) {
  const changedFilesPath = path.join(repo, "changed-files.txt");
  const outputPath = path.join(repo, "github-output.txt");
  await writeFile(changedFilesPath, changedFiles);

  return execFileAsync(process.execPath, [scriptPath, "--changed-files", changedFilesPath], {
    cwd: repo,
    env: { ...process.env, GITHUB_OUTPUT: outputPath },
  }).then(
    async (result) => ({
      ...result,
      githubOutput: await readFile(outputPath, "utf8"),
    }),
    async (error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) => {
      let githubOutput = "";
      try {
        githubOutput = await readFile(outputPath, "utf8");
      } catch {
        // The script may fail before writing GitHub output.
      }
      throw Object.assign(error, { githubOutput });
    },
  );
}

async function runValidatorForAuthor(repo: string, author: string, changedFiles: string) {
  const changedFilesPath = path.join(repo, "changed-files.txt");
  const outputPath = path.join(repo, "github-output.txt");
  await writeFile(changedFilesPath, changedFiles);

  return execFileAsync(process.execPath, [scriptPath, "--changed-files", changedFilesPath, "--author", author], {
    cwd: repo,
    env: { ...process.env, GITHUB_OUTPUT: outputPath },
  }).then(
    async (result) => ({
      ...result,
      githubOutput: await readFile(outputPath, "utf8"),
    }),
    async (error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) => {
      let githubOutput = "";
      try {
        githubOutput = await readFile(outputPath, "utf8");
      } catch {
        // The script may fail before writing GitHub output.
      }
      throw Object.assign(error, { githubOutput });
    },
  );
}

async function git(repo: string, args: string[]) {
  const result = await execFileAsync("git", args, { cwd: repo });
  return result.stdout.trim();
}

describe("validate-submission-pr", () => {
  it("marks valid participant submission changes as submission-only", async () => {
    const repo = await createRepoFixture();

    const result = await runValidator(repo, "A\tsubmissions/ada/top-interview-easy/1/Solution.java\n");

    expect(result.stdout).toContain("submission_only=true");
    expect(result.githubOutput).toBe("submission_only=true\n");
  });

  it("accepts Programmers and SWEA catalog submission paths", async () => {
    const repo = await createRepoFixture();

    const result = await runValidator(
      repo,
      "A\tsubmissions/ada/programmers/12906/solution.java\nA\tsubmissions/ada/swea/1206/solution.py\n",
    );

    expect(result.stdout).toContain("validated 2 changed submission file(s)");
    expect(result.githubOutput).toBe("submission_only=true\n");
  });

  it("keeps application changes on the full CI path", async () => {
    const repo = await createRepoFixture();

    const result = await runValidator(repo, "M\tapp/page.tsx\n");

    expect(result.stdout).toContain("submission_only=false");
    expect(result.githubOutput).toBe("submission_only=false\n");
  });

  it("rejects submission-only changes for an unknown provider list", async () => {
    const repo = await createRepoFixture();
    await mkdir(path.join(repo, "submissions", "ada", "unknown", "1"), { recursive: true });
    await writeFile(path.join(repo, "submissions", "ada", "unknown", "1", "Solution.java"), "class Solution {}\n");

    await expect(runValidator(repo, "A\tsubmissions/ada/unknown/1/Solution.java\n")).rejects.toMatchObject({
      stderr: expect.stringContaining("unknown/1 is not in data/problem-catalog.json"),
      githubOutput: "submission_only=true\n",
    });
  });

  it("rejects deletions in the fast submission-only path", async () => {
    const repo = await createRepoFixture();

    await expect(runValidator(repo, "D\tsubmissions/ada/top-interview-easy/1/Solution.java\n")).rejects.toMatchObject({
      stderr: expect.stringContaining("may add, update, or rename files, not delete them"),
      githubOutput: "submission_only=true\n",
    });
  });

  it("accepts submission-only changes under the pull request author path", async () => {
    const repo = await createRepoFixture();

    const result = await runValidatorForAuthor(repo, "ada", "M\tsubmissions/ada/top-interview-easy/1/Solution.java\n");

    expect(result.stdout).toContain("submission_only=true");
    expect(result.githubOutput).toBe("submission_only=true\n");
  });

  it("rejects submission-only changes outside the pull request author path", async () => {
    const repo = await createRepoFixture();
    await mkdir(path.join(repo, "submissions", "grace", "top-interview-easy", "1"), { recursive: true });
    await writeFile(path.join(repo, "submissions", "grace", "top-interview-easy", "1", "Solution.java"), "class Solution {}\n");
    await writeJson(path.join(repo, "data", "users.json"), {
      users: [
        { id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" },
        { id: "grace", displayName: "Grace Hopper", githubUsername: "grace" },
      ],
    });

    await expect(runValidatorForAuthor(repo, "ada", "M\tsubmissions/grace/top-interview-easy/1/Solution.java\n")).rejects.toMatchObject({
      stderr: expect.stringContaining("belongs to grace, not pull request author ada"),
      githubOutput: "submission_only=true\n",
    });
  });

  it("rejects submission-only changes from an unknown pull request author", async () => {
    const repo = await createRepoFixture();

    await expect(runValidatorForAuthor(repo, "unknown", "M\tsubmissions/ada/top-interview-easy/1/Solution.java\n")).rejects.toMatchObject({
      stderr: expect.stringContaining("pull request author unknown is not registered in data/users.json"),
      githubOutput: "submission_only=true\n",
    });
  });

  it("accepts a valid submission filename rename", async () => {
    const repo = await createRepoFixture();
    const problemDir = path.join(repo, "submissions", "ada", "top-interview-easy", "1");
    await rename(path.join(problemDir, "Solution.java"), path.join(problemDir, "solution.jvaa"));
    await git(repo, ["init"]);
    await git(repo, ["config", "user.email", "test@example.com"]);
    await git(repo, ["config", "user.name", "Test User"]);
    await git(repo, ["add", "."]);
    await git(repo, ["commit", "-m", "initial"]);
    const base = await git(repo, ["rev-parse", "HEAD"]);

    await git(repo, ["mv", "submissions/ada/top-interview-easy/1/solution.jvaa", "submissions/ada/top-interview-easy/1/Solution.java"]);
    await git(repo, ["commit", "-m", "fix submission filename"]);
    const head = await git(repo, ["rev-parse", "HEAD"]);

    const outputPath = path.join(repo, "github-output.txt");
    const result = await execFileAsync(process.execPath, [scriptPath, "--base", base, "--head", head, "--author", "ada"], {
      cwd: repo,
      env: { ...process.env, GITHUB_OUTPUT: outputPath },
    });

    expect(result.stdout).toContain("submission_only=true");
    expect(await readFile(outputPath, "utf8")).toBe("submission_only=true\n");
  });

  it("detects submission-only changes from the merge base when the pull request branch is stale", async () => {
    const repo = await createRepoFixture();
    await git(repo, ["init"]);
    await git(repo, ["config", "user.email", "test@example.com"]);
    await git(repo, ["config", "user.name", "Test User"]);
    await git(repo, ["add", "."]);
    await git(repo, ["commit", "-m", "initial"]);
    const baseBranch = await git(repo, ["branch", "--show-current"]);
    await git(repo, ["switch", "-c", "submission-pr"]);

    await git(repo, ["switch", baseBranch]);
    await mkdir(path.join(repo, "app"), { recursive: true });
    await writeFile(path.join(repo, "app", "page.tsx"), "export default function Page() { return null; }\n");
    await git(repo, ["add", "."]);
    await git(repo, ["commit", "-m", "advance base"]);
    const base = await git(repo, ["rev-parse", "HEAD"]);

    await git(repo, ["switch", "submission-pr"]);
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "Solution.java"), "class Solution { int[] twoSum() { return null; } }\n");
    await git(repo, ["add", "."]);
    await git(repo, ["commit", "-m", "add submission"]);
    const head = await git(repo, ["rev-parse", "HEAD"]);

    const outputPath = path.join(repo, "github-output.txt");
    const result = await execFileAsync(process.execPath, [scriptPath, "--base", base, "--head", head, "--author", "ada"], {
      cwd: repo,
      env: { ...process.env, GITHUB_OUTPUT: outputPath },
    });

    expect(result.stdout).toContain("submission_only=true");
    expect(await readFile(outputPath, "utf8")).toBe("submission_only=true\n");
  });
});
