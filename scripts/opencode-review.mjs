import { appendFile, readFile } from "node:fs/promises";
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
import { getChangedFiles, isSubmissionArtifactName } from "./validate-submission-pr.mjs";

const solutionName = /^solution\.[^.\/]+$/i;
const deliveryDiagnostic = "Comment delivery: GitHub review comment delivery failed.";

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

async function reviewPullRequest({
  githubClient,
  leetcodeClient,
  openCodeClient,
  readFile: readSource = readFile,
  catalog,
  changedFiles = [],
  headSha,
  pullNumber,
  runUrl,
  apiKey,
  model,
  summaryPath,
  submissionOnly = false,
}) {
  const check = await githubClient.createCheck({
    headSha,
    title: "OpenCode review started",
    summary: "Submission review is running.",
  });
  const paths = submissionOnly ? changedFiles.filter(isReviewableSolution) : [];
  const questions = new Map();
  const results = [];
  let stage = "catalog-resolve";
  let failure;
  let markdown;
  let conclusion = "success";

  if (!submissionOnly) {
    markdown = notApplicableMarkdown();
  } else if (paths.length === 0) {
    markdown = noSolutionsMarkdown({ headSha, runUrl });
  } else {
    try {
      for (const file of paths) {
        stage = "catalog-resolve";
        const resolved = resolveCatalogProblem(file.path, catalog);
        const source = await readSource(resolved.path, "utf8");
        stage = "problem-fetch";
        if (!questions.has(resolved.slug)) questions.set(resolved.slug, leetcodeClient.getQuestion(resolved.slug));
        const rawQuestion = await questions.get(resolved.slug);
        stage = "problem-parse";
        const question = normalizeQuestionData(rawQuestion, resolved.extension);
        const prompt = buildReviewPrompt({ resolved, question, source });
        stage = "model-request";
        const raw = await openCodeClient.review({ model, apiKey, prompt });
        stage = "model-response";
        results.push(parseReviewResult(raw, resolved.path));
      }
      conclusion = results.every((result) => result.verdict === "PASS") ? "success" : "failure";
      markdown = renderReviewComment({ headSha, results, runUrl });
    } catch (error) {
      failure = error instanceof ReviewFailure ? error : failureForStage(stage);
      conclusion = "failure";
      markdown = renderInfrastructureFailure({ headSha, failure, runUrl });
    }
  }

  let summary = markdown;
  if (submissionOnly) {
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
      args.submissionOnly = true;
    } else if (["--base", "--head", "--pull-number", "--changed-files"].includes(argument)) {
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
  if (!args.head) missing.push("--head");
  if (!env.GITHUB_SERVER_URL) missing.push("GITHUB_SERVER_URL");
  if (!env.GITHUB_RUN_ID) missing.push("GITHUB_RUN_ID");
  if (args.submissionOnly && !env.OPENCODE_API_KEY) missing.push("OPENCODE_API_KEY");
  if (args.submissionOnly && !env.OPENCODE_REVIEW_MODEL) missing.push("OPENCODE_REVIEW_MODEL");
  return missing;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const missing = requiredConfiguration(args, process.env);
  if (missing.length > 0) {
    console.error(`Missing required configuration: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const runUrl = `${process.env.GITHUB_SERVER_URL.replace(/\/$/, "")}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const changedFiles = getChangedFiles({
    base: args.base,
    head: args.head,
    changedFilesPath: args.changedFiles,
  });
  const catalog = JSON.parse(await readFile(path.join(process.cwd(), "data", "problem-catalog.json"), "utf8"));
  await reviewPullRequest({
    githubClient: new GitHubReviewClient({ repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN }),
    leetcodeClient: new LeetCodeClient(),
    openCodeClient: new OpenCodeClient(),
    catalog,
    changedFiles,
    headSha: args.head,
    pullNumber: Number(args.pullNumber),
    runUrl,
    apiKey: process.env.OPENCODE_API_KEY,
    model: process.env.OPENCODE_REVIEW_MODEL,
    summaryPath: process.env.GITHUB_STEP_SUMMARY,
    submissionOnly: args.submissionOnly,
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("OpenCode review execution failed.");
    process.exitCode = 1;
  });
}

export { appendReviewSummary, main, reviewPullRequest };
