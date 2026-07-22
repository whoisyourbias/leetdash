import { appendFile, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ReviewFailure,
  buildMascotUrl,
  buildReviewPrompt,
  parseSubmissionSolutionPath,
  renderReviewFileComment,
  renderReviewFileWarning,
  renderReviewSummary,
  renderReviewWarning,
  reviewContentKey,
  reviewFileKey,
  sanitizeReviewMarkdown,
} from "./opencode-review-core.mjs";
import { GitHubReviewClient, OpenCodeClient } from "./opencode-review-clients.mjs";
import {
  hasCompletePullRequestFileList,
  isParticipantSubmissionPath,
  isSubmissionArtifactName,
  validateSubmissionFiles,
} from "./validate-submission-pr.mjs";

const solutionName = /^solution\.[^.\/]+$/i;
const deliveryDiagnostic = "Comment delivery: GitHub review comment delivery failed.";
const embeddedSourceRedactionMinimumLength = 16;

const safeFailures = Object.freeze({
  "catalog-resolve": ["CATALOG_MAPPING_FAILED", "Submission review paths could not be resolved."],
  "path-parse": ["SUBMISSION_PATH_INVALID", "The submission solution path could not be parsed."],
  "source-read": ["SOURCE_READ_FAILED", "Submission source is unavailable."],
  "model-request": ["MODEL_REQUEST_FAILED", "OpenCode review request failed."],
  "model-response": ["MODEL_RESPONSE_INVALID", "OpenCode review response is invalid."],
});

function isReviewableSolution(file) {
  return (file.status === "A" || file.status === "M")
    && isSubmissionArtifactName(file.path.slice(file.path.lastIndexOf("/") + 1))
    && solutionName.test(file.path.slice(file.path.lastIndexOf("/") + 1));
}

async function appendReviewSummary(markdown, summaryPath) {
  if (summaryPath) await appendFile(summaryPath, `${markdown}\n`, "utf8");
}

function failureForStage(stage) {
  const [reason, detail] = safeFailures[stage] ?? safeFailures["catalog-resolve"];
  return new ReviewFailure({ stage: safeFailures[stage] ? stage : "catalog-resolve", reason, detail });
}

function sourceReadFailure() {
  return new ReviewFailure({
    stage: "source-read",
    reason: "SOURCE_READ_FAILED",
    detail: "Submission source is unavailable.",
  });
}

function changedFilesLoadFailure() {
  return new ReviewFailure({
    stage: "catalog-resolve",
    reason: "CATALOG_MAPPING_FAILED",
    detail: "변경된 제출 파일 목록을 가져오지 못했습니다.",
  });
}

function normalizePullRequestFile(file) {
  if (!file || typeof file.status !== "string" || typeof file.filename !== "string") {
    throw changedFilesLoadFailure();
  }
  const statuses = { added: "A", modified: "M", removed: "D", renamed: "R" };
  return { status: statuses[file.status] ?? file.status, path: file.filename };
}

async function loadTrustedPullRequestScope({
  githubClient,
  pullNumber,
  baseSha,
  headSha,
  catalog,
  users,
}) {
  let pullRequest;
  try {
    pullRequest = await githubClient.getPullRequest(pullNumber);
  } catch {
    throw changedFilesLoadFailure();
  }
  if (
    pullRequest?.number !== pullNumber
    || pullRequest?.base?.sha !== baseSha
    || pullRequest?.head?.sha !== headSha
    || typeof pullRequest?.head?.repo?.full_name !== "string"
    || !/^[^/\s]+\/[^/\s]+$/.test(pullRequest.head.repo.full_name)
    || typeof pullRequest?.user?.login !== "string"
  ) {
    throw changedFilesLoadFailure();
  }

  let files;
  try {
    files = await githubClient.listPullRequestFiles(pullNumber);
  } catch {
    throw changedFilesLoadFailure();
  }
  if (!hasCompletePullRequestFileList(pullRequest, files)) throw changedFilesLoadFailure();
  const changedFiles = files.map(normalizePullRequestFile);
  const submissionOnly = changedFiles.length > 0
    && changedFiles.every((file) => isParticipantSubmissionPath(file.path));
  if (submissionOnly) {
    const errors = validateSubmissionFiles(changedFiles, {
      authorLogin: pullRequest.user.login,
      catalogInput: catalog,
      checkFileExists: false,
      usersInput: users,
    });
    if (errors.length > 0) throw changedFilesLoadFailure();
  }
  return { submissionOnly, changedFiles, headRepository: pullRequest.head.repo.full_name };
}

async function defaultSourceReader(filePath, {
  checkoutRoot = process.cwd(),
  lstat: lstatFile = lstat,
  readFile: readSource = readFile,
} = {}) {
  const root = path.resolve(checkoutRoot);
  const resolvedPath = path.resolve(root, String(filePath ?? ""));
  const relativePath = path.relative(root, resolvedPath);
  if (
    relativePath === ""
    || relativePath === ".."
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw sourceReadFailure();
  }

  let entry;
  try {
    entry = await lstatFile(resolvedPath);
  } catch {
    throw sourceReadFailure();
  }
  if (
    !entry
    || typeof entry.isSymbolicLink !== "function"
    || typeof entry.isFile !== "function"
    || entry.isSymbolicLink()
    || !entry.isFile()
  ) {
    throw sourceReadFailure();
  }

  try {
    return await readSource(resolvedPath, "utf8");
  } catch {
    throw sourceReadFailure();
  }
}

async function defaultCatalogLoader() {
  return JSON.parse(await readFile(path.join(process.cwd(), "data", "problem-catalog.json"), "utf8"));
}

async function defaultUsersLoader() {
  return JSON.parse(await readFile(path.join(process.cwd(), "data", "users.json"), "utf8"));
}

function notApplicableMarkdown() {
  return "OpenCode submission review is not applicable to this pull request.";
}

function reviewConfigurationFailure() {
  return new ReviewFailure({
    stage: "model-request",
    reason: "MODEL_REQUEST_FAILED",
    detail: "OpenCode review configuration is unavailable.",
  });
}

function redactModelText(value, source) {
  if (typeof value !== "string") return value;
  if (typeof source !== "string" || source.trim().length === 0) return value;
  if (value === source) return "[submitted source redacted]";
  if (source.trim().length < embeddedSourceRedactionMinimumLength) return value;
  const canonicalLines = (text) => text
    .replace(/\r\n?/g, "\n")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .split("\n")
    .map((rawLine) => {
      let line = rawLine.trim();
      if (!line || /^```/.test(line)) return "";
      let previous;
      do {
        previous = line;
        line = line
          .replace(/^>\s*/, "")
          .replace(/^[-*+]\s+/, "")
          .replace(/^\d+\s*(?:[|:.]|\))\s*/, "")
          .trimStart();
      } while (line !== previous);
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
  const sourceLines = canonicalLines(source);
  const valueLines = canonicalLines(value);
  let sourceIndex = 0;
  for (const line of valueLines) {
    if (line === sourceLines[sourceIndex]) sourceIndex += 1;
    if (sourceIndex === sourceLines.length) break;
  }
  if (sourceLines.length > 0 && sourceIndex === sourceLines.length) {
    return "[submitted source redacted]";
  }
  return value.split(source).join("[submitted source redacted]");
}

async function reviewOneFile({ file, readSource, openCodeClient, model, apiKey, cachedContentKey }) {
  let stage = "path-parse";
  let filePath = file.path;
  try {
    const parsed = parseSubmissionSolutionPath(file.path);
    filePath = parsed.path;
    stage = "source-read";
    const source = await readSource(parsed.path);
    const contentKey = reviewContentKey(source);
    if (cachedContentKey === contentKey) {
      return { path: filePath, status: "reused", contentKey };
    }
    const prompt = buildReviewPrompt({ path: parsed.path, language: parsed.extension, source });
    stage = "model-request";
    const raw = await openCodeClient.review({ model, apiKey, prompt });
    stage = "model-response";
    return {
      path: filePath,
      status: "reviewed",
      contentKey,
      markdown: sanitizeReviewMarkdown(redactModelText(raw, source)),
    };
  } catch (error) {
    return {
      path: filePath,
      status: "warning",
      failure: error instanceof ReviewFailure ? error : failureForStage(stage),
    };
  }
}

async function reviewPullRequest({
  githubClient,
  openCodeClient,
  readFile: readSource = defaultSourceReader,
  changedFiles,
  loadChangedFiles = async () => [],
  loadReviewScope,
  headSha,
  pullNumber,
  runUrl,
  apiKey,
  model,
  mascotUrl,
  summaryPath,
  submissionOnly,
}) {
  const check = await githubClient.createCheck({
    headSha,
    title: "OpenCode review started",
    summary: "Submission review is running.",
  });
  const results = [];
  let stage = "catalog-resolve";
  let failure;
  let markdown;
  let conclusion = "success";
  let activeSubmissionOnly = false;
  let trustedScopeValidated = typeof submissionOnly === "boolean";
  let managedComments = [];
  let managedCommentsLoaded = false;
  let commentDiscoveryAvailable = true;
  let deliveryFailureCount = 0;

  const loadManagedComments = async () => {
    if (managedCommentsLoaded) return;
    managedCommentsLoaded = true;
    try {
      managedComments = await githubClient.listManagedReviewComments(pullNumber);
    } catch {
      managedComments = [];
      commentDiscoveryAvailable = false;
    }
  };

  try {
    let activeChangedFiles = changedFiles;
    if (typeof submissionOnly === "boolean") {
      activeSubmissionOnly = submissionOnly;
    } else {
      if (typeof loadReviewScope !== "function") throw changedFilesLoadFailure();
      let scope;
      try {
        scope = await loadReviewScope();
      } catch (error) {
        if (error instanceof ReviewFailure) throw error;
        throw changedFilesLoadFailure();
      }
      if (!scope || typeof scope.submissionOnly !== "boolean" || !Array.isArray(scope.changedFiles)) {
        throw changedFilesLoadFailure();
      }
      trustedScopeValidated = true;
      activeSubmissionOnly = scope.submissionOnly;
      activeChangedFiles = scope.changedFiles;
    }

    if (!activeSubmissionOnly) {
      markdown = notApplicableMarkdown();
    } else {
      if (!apiKey || !model) throw reviewConfigurationFailure();
      if (activeChangedFiles === undefined) {
        try {
          activeChangedFiles = await loadChangedFiles();
        } catch {
          throw changedFilesLoadFailure();
        }
      }
      const paths = activeChangedFiles.filter((file) => {
        if (!file || typeof file.status !== "string" || typeof file.path !== "string") {
          throw new TypeError("Malformed changed-file entry.");
        }
        return isReviewableSolution(file);
      });
      await loadManagedComments();
      const summaryComment = managedComments.find((comment) => comment.kind === "summary");
      const fileComments = new Map(
        managedComments
          .filter((comment) => comment.kind === "file")
          .map((comment) => [comment.key, comment]),
      );

      for (const file of paths) {
        const fileComment = fileComments.get(reviewFileKey(file.path));
        const result = await reviewOneFile({
          file,
          readSource,
          openCodeClient,
          model,
          apiKey,
          cachedContentKey: fileComment?.contentKey,
        });
        results.push(result);
        if (result.status === "reused") continue;
        const body = result.status === "reviewed"
          ? renderReviewFileComment({ path: result.path, contentKey: result.contentKey, headSha, runUrl, mascotUrl, markdown: result.markdown })
          : renderReviewFileWarning({ path: result.path, headSha, runUrl, mascotUrl, failure: result.failure });
        if (!commentDiscoveryAvailable) {
          deliveryFailureCount += 1;
          continue;
        }
        try {
          await githubClient.upsertReviewComment({
            pullNumber,
            commentId: fileComment?.id,
            body,
          });
        } catch {
          deliveryFailureCount += 1;
        }
      }

      if (commentDiscoveryAvailable) {
        const currentKeys = new Set(paths.map((file) => reviewFileKey(file.path)));
        for (const comment of managedComments) {
          if (comment.kind !== "file" || currentKeys.has(comment.key)) continue;
          try {
            await githubClient.deleteReviewComment(comment.id);
          } catch {
            deliveryFailureCount += 1;
          }
        }
      }

      const reviewedCount = results.filter((result) => result.status === "reviewed").length;
      const reusedCount = results.filter((result) => result.status === "reused").length;
      const warningCount = results.filter((result) => result.status === "warning").length;
      const summaryArgs = {
        headSha,
        runUrl,
        mascotUrl,
        reviewedCount,
        reusedCount,
        warningCount,
        deliveryFailureCount,
        ...(paths.length === 0 ? { message: "변경된 solution.* 파일이 없어 리뷰를 생략했습니다." } : {}),
      };
      markdown = renderReviewSummary(summaryArgs);
      if (commentDiscoveryAvailable) {
        try {
          await githubClient.upsertReviewComment({ pullNumber, commentId: summaryComment?.id, body: markdown });
        } catch {
          deliveryFailureCount += 1;
          markdown = renderReviewSummary({ ...summaryArgs, deliveryFailureCount });
        }
      } else {
        deliveryFailureCount += 1;
        markdown = renderReviewSummary({ ...summaryArgs, deliveryFailureCount });
      }
    }
  } catch (error) {
    failure = error instanceof ReviewFailure ? error : failureForStage(stage);
    conclusion = trustedScopeValidated ? "success" : "failure";
    markdown = renderReviewWarning({ headSha, failure, runUrl, mascotUrl });
  }

  let summary = markdown;
  if (failure) {
    await loadManagedComments();
    if (commentDiscoveryAvailable) {
      const summaryComment = managedComments.find((comment) => comment.kind === "summary");
      try {
        await githubClient.upsertReviewComment({ pullNumber, commentId: summaryComment?.id, body: markdown });
      } catch {
        summary = `${markdown}\n\n${deliveryDiagnostic}`;
      }
    } else {
      summary = `${markdown}\n\n${deliveryDiagnostic}`;
    }
  }
  try {
    await appendReviewSummary(summary, summaryPath);
  } catch {
    // GitHub check completion remains the durable review signal.
  }
  await githubClient.completeCheck({
    checkRunId: check.id,
    conclusion,
    title: conclusion === "success" ? "OpenCode review passed" : "OpenCode review failed",
    summary,
  });
  return {
    results,
    failures: results.filter((result) => result.status === "warning").map((result) => result.failure),
    conclusion,
    markdown,
    ...(failure ? { failure } : {}),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--submission-only") {
      args.submissionOnlyInvalid = true;
      if (argv[index + 1] !== undefined && !argv[index + 1].startsWith("--")) index += 1;
    } else if (["--base", "--head", "--pull-number"].includes(argument)) {
      args[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function requiredConfiguration(args, env) {
  const missing = [];
  if (!env.GITHUB_REPOSITORY) missing.push("GITHUB_REPOSITORY");
  if (!env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  if (!/^\d+$/.test(args.pullNumber ?? "")) missing.push("--pull-number");
  if (!args.base) missing.push("--base");
  if (!args.head) missing.push("--head");
  if (!env.GITHUB_SERVER_URL) missing.push("GITHUB_SERVER_URL");
  if (!env.GITHUB_RUN_ID) missing.push("GITHUB_RUN_ID");
  return missing;
}

async function main(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const args = parseArgs(argv);
  if (args.submissionOnlyInvalid) {
    console.error("Invalid configuration: --submission-only is not supported");
    return { exitCode: 1 };
  }

  const missing = requiredConfiguration(args, env);
  if (missing.length > 0) {
    console.error(`Missing required configuration: ${missing.join(", ")}`);
    return { exitCode: 1 };
  }

  const runUrl = `${env.GITHUB_SERVER_URL.replace(/\/$/, "")}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const mascotUrl = options.mascotUrl ?? buildMascotUrl({
    serverUrl: env.GITHUB_SERVER_URL,
    repository: env.GITHUB_REPOSITORY,
    baseSha: args.base,
  });
  const githubClient = options.githubClient ?? new GitHubReviewClient({ repository: env.GITHUB_REPOSITORY, token: env.GITHUB_TOKEN });
  let trustedCatalog = options.catalog;
  let trustedUsers = options.users;
  let trustedHeadRepository = env.GITHUB_REPOSITORY;
  const loadCatalog = async () => {
    if (trustedCatalog === undefined) trustedCatalog = await (options.loadCatalog ?? defaultCatalogLoader)();
    return trustedCatalog;
  };
  const loadUsers = async () => {
    if (trustedUsers === undefined) trustedUsers = await (options.loadUsers ?? defaultUsersLoader)();
    return trustedUsers;
  };
  const configuredLoadReviewScope = options.loadReviewScope ?? (async () => loadTrustedPullRequestScope({
    githubClient,
    pullNumber: Number(args.pullNumber),
    baseSha: args.base,
    headSha: args.head,
    catalog: await loadCatalog(),
    users: await loadUsers(),
  }));
  const loadReviewScope = async () => {
    const scope = await configuredLoadReviewScope();
    if (typeof scope?.headRepository === "string") trustedHeadRepository = scope.headRepository;
    return scope;
  };
  const result = await reviewPullRequest({
    githubClient,
    openCodeClient: options.openCodeClient ?? new OpenCodeClient(),
    readFile: options.readFile ?? ((filePath) => githubClient.getFileContent({
      path: filePath,
      ref: args.head,
      repository: trustedHeadRepository,
    })),
    loadReviewScope,
    headSha: args.head,
    pullNumber: Number(args.pullNumber),
    runUrl,
    apiKey: env.OPENCODE_API_KEY,
    model: env.OPENCODE_REVIEW_MODEL,
    mascotUrl,
    summaryPath: options.summaryPath ?? env.GITHUB_STEP_SUMMARY,
  });
  return { exitCode: result.conclusion === "failure" ? 1 : 0, result };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().then(({ exitCode }) => { process.exitCode = exitCode; }).catch(() => {
    console.error("OpenCode review execution failed.");
    process.exitCode = 1;
  });
}

export { appendReviewSummary, defaultSourceReader, loadTrustedPullRequestScope, main, reviewPullRequest };
