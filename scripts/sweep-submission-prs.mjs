import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hasCompletePullRequestFileList,
  isParticipantSubmissionPath,
  validateSubmissionFiles,
} from "./validate-submission-pr.mjs";

const defaultBaseBranch = "master";
const defaultRequiredChecks = ["validate", "opencode-review"];
const defaultRequiredCheckApp = "github-actions";
const defaultDeployWorkflow = "deploy-pages.yml";

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

function normalizeRequiredChecks(requiredChecks = defaultRequiredChecks) {
  const values = Array.isArray(requiredChecks) ? requiredChecks : [requiredChecks];
  const normalized = values.flatMap((value) => String(value).split(",")).map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : defaultRequiredChecks;
}

function evaluatePullRequest({
  pullRequest,
  files,
  checkRuns,
  users,
  catalog,
  baseBranch = defaultBaseBranch,
  requiredChecks = defaultRequiredChecks,
  requiredCheckApp = defaultRequiredCheckApp,
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

  for (const requiredCheck of normalizeRequiredChecks(requiredChecks)) {
    if (!hasSuccessfulCheckRun(checkRuns, requiredCheck, requiredCheckApp)) {
      return { eligible: false, reason: `${requiredCheck} check is not successful for ${headSha}.` };
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
  requiredCheckApp = defaultRequiredCheckApp,
  deployWorkflow = defaultDeployWorkflow,
}) {
  const pullRequests = await client.listOpenPullRequests(baseBranch);
  const normalizedRequiredChecks = normalizeRequiredChecks(requiredChecks);
  const results = [];
  let mergedCount = 0;

  for (const pullRequestSummary of pullRequests) {
    const pullRequest = await client.getPullRequest(pullRequestSummary.number);
    const files = await client.listPullRequestFiles(pullRequest.number);
    const checkRuns = await client.listCheckRuns(pullRequest.head.sha);
    const decision = evaluatePullRequest({
      pullRequest,
      files,
      checkRuns,
      users,
      catalog,
      baseBranch,
      requiredChecks: normalizedRequiredChecks,
      requiredCheckApp,
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
    const refreshedDecision = evaluatePullRequest({
      pullRequest: refreshedPullRequest,
      files: refreshedFiles,
      checkRuns: refreshedCheckRuns,
      users,
      catalog,
      baseBranch,
      requiredChecks: normalizedRequiredChecks,
      requiredCheckApp,
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

function appendStepSummary(result) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
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
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

async function main() {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN is required.");
  }
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }

  const baseBranch = process.env.SWEEP_BASE_BRANCH ?? defaultBaseBranch;
  const requiredChecks = process.env.SWEEP_REQUIRED_CHECKS ?? defaultRequiredChecks;
  const requiredCheckApp = process.env.SWEEP_REQUIRED_CHECK_APP ?? defaultRequiredCheckApp;
  const deployWorkflow = process.env.SWEEP_DEPLOY_WORKFLOW ?? defaultDeployWorkflow;
  const client = new GitHubClient({ repository, token });
  const users = readJson("data/users.json");
  const catalog = readJson("data/problem-catalog.json");
  const result = await sweepSubmissionPullRequests({
    client,
    users,
    catalog,
    baseBranch,
    requiredChecks,
    requiredCheckApp,
    deployWorkflow,
  });
  appendStepSummary(result);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { GitHubClient, evaluatePullRequest, selectLatestCheckRun, sweepSubmissionPullRequests };
