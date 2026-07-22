import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const maxPullRequestFiles = 3000;

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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base" || value === "--head" || value === "--changed-files" || value === "--author") {
      args[value.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function normalizeRepoPath(value) {
  return value.trim().replace(/^\.\/+/, "");
}

function parseNameStatusText(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tabIndex = line.indexOf("\t");
      if (tabIndex > 0) {
        const status = line.slice(0, tabIndex);
        const filePath = normalizeRepoPath(line.slice(tabIndex + 1));
        return { status, path: filePath };
      }

      return { status: "M", path: normalizeRepoPath(line) };
    });
}

function parseNameStatusNul(raw) {
  const parts = raw.split("\0").filter(Boolean);
  const files = [];
  for (let index = 0; index < parts.length; index += 2) {
    files.push({ status: parts[index], path: normalizeRepoPath(parts[index + 1] ?? "") });
  }
  return files.filter((file) => file.path);
}

function getChangedFiles({ base, head, changedFilesPath }) {
  if (changedFilesPath) {
    return parseNameStatusText(readFileSync(changedFilesPath, "utf8"));
  }

  if (!base || !head) {
    throw new Error("Pass --base/--head or --changed-files.");
  }

  const raw = execFileSync("git", ["diff", "--name-status", "--no-renames", "-z", `${base}...${head}`], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return parseNameStatusNul(raw);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
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
      githubUsername: String(user.githubUsername),
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

  const targets = new Set();
  for (const list of catalog.lists) {
    const sourceKey = typeof list.key === "string" ? list.key.trim() : "";
    if (!sourceKey || !Array.isArray(list.items)) {
      continue;
    }

    for (const item of list.items) {
      const submissionKey = typeof item.submissionKey === "string" ? item.submissionKey.trim() : "";
      if (submissionKey) {
        targets.add(`${sourceKey}/${submissionKey}`);
      }
    }
  }
  return targets;
}

function findUserForPath(users, filePath) {
  return users.find((user) => filePath.startsWith(`${user.submissionsPath}/`));
}

function findUserForGithubUsername(users, githubUsername) {
  const normalized = githubUsername.toLowerCase();
  return users.find((user) => user.githubUsername.toLowerCase() === normalized);
}

function isSubmissionArtifactName(filename) {
  const normalized = filename.toLowerCase();
  if (normalized === "readme.md" || normalized === "meta.json") {
    return true;
  }

  const [basename, extension, ...extra] = filename.split(".");
  return (
    extra.length === 0 &&
    basename?.toLowerCase() === "solution" &&
    Boolean(extension) &&
    solutionExtensions.has(extension.toLowerCase())
  );
}

function hasCompletePullRequestFileList(pullRequest, files) {
  const changedFiles = pullRequest?.changed_files;
  return Number.isSafeInteger(changedFiles)
    && changedFiles >= 0
    && changedFiles <= maxPullRequestFiles
    && Array.isArray(files)
    && files.length === changedFiles;
}

function isParticipantSubmissionPath(filePath) {
  if (!filePath.startsWith("submissions/") || filePath === "submissions/README.md") {
    return false;
  }

  return filePath.split("/").length >= 5;
}

function isAllowedSubmissionStatus(status) {
  return status === "A" || status === "M" || status === "added" || status === "modified";
}

function validateMeta(filePath, errors) {
  let parsed;
  try {
    parsed = readJson(filePath);
  } catch {
    errors.push(`${filePath}: meta.json must be valid JSON.`);
    return;
  }

  if (parsed.status !== undefined && !["solved", "reviewing", "skipped"].includes(String(parsed.status).toLowerCase())) {
    errors.push(`${filePath}: status must be solved, reviewing, or skipped.`);
  }
  if (parsed.language !== undefined && typeof parsed.language !== "string") {
    errors.push(`${filePath}: language must be a string.`);
  }
  if (parsed.notes !== undefined && typeof parsed.notes !== "string") {
    errors.push(`${filePath}: notes must be a string.`);
  }
  if (parsed.solvedAt !== undefined) {
    const solvedAt = typeof parsed.solvedAt === "string" ? new Date(parsed.solvedAt) : undefined;
    if (!solvedAt || Number.isNaN(solvedAt.getTime())) {
      errors.push(`${filePath}: solvedAt must be a parseable date string.`);
    }
  }
}

function validateSubmissionFiles(changedFiles, options = {}) {
  const users = normalizeUsers(options.usersInput ?? readJson("data/users.json"));
  const targets = getSubmissionTargets(options.catalogInput ?? readJson("data/problem-catalog.json"));
  const errors = [];
  const authorLogin = options.authorLogin ? String(options.authorLogin) : "";
  const authorUser = authorLogin ? findUserForGithubUsername(users, authorLogin) : undefined;
  const checkFileExists = options.checkFileExists ?? true;

  if (authorLogin && !authorUser) {
    errors.push(`pull request author ${authorLogin} is not registered in data/users.json.`);
  }

  for (const changedFile of changedFiles) {
    const filePath = changedFile.path;
    const user = findUserForPath(users, filePath);
    if (!user) {
      errors.push(`${filePath}: submission path must belong to a registered user in data/users.json.`);
      continue;
    }

    if (authorUser && user.githubUsername.toLowerCase() !== authorUser.githubUsername.toLowerCase()) {
      errors.push(`${filePath}: belongs to ${user.githubUsername}, not pull request author ${authorLogin}.`);
      continue;
    }

    if (!isAllowedSubmissionStatus(changedFile.status)) {
      errors.push(`${filePath}: submission-only PRs may add or update files, not delete them or rename them.`);
      continue;
    }

    const relativePath = filePath.slice(user.submissionsPath.length + 1);
    const parts = relativePath.split("/");
    if (parts.length !== 3) {
      errors.push(`${filePath}: expected ${user.submissionsPath}/<sourceKey>/<submissionKey>/<file>.`);
      continue;
    }

    const [sourceKey, submissionKey, filename] = parts;
    if (!targets.has(`${sourceKey}/${submissionKey}`)) {
      errors.push(`${filePath}: ${sourceKey}/${submissionKey} is not in data/problem-catalog.json.`);
    }

    if (!isSubmissionArtifactName(filename)) {
      errors.push(`${filePath}: file must be solution.<supported ext>, README.md, or meta.json.`);
    }

    if (checkFileExists && !existsSync(path.join(process.cwd(), filePath))) {
      errors.push(`${filePath}: changed file does not exist in the checkout.`);
    } else if (checkFileExists && filename.toLowerCase() === "meta.json") {
      validateMeta(filePath, errors);
    }
  }

  return errors;
}

function writeGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const changedFiles = getChangedFiles({
    base: args.base,
    head: args.head,
    changedFilesPath: args["changed-files"],
  });

  const invalidSubmissionPaths = changedFiles.filter(
    (file) => file.path.startsWith("submissions/") && file.path !== "submissions/README.md" && !isParticipantSubmissionPath(file.path),
  );

  if (invalidSubmissionPaths.length > 0) {
    writeGithubOutput("submission_only", "false");
    console.error("Invalid paths under submissions/:");
    for (const file of invalidSubmissionPaths) {
      console.error(`- ${file.path}`);
    }
    process.exitCode = 1;
    return;
  }

  const submissionOnly = changedFiles.length > 0 && changedFiles.every((file) => isParticipantSubmissionPath(file.path));
  writeGithubOutput("submission_only", String(submissionOnly));

  if (!submissionOnly) {
    console.log("submission_only=false");
    return;
  }

  const errors = validateSubmissionFiles(changedFiles, { authorLogin: args.author });
  if (errors.length > 0) {
    console.error("Submission validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`submission_only=true; validated ${changedFiles.length} changed submission file(s).`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}

export {
  getChangedFiles,
  hasCompletePullRequestFileList,
  isParticipantSubmissionPath,
  isSubmissionArtifactName,
  validateSubmissionFiles,
};
