import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    if (filename.includes("/") || filename === "meta.json" || filename === "README.md") {
      continue;
    }

    const [basename, extension] = filename.split(".");
    if (basename === "solution" && extension && solutionExtensions.has(extension.toLowerCase())) {
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
      const problemSlug = typeof item.slug === "string" ? item.slug.trim() : "";
      const submissionKey = typeof item.submissionKey === "string" ? item.submissionKey.trim() : "";
      if (!problemSlug || !submissionKey) {
        throw new Error(`Catalog list ${sourceKey} has an item missing slug or submissionKey.`);
      }

      targets.push({ sourceKey, submissionKey, problemSlug });
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
  const submissionsBySlug = new Map();

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
      const submission = {
        id: `${user.id}:${target.problemSlug}`,
        userId: user.id,
        problemSlug: target.problemSlug,
        sourceKey: target.sourceKey,
        submissionKey: target.submissionKey,
        status: "SOLVED",
        language: inferLanguage(solutionPath),
        solutionPath,
        readmePath,
        githubUrl: solutionPath ? blobUrl(solutionPath) : undefined,
        source: "solution-file",
        generatedAt,
      };
      const existing = submissionsBySlug.get(target.problemSlug);
      if (!existing || shouldReplaceSubmission(existing, submission)) {
        submissionsBySlug.set(target.problemSlug, submission);
      }
      continue;
    }

    const parsed = await parseMeta(path.join(repoRoot, metaPath));
    const status = parsed.status ?? (solutionPath ? "SOLVED" : "REVIEWING");
    const submission = {
      id: `${user.id}:${target.problemSlug}`,
      userId: user.id,
      problemSlug: target.problemSlug,
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
      rawMeta: parsed.rawMeta,
      generatedAt,
    };
    const existing = submissionsBySlug.get(target.problemSlug);
    if (!existing || shouldReplaceSubmission(existing, submission)) {
      submissionsBySlug.set(target.problemSlug, submission);
    }
  }

  return [...submissionsBySlug.values()].sort((left, right) => left.problemSlug.localeCompare(right.problemSlug));
}

async function buildProgress() {
  const [catalog, usersInput] = await Promise.all([readJson(catalogPath), readJson(usersPath)]);
  const generatedAt = new Date().toISOString();
  const users = normalizeUsers(usersInput);
  const submissionTargets = getSubmissionTargets(catalog);
  const allPaths = new Set((await listFiles(repoRoot)).map((filePath) => toPosixPath(path.relative(repoRoot, filePath))));

  const usersWithSubmissions = [];
  for (const user of users) {
    usersWithSubmissions.push({
      ...user,
      submissions: await collectUserSubmissions({ user, submissionTargets, allPaths, generatedAt }),
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
