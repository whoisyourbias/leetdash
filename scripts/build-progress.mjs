import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const solutionExtensions = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "dart",
  "go",
  "java",
  "js",
  "kt",
  "php",
  "py",
  "rb",
  "rs",
  "scala",
  "sql",
  "swift",
  "ts",
]);

const repoRoot = process.cwd();
const catalogPath = path.join(repoRoot, "data", "problem-catalog.json");
const usersPath = path.join(repoRoot, "data", "users.json");
const outputPath = path.join(repoRoot, "data", "progress.json");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "out"]);
const execFileAsync = promisify(execFile);
const gitAddedAtCache = new Map();
let warnedAboutGitActivity = false;
const seoulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function encodeBlobPath(value) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeRepositoryUrl(value) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().replace(/\.git$/, "");
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+)$/);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
  }

  if (trimmed.startsWith("https://github.com/")) {
    return trimmed;
  }

  return undefined;
}

function getRepositoryUrl() {
  return (
    normalizeRepositoryUrl(process.env.SOURCE_REPOSITORY_URL) ??
    normalizeRepositoryUrl(process.env.REPOSITORY_URL) ??
    normalizeRepositoryUrl(process.env.URL) ??
    (process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : undefined)
  );
}

function blobUrl(relativePath) {
  const repositoryUrl = getRepositoryUrl();
  if (!repositoryUrl) {
    return undefined;
  }

  const branch = process.env.BRANCH || process.env.HEAD || process.env.GITHUB_REF_NAME || "master";
  return `${repositoryUrl}/blob/${encodeURIComponent(branch)}/${encodeBlobPath(relativePath)}`;
}

function warnGitActivity(message) {
  if (warnedAboutGitActivity) {
    return;
  }

  warnedAboutGitActivity = true;
  console.warn(message);
}

function toSeoulDateKey(value) {
  const parts = Object.fromEntries(
    seoulDateFormatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function getGitAddedAt(relativePath) {
  if (gitAddedAtCache.has(relativePath)) {
    return gitAddedAtCache.get(relativePath);
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--diff-filter=A", "--format=%cI", "--", relativePath],
      { cwd: repoRoot, maxBuffer: 1024 * 1024 },
    );
    const timestamps = stdout.trim().split(/\r?\n/).filter(Boolean);
    const addedAt = timestamps.at(-1);
    gitAddedAtCache.set(relativePath, addedAt);
    return addedAt;
  } catch {
    warnGitActivity("Warning: unable to read Git history; activity calendar dates will be incomplete.");
    gitAddedAtCache.set(relativePath, undefined);
    return undefined;
  }
}

function getActivityArtifactPath({ user, submission, allPaths }) {
  if (submission.solutionPath) {
    return submission.solutionPath;
  }

  const metaPath = `${user.submissionsPath}/${submission.sourceKey}/${submission.submissionKey}/meta.json`;
  return allPaths.has(metaPath) ? metaPath : undefined;
}

async function buildUserActivity({ user, submissions, allPaths }) {
  const days = new Map();

  for (const submission of submissions) {
    if (submission.status !== "SOLVED") {
      continue;
    }

    const artifactPath = getActivityArtifactPath({ user, submission, allPaths });
    if (!artifactPath) {
      continue;
    }

    const addedAt = await getGitAddedAt(artifactPath);
    if (!addedAt) {
      continue;
    }

    const date = toSeoulDateKey(addedAt);
    const day = days.get(date) ?? { date, solved: 0, submissions: [] };
    day.solved += 1;
    day.submissions.push({
      problemKey: submission.problemKey,
      sourceKey: submission.sourceKey,
      submissionKey: submission.submissionKey,
    });
    days.set(date, day);
  }

  return [...days.values()].sort((left, right) => left.date.localeCompare(right.date));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function listFiles(root) {
  if (!(await exists(root))) {
    return [];
  }

  const files = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function inferLanguage(relativePath) {
  const extension = relativePath.split(".").pop();
  return extension ? extension.toUpperCase() : undefined;
}

function normalizeStatus(value) {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "solved") {
    return "SOLVED";
  }
  if (normalized === "reviewing") {
    return "REVIEWING";
  }
  if (normalized === "skipped") {
    return "SKIPPED";
  }
  return undefined;
}

function normalizeSolvedAt(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function getLatestCommitTime(relativePath) {
  try {
    const { stdout } = await execFileAsync("git", ["log", "-1", "--format=%cI", "--", relativePath], { cwd: repoRoot });
    const value = stdout.trim();
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  } catch {
    return undefined;
  }
}

async function parseMeta(metaPath) {
  try {
    const raw = JSON.parse(await readFile(metaPath, "utf8"));
    return {
      status: normalizeStatus(raw.status),
      language: typeof raw.language === "string" ? raw.language : undefined,
      solvedAt: normalizeSolvedAt(raw.solvedAt),
      notes: typeof raw.notes === "string" ? raw.notes : undefined,
      rawMeta: raw,
      invalid: false,
    };
  } catch {
    return {
      notes: "Invalid meta.json: JSON parse failed",
      invalid: true,
    };
  }
}

function findSolutionPath(paths, submissionRoot) {
  const solutionPrefix = `${submissionRoot}/`;
  for (const relativePath of paths) {
    if (!relativePath.startsWith(solutionPrefix)) {
      continue;
    }

    const filename = relativePath.slice(solutionPrefix.length);
    const normalizedFilename = filename.toLowerCase();
    if (filename.includes("/") || normalizedFilename === "meta.json" || normalizedFilename === "readme.md") {
      continue;
    }

    const [basename, extension] = filename.split(".");
    if (basename.toLowerCase() === "solution" && extension && solutionExtensions.has(extension.toLowerCase())) {
      return relativePath;
    }
  }

  return undefined;
}

function normalizeUsers(input) {
  const users = Array.isArray(input) ? input : input.users;
  if (!Array.isArray(users)) {
    throw new Error("data/users.json must be an array or an object with a users array.");
  }

  return users.map((user) => {
    if (!user.id || !user.displayName || !user.githubUsername) {
      throw new Error("Each user must include id, displayName, and githubUsername.");
    }

    return {
      id: String(user.id),
      displayName: String(user.displayName),
      githubUsername: String(user.githubUsername),
      active: user.active !== false,
      submissionsPath: user.submissionsPath
        ? toPosixPath(String(user.submissionsPath).replace(/^\/+/, "").replace(/\/+$/, ""))
        : `submissions/${user.githubUsername}`,
    };
  });
}

function getSubmissionTargets(catalog) {
  if (!Array.isArray(catalog.lists)) {
    throw new Error("data/problem-catalog.json must include a lists array.");
  }

  const targets = [];
  for (const list of catalog.lists) {
    const sourceKey = typeof list.key === "string" ? list.key.trim() : "";
    if (!sourceKey) {
      throw new Error("Each catalog list must include a key.");
    }
    if (!Array.isArray(list.items)) {
      throw new Error(`Catalog list ${sourceKey} must include an items array.`);
    }

    for (const item of list.items) {
      const problemKey = typeof item.problemKey === "string" ? item.problemKey.trim() : "";
      const submissionKey = typeof item.submissionKey === "string" ? item.submissionKey.trim() : "";
      if (!problemKey || !submissionKey) {
        throw new Error(`Catalog list ${sourceKey} has an item missing problemKey or submissionKey.`);
      }

      targets.push({ sourceKey, submissionKey, problemKey });
    }
  }

  return targets;
}

function getSubmissionRank(submission) {
  if (submission.status === "SOLVED") {
    return 3;
  }
  if (submission.status === "REVIEWING") {
    return 2;
  }
  if (submission.status === "SKIPPED") {
    return 1;
  }

  return 0;
}

function shouldReplaceSubmission(existing, candidate) {
  return getSubmissionRank(candidate) > getSubmissionRank(existing);
}

async function collectUserSubmissions({ user, submissionTargets, allPaths, generatedAt }) {
  const submissionsByProblemKey = new Map();

  for (const target of submissionTargets) {
    const submissionRoot = `${user.submissionsPath}/${target.sourceKey}/${target.submissionKey}`;
    const metaPath = `${submissionRoot}/meta.json`;
    const readmePath = allPaths.has(`${submissionRoot}/README.md`)
      ? `${submissionRoot}/README.md`
      : undefined;
    const solutionPath = findSolutionPath(allPaths, submissionRoot);
    const hasMeta = allPaths.has(metaPath);

    if (!hasMeta && !solutionPath) {
      continue;
    }

    if (!hasMeta) {
      const submittedAt = await getLatestCommitTime(solutionPath);
      const submission = {
        id: `${user.id}:${target.problemKey}`,
        userId: user.id,
        problemKey: target.problemKey,
        sourceKey: target.sourceKey,
        submissionKey: target.submissionKey,
        status: "SOLVED",
        language: inferLanguage(solutionPath),
        solutionPath,
        readmePath,
        githubUrl: solutionPath ? blobUrl(solutionPath) : undefined,
        source: "solution-file",
        submittedAt,
        generatedAt,
      };
      const existing = submissionsByProblemKey.get(target.problemKey);
      if (!existing || shouldReplaceSubmission(existing, submission)) {
        submissionsByProblemKey.set(target.problemKey, submission);
      }
      continue;
    }

    const parsed = await parseMeta(path.join(repoRoot, metaPath));
    const status = parsed.status ?? (solutionPath ? "SOLVED" : "REVIEWING");
    const submittedAt = await getLatestCommitTime(solutionPath ?? metaPath);
    const submission = {
      id: `${user.id}:${target.problemKey}`,
      userId: user.id,
      problemKey: target.problemKey,
      sourceKey: target.sourceKey,
      submissionKey: target.submissionKey,
      status,
      language: parsed.language ?? (solutionPath ? inferLanguage(solutionPath) : undefined),
      solvedAt: parsed.solvedAt,
      notes: parsed.notes,
      solutionPath,
      readmePath,
      githubUrl: blobUrl(solutionPath ?? metaPath),
      source: parsed.invalid ? "invalid-meta" : "meta",
      submittedAt,
      rawMeta: parsed.rawMeta,
      generatedAt,
    };
    const existing = submissionsByProblemKey.get(target.problemKey);
    if (!existing || shouldReplaceSubmission(existing, submission)) {
      submissionsByProblemKey.set(target.problemKey, submission);
    }
  }

  return [...submissionsByProblemKey.values()].sort((left, right) => left.problemKey.localeCompare(right.problemKey));
}

async function buildProgress() {
  const [catalog, usersInput] = await Promise.all([readJson(catalogPath), readJson(usersPath)]);
  const generatedAt = new Date().toISOString();
  const users = normalizeUsers(usersInput);
  const submissionTargets = getSubmissionTargets(catalog);
  const allPaths = new Set((await listFiles(repoRoot)).map((filePath) => toPosixPath(path.relative(repoRoot, filePath))));

  const usersWithSubmissions = [];
  for (const user of users) {
    const submissions = await collectUserSubmissions({ user, submissionTargets, allPaths, generatedAt });
    usersWithSubmissions.push({
      ...user,
      submissions,
      activity: await buildUserActivity({ user, submissions, allPaths }),
    });
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt,
        users: usersWithSubmissions,
      },
      null,
      2,
    )}\n`,
  );

  return usersWithSubmissions;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const users = await buildProgress();
  const submissionCount = users.reduce((sum, user) => sum + user.submissions.length, 0);
  console.log(`Built progress for ${users.length} users and ${submissionCount} submissions.`);
}

export { buildProgress };
