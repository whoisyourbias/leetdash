import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hasCompletePullRequestFileList,
  isParticipantSubmissionPath,
  validateSubmissionFiles,
} from "./validate-submission-pr.mjs";

const defaultBaseBranch = "master";
const defaultRequiredChecks = ["validate"];
const defaultRequiredStatuses = ["opencode-review-gate"];
const defaultRequiredCheckApp = "github-actions";
const defaultRequiredStatusCreator = "github-actions[bot]";
const defaultReviewWorkflow = "opencode-review.yml";
const defaultDeployWorkflow = "deploy-pages.yml";
const maxWorkflowRunPages = 10;

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

function normalizePullRequestFile(file) {
  return {
    status: file.status,
    path: file.filename,
  };
}

function selectLatestCheckRun(checkRuns, checkName, expectedApp) {
  const exactNameRuns = checkRuns.filter((checkRun) => checkRun?.name === checkName);
  if (exactNameRuns.some((checkRun) => typeof checkRun?.app?.slug !== "string")) return undefined;
  const authoritativeRuns = exactNameRuns.filter((checkRun) => checkRun.app.slug === expectedApp);
  if (
    authoritativeRuns.length === 0
    || authoritativeRuns.some((checkRun) => !Number.isSafeInteger(checkRun.id))
  ) {
    return undefined;
  }
  const latestId = Math.max(...authoritativeRuns.map((checkRun) => checkRun.id));
  const latestRuns = authoritativeRuns.filter((checkRun) => checkRun.id === latestId);
  return latestRuns.length === 1 ? latestRuns[0] : undefined;
}

function hasSuccessfulCheckRun(checkRuns, checkName, expectedApp) {
  const checkRun = selectLatestCheckRun(checkRuns, checkName, expectedApp);
  return checkRun?.status === "completed" && checkRun?.conclusion === "success";
}

function selectLatestCommitStatus(commitStatuses, context, expectedCreator) {
  const exactContextStatuses = commitStatuses.filter((status) => status?.context === context);
  if (exactContextStatuses.some((status) => typeof status?.creator?.login !== "string")) return undefined;
  const trustedStatuses = exactContextStatuses.filter((status) => status.creator.login === expectedCreator);
  if (
    trustedStatuses.length === 0
    || trustedStatuses.some((status) => !Number.isSafeInteger(status.id))
  ) {
    return undefined;
  }
  const latestId = Math.max(...trustedStatuses.map((status) => status.id));
  const latestStatuses = trustedStatuses.filter((status) => status.id === latestId);
  return latestStatuses.length === 1 ? latestStatuses[0] : undefined;
}

function selectLatestReviewWorkflowRun(reviewWorkflowRuns, headSha) {
  const displayTitle = `opencode-review:${headSha}`;
  const exactRuns = reviewWorkflowRuns.filter((run) => run?.display_title === displayTitle);
  const startedAtValues = exactRuns.map((run) => Date.parse(run?.run_started_at));
  if (
    exactRuns.length === 0
    || exactRuns.some((run, index) => (
      !Number.isSafeInteger(run.id)
      || run.id <= 0
      || !Number.isSafeInteger(run.run_attempt)
      || run.run_attempt <= 0
      || typeof run.html_url !== "string"
      || typeof run.run_started_at !== "string"
      || !Number.isFinite(startedAtValues[index])
    ))
  ) {
    return undefined;
  }
  const latestStartedAt = Math.max(...startedAtValues);
  const latestRuns = exactRuns.filter((_run, index) => startedAtValues[index] === latestStartedAt);
  return latestRuns.length === 1 ? latestRuns[0] : undefined;
}

function mergeReviewWorkflowRuns(previousRuns, refreshedRuns) {
  const malformedRuns = refreshedRuns.filter((run) => !Number.isSafeInteger(run?.id));
  const refreshedById = new Map();
  for (const run of refreshedRuns) {
    if (Number.isSafeInteger(run?.id)) refreshedById.set(run.id, run);
  }
  return [
    ...malformedRuns,
    ...refreshedById.values(),
    ...previousRuns.filter((run) => !refreshedById.has(run?.id)),
  ];
}

function hasSuccessfulCommitStatus(commitStatuses, context, expectedCreator, reviewWorkflowRuns, headSha) {
  const status = selectLatestCommitStatus(commitStatuses, context, expectedCreator);
  const reviewRun = selectLatestReviewWorkflowRun(reviewWorkflowRuns, headSha);
  return (
    status?.state === "success"
    && reviewRun?.status === "completed"
    && reviewRun?.conclusion === "success"
    && status.target_url === `${reviewRun.html_url}?attempt=${reviewRun.run_attempt}`
  );
}

function normalizeRequiredValues(requiredValues, fallback) {
  const values = Array.isArray(requiredValues) ? requiredValues : [requiredValues];
  const normalized = values.flatMap((value) => String(value).split(",")).map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function evaluatePullRequest({
  pullRequest,
  files,
  checkRuns,
  commitStatuses,
  reviewWorkflowRuns,
  users,
  catalog,
  baseBranch = defaultBaseBranch,
  requiredChecks = defaultRequiredChecks,
  requiredStatuses = defaultRequiredStatuses,
  requiredCheckApp = defaultRequiredCheckApp,
  requiredStatusCreator = defaultRequiredStatusCreator,
}) {
  if (pullRequest.base?.ref !== baseBranch) {
    return { eligible: false, reason: `base branch is ${pullRequest.base?.ref ?? "unknown"}, not ${baseBranch}.` };
  }

  if (pullRequest.draft) {
    return { eligible: false, reason: "pull request is a draft." };
  }

  const authorLogin = pullRequest.user?.login;
  if (!authorLogin) {
    return { eligible: false, reason: "pull request author is missing." };
  }

  const headSha = pullRequest.head?.sha;
  if (!headSha) {
    return { eligible: false, reason: "pull request head SHA is missing." };
  }

  if (!hasCompletePullRequestFileList(pullRequest, files)) {
    return { eligible: false, reason: "pull request file list is incomplete." };
  }

  if (pullRequest.mergeable === false || pullRequest.mergeable_state === "dirty") {
    return { eligible: false, reason: "pull request has merge conflicts." };
  }

  for (const requiredCheck of normalizeRequiredValues(requiredChecks, defaultRequiredChecks)) {
    if (!hasSuccessfulCheckRun(checkRuns, requiredCheck, requiredCheckApp)) {
      return { eligible: false, reason: `${requiredCheck} check is not successful for ${headSha}.` };
    }
  }

  for (const requiredStatus of normalizeRequiredValues(requiredStatuses, defaultRequiredStatuses)) {
    if (!hasSuccessfulCommitStatus(commitStatuses, requiredStatus, requiredStatusCreator, reviewWorkflowRuns, headSha)) {
      return { eligible: false, reason: `${requiredStatus} status is not successful for ${headSha}.` };
    }
  }

  if (files.length === 0) {
    return { eligible: false, reason: "pull request has no changed files." };
  }

  const invalidSubmissionPaths = files.filter(
    (file) => file.filename.startsWith("submissions/") && file.filename !== "submissions/README.md" && !isParticipantSubmissionPath(file.filename),
  );
  if (invalidSubmissionPaths.length > 0) {
    return { eligible: false, reason: `${invalidSubmissionPaths[0].filename}: invalid path under submissions/.` };
  }

  const changedFiles = files.map(normalizePullRequestFile);
  const errors = validateSubmissionFiles(changedFiles, {
    authorLogin,
    catalogInput: catalog,
    checkFileExists: false,
    usersInput: users,
  });

  if (errors.length > 0) {
    return { eligible: false, reason: errors[0] };
  }

  return { eligible: true };
}

class GitHubClient {
  constructor({ repository, token }) {
    this.repository = repository;
    this.token = token;
  }

  async request(method, apiPath, { body, params } = {}) {
    const url = new URL(`https://api.github.com/repos/${this.repository}${apiPath}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${apiPath} failed with ${response.status}: ${text}`);
    }

    return text ? JSON.parse(text) : null;
  }

  async paginateArray(apiPath, params = {}) {
    const items = [];
    for (let page = 1; ; page += 1) {
      const pageItems = await this.request("GET", apiPath, { params: { ...params, page, per_page: 100 } });
      items.push(...pageItems);
      if (pageItems.length < 100) {
        return items;
      }
    }
  }

  async paginateCheckRuns(sha) {
    const items = [];
    for (let page = 1; ; page += 1) {
      const pageResult = await this.request("GET", `/commits/${sha}/check-runs`, {
        params: { page, per_page: 100 },
      });
      items.push(...pageResult.check_runs);
      if (pageResult.check_runs.length < 100) {
        return items;
      }
    }
  }

  async paginateWorkflowRuns(workflowFile, { maxPages = maxWorkflowRunPages } = {}) {
    const items = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const pageResult = await this.request("GET", `/actions/workflows/${workflowFile}/runs`, {
        params: { event: "workflow_run", page, per_page: 100 },
      });
      if (!Array.isArray(pageResult?.workflow_runs)) {
        throw new Error("GitHub workflow runs response is malformed.");
      }
      items.push(...pageResult.workflow_runs);
      if (pageResult.workflow_runs.length < 100) {
        return items;
      }
    }
    return items;
  }

  listOpenPullRequests(baseBranch) {
    return this.paginateArray("/pulls", {
      base: baseBranch,
      direction: "asc",
      sort: "updated",
      state: "open",
    });
  }

  getPullRequest(number) {
    return this.request("GET", `/pulls/${number}`);
  }

  listPullRequestFiles(number) {
    return this.paginateArray(`/pulls/${number}/files`);
  }

  listCheckRuns(sha) {
    return this.paginateCheckRuns(sha);
  }

  listCommitStatuses(sha) {
    return this.paginateArray(`/commits/${sha}/statuses`);
  }

  listWorkflowRuns(workflowFile, options) {
    return this.paginateWorkflowRuns(workflowFile, options);
  }

  getWorkflowRun(runId) {
    return this.request("GET", `/actions/runs/${runId}`);
  }

  mergePullRequest(number, sha) {
    return this.request("PUT", `/pulls/${number}/merge`, {
      body: {
        merge_method: "merge",
        sha,
      },
    });
  }

  dispatchWorkflow(workflowFile, ref) {
    return this.request("POST", `/actions/workflows/${workflowFile}/dispatches`, {
      body: { ref },
    });
  }
}

async function sweepSubmissionPullRequests({
  client,
  users,
  catalog,
  baseBranch = defaultBaseBranch,
  requiredChecks = defaultRequiredChecks,
  requiredStatuses = defaultRequiredStatuses,
  requiredCheckApp = defaultRequiredCheckApp,
  requiredStatusCreator = defaultRequiredStatusCreator,
  reviewWorkflow = defaultReviewWorkflow,
  deployWorkflow = defaultDeployWorkflow,
}) {
  const pullRequests = await client.listOpenPullRequests(baseBranch);
  const reviewWorkflowRuns = await client.listWorkflowRuns(reviewWorkflow);
  const normalizedRequiredChecks = normalizeRequiredValues(requiredChecks, defaultRequiredChecks);
  const normalizedRequiredStatuses = normalizeRequiredValues(requiredStatuses, defaultRequiredStatuses);
  const results = [];
  let mergedCount = 0;

  for (const pullRequestSummary of pullRequests) {
    const pullRequest = await client.getPullRequest(pullRequestSummary.number);
    const files = await client.listPullRequestFiles(pullRequest.number);
    const checkRuns = await client.listCheckRuns(pullRequest.head.sha);
    const commitStatuses = await client.listCommitStatuses(pullRequest.head.sha);
    const decision = evaluatePullRequest({
      pullRequest,
      files,
      checkRuns,
      commitStatuses,
      reviewWorkflowRuns,
      users,
      catalog,
      baseBranch,
      requiredChecks: normalizedRequiredChecks,
      requiredStatuses: normalizedRequiredStatuses,
      requiredCheckApp,
      requiredStatusCreator,
    });

    if (!decision.eligible) {
      console.log(`#${pullRequest.number} skipped: ${decision.reason}`);
      results.push({ number: pullRequest.number, status: "skipped", reason: decision.reason });
      continue;
    }

    const refreshedPullRequest = await client.getPullRequest(pullRequestSummary.number);
    const refreshedFiles = await client.listPullRequestFiles(pullRequestSummary.number);
    const refreshedHeadSha = refreshedPullRequest?.head?.sha;
    const refreshedCheckRuns = refreshedHeadSha ? await client.listCheckRuns(refreshedHeadSha) : [];
    const refreshedCommitStatuses = refreshedHeadSha ? await client.listCommitStatuses(refreshedHeadSha) : [];
    const knownReviewRuns = refreshedHeadSha
      ? reviewWorkflowRuns.filter((run) => run?.display_title === `opencode-review:${refreshedHeadSha}`)
      : [];
    const refreshedKnownReviewRuns = await Promise.all(
      knownReviewRuns
        .filter((run) => Number.isSafeInteger(run?.id))
        .map((run) => client.getWorkflowRun(run.id)),
    );
    const recentReviewWorkflowRuns = refreshedHeadSha
      ? await client.listWorkflowRuns(reviewWorkflow, { maxPages: 1 })
      : [];
    const refreshedReviewWorkflowRuns = refreshedHeadSha
      ? mergeReviewWorkflowRuns(reviewWorkflowRuns, [...recentReviewWorkflowRuns, ...refreshedKnownReviewRuns])
      : [];
    const refreshedDecision = evaluatePullRequest({
      pullRequest: refreshedPullRequest,
      files: refreshedFiles,
      checkRuns: refreshedCheckRuns,
      commitStatuses: refreshedCommitStatuses,
      reviewWorkflowRuns: refreshedReviewWorkflowRuns,
      users,
      catalog,
      baseBranch,
      requiredChecks: normalizedRequiredChecks,
      requiredStatuses: normalizedRequiredStatuses,
      requiredCheckApp,
      requiredStatusCreator,
    });
    if (!refreshedDecision.eligible) {
      console.log(`#${pullRequest.number} skipped: ${refreshedDecision.reason}`);
      results.push({ number: pullRequest.number, status: "skipped", reason: refreshedDecision.reason });
      continue;
    }

    try {
      await client.mergePullRequest(pullRequestSummary.number, refreshedHeadSha);
      console.log(`#${pullRequestSummary.number} merged.`);
      mergedCount += 1;
      results.push({ number: pullRequestSummary.number, status: "merged" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`#${pullRequestSummary.number} merge failed: ${reason}`);
      results.push({ number: pullRequestSummary.number, status: "merge_failed", reason });
    }
  }

  if (mergedCount > 0 && deployWorkflow) {
    await client.dispatchWorkflow(deployWorkflow, baseBranch);
    console.log(`Triggered ${deployWorkflow} for ${baseBranch}.`);
  }

  return { mergedCount, results };
}

function appendStepSummary(result, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryPath) {
    return;
  }

  const lines = [
    "## Submission PR sweep",
    "",
    `Merged PRs: ${result.mergedCount}`,
    "",
    "| PR | Status | Reason |",
    "| --- | --- | --- |",
    ...result.results.map((item) => `| #${item.number} | ${item.status} | ${item.reason ?? ""} |`),
    "",
  ];
  appendFileSync(summaryPath, `${lines.join("\n")}\n`);
}

function assertNoMergeFailures(result) {
  const count = result.results.filter((item) => item.status === "merge_failed").length;
  if (count > 0) {
    throw new Error(`${count} pull request${count === 1 ? "" : "s"} failed to merge.`);
  }
}

async function main(options = {}) {
  const env = options.env ?? process.env;
  const token = env.GH_TOKEN ?? env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  if (!token) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN is required.");
  }
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }

  const baseBranch = env.SWEEP_BASE_BRANCH ?? defaultBaseBranch;
  const requiredChecks = env.SWEEP_REQUIRED_CHECKS ?? defaultRequiredChecks;
  const requiredStatuses = env.SWEEP_REQUIRED_STATUSES ?? defaultRequiredStatuses;
  const requiredCheckApp = env.SWEEP_REQUIRED_CHECK_APP ?? defaultRequiredCheckApp;
  const requiredStatusCreator = env.SWEEP_REQUIRED_STATUS_CREATOR ?? defaultRequiredStatusCreator;
  const reviewWorkflow = env.SWEEP_REVIEW_WORKFLOW ?? defaultReviewWorkflow;
  const deployWorkflow = env.SWEEP_DEPLOY_WORKFLOW ?? defaultDeployWorkflow;
  const client = options.client ?? new GitHubClient({ repository, token });
  const users = options.users ?? readJson("data/users.json");
  const catalog = options.catalog ?? readJson("data/problem-catalog.json");
  const result = await sweepSubmissionPullRequests({
    client,
    users,
    catalog,
    baseBranch,
    requiredChecks,
    requiredStatuses,
    requiredCheckApp,
    requiredStatusCreator,
    reviewWorkflow,
    deployWorkflow,
  });
  appendStepSummary(result, env.GITHUB_STEP_SUMMARY);
  assertNoMergeFailures(result);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export {
  assertNoMergeFailures,
  GitHubClient,
  evaluatePullRequest,
  main,
  selectLatestCheckRun,
  sweepSubmissionPullRequests,
};
