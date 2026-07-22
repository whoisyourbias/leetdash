import { appendFile, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ReviewFailure,
  buildReviewPrompt,
  normalizeQuestionData,
  parseReviewResult,
  renderInfrastructureFailure,
  resolveCatalogProblem,
  renderReviewComment,
} from "./opencode-review-core.mjs";
import { GitHubReviewClient, LeetCodeClient, OpenCodeClient } from "./opencode-review-clients.mjs";
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
  "problem-fetch": ["PROBLEM_FETCH_FAILED", "LeetCode question request failed."],
  "problem-parse": ["PROBLEM_DATA_INVALID", "LeetCode question data is invalid."],
  "model-request": ["MODEL_REQUEST_FAILED", "OpenCode review request failed."],
  "model-response": ["MODEL_RESPONSE_INVALID", "OpenCode review response is invalid."],
  "result-validation": ["REVIEW_RESULT_INVALID", "OpenCode review result is invalid."],
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
    stage: "catalog-resolve",
    reason: "CATALOG_MAPPING_FAILED",
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

function noSolutionsMarkdown({ headSha, runUrl }) {
  return [
    "<!-- leetdash-opencode-review -->",
    "## OpenCode submission review",
    `Commit: ${headSha}`,
    "No changed solution.* files require review.",
    `Workflow URL: ${runUrl}`,
  ].join("\n");
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
  return value.split(source).join("[submitted source redacted]");
}

function redactReviewResult(result, source) {
  return {
    ...result,
    summary: redactModelText(result.summary, source),
    correctness: {
      ...result.correctness,
      reason: redactModelText(result.correctness.reason, source),
    },
    complexity: {
      ...result.complexity,
      time: redactModelText(result.complexity.time, source),
      space: redactModelText(result.complexity.space, source),
      reason: redactModelText(result.complexity.reason, source),
    },
    blocking_findings: result.blocking_findings.map((finding) => ({
      ...finding,
      reason: redactModelText(finding.reason, source),
      evidence: redactModelText(finding.evidence, source),
      counterexample: {
        input: redactModelText(finding.counterexample.input, source),
        expected: redactModelText(finding.counterexample.expected, source),
        actual: redactModelText(finding.counterexample.actual, source),
      },
    })),
    non_blocking_suggestions: result.non_blocking_suggestions.map((suggestion) => ({
      ...suggestion,
      suggestion: redactModelText(suggestion.suggestion, source),
    })),
  };
}

async function reviewPullRequest({
  githubClient,
  leetcodeClient,
  openCodeClient,
  readFile: readSource = defaultSourceReader,
  catalog,
  loadCatalog = defaultCatalogLoader,
  changedFiles,
  loadChangedFiles = async () => [],
  loadReviewScope,
  headSha,
  pullNumber,
  runUrl,
  apiKey,
  model,
  summaryPath,
  submissionOnly,
}) {
  const check = await githubClient.createCheck({
    headSha,
    title: "OpenCode review started",
    summary: "Submission review is running.",
  });
  const questions = new Map();
  const reviewedResults = [];
  const results = [];
  let stage = "catalog-resolve";
  let failure;
  let markdown;
  let conclusion = "success";
  let activeSubmissionOnly = false;

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
      if (paths.length === 0) {
        markdown = noSolutionsMarkdown({ headSha, runUrl });
      } else {
        stage = "catalog-resolve";
        const activeCatalog = catalog ?? await loadCatalog();
        for (const file of paths) {
          stage = "catalog-resolve";
          const resolved = resolveCatalogProblem(file.path, activeCatalog);
          const source = await readSource(resolved.path);
          stage = "problem-fetch";
          if (!questions.has(resolved.slug)) questions.set(resolved.slug, leetcodeClient.getQuestion(resolved.slug));
          const rawQuestion = await questions.get(resolved.slug);
          stage = "problem-parse";
          const question = normalizeQuestionData(rawQuestion, resolved.extension);
          const prompt = buildReviewPrompt({ resolved, question, source });
          stage = "model-request";
          const raw = await openCodeClient.review({ model, apiKey, prompt });
          stage = "model-response";
          reviewedResults.push({ result: parseReviewResult(raw, resolved.path), source });
        }
        results.push(...reviewedResults.map(({ result, source }) => redactReviewResult(result, source)));
        conclusion = results.every((result) => result.verdict === "PASS") ? "success" : "failure";
        markdown = renderReviewComment({ headSha, results, runUrl });
      }
    }
  } catch (error) {
    failure = error instanceof ReviewFailure ? error : failureForStage(stage);
    conclusion = "failure";
    markdown = renderInfrastructureFailure({ headSha, failure, runUrl });
  }

  let summary = markdown;
  if (activeSubmissionOnly || failure) {
    try {
      await githubClient.upsertReviewComment({ pullNumber, body: markdown });
    } catch {
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
  return { results, conclusion, markdown, ...(failure ? { failure } : {}) };
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
    leetcodeClient: options.leetcodeClient ?? new LeetCodeClient(),
    openCodeClient: options.openCodeClient ?? new OpenCodeClient(),
    readFile: options.readFile ?? ((filePath) => githubClient.getFileContent({
      path: filePath,
      ref: args.head,
      repository: trustedHeadRepository,
    })),
    catalog: options.catalog,
    loadCatalog,
    loadReviewScope,
    headSha: args.head,
    pullNumber: Number(args.pullNumber),
    runUrl,
    apiKey: env.OPENCODE_API_KEY,
    model: env.OPENCODE_REVIEW_MODEL,
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
