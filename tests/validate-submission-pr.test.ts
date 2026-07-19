import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  await writeJson(path.join(repo, "data", "problem-catalog.json"), {
    lists: [
      {
        key: "top-interview-easy",
        items: [{ slug: "two-sum", submissionKey: "1" }],
      },
    ],
  });
  await writeJson(path.join(repo, "data", "users.json"), {
    users: [{ id: "ada", displayName: "Ada Lovelace", githubUsername: "ada" }],
  });
  await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "1", "Solution.java"), "class Solution {}\n");
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

describe("validate-submission-pr", () => {
  it("marks valid participant submission changes as submission-only", async () => {
    const repo = await createRepoFixture();

    const result = await runValidator(repo, "A\tsubmissions/ada/top-interview-easy/1/Solution.java\n");

    expect(result.stdout).toContain("submission_only=true");
    expect(result.githubOutput).toBe("submission_only=true\n");
  });

  it("keeps application changes on the full CI path", async () => {
    const repo = await createRepoFixture();

    const result = await runValidator(repo, "M\tapp/page.tsx\n");

    expect(result.stdout).toContain("submission_only=false");
    expect(result.githubOutput).toBe("submission_only=false\n");
  });

  it("rejects submission-only changes for unknown catalog targets", async () => {
    const repo = await createRepoFixture();
    await mkdir(path.join(repo, "submissions", "ada", "top-interview-easy", "999"), { recursive: true });
    await writeFile(path.join(repo, "submissions", "ada", "top-interview-easy", "999", "Solution.java"), "class Solution {}\n");

    await expect(runValidator(repo, "A\tsubmissions/ada/top-interview-easy/999/Solution.java\n")).rejects.toMatchObject({
      stderr: expect.stringContaining("top-interview-easy/999 is not in data/problem-catalog.json"),
      githubOutput: "submission_only=true\n",
    });
  });

  it("rejects deletions in the fast submission-only path", async () => {
    const repo = await createRepoFixture();

    await expect(runValidator(repo, "D\tsubmissions/ada/top-interview-easy/1/Solution.java\n")).rejects.toMatchObject({
      stderr: expect.stringContaining("may add or update files, not delete them"),
      githubOutput: "submission_only=true\n",
    });
  });
});
