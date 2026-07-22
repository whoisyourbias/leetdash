import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const resolutionFailureMessage = "OpenCode pull-request resolution failed.";
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const shaPattern = /^[0-9a-f]{40}$/;

class PullRequestResolutionFailure extends Error {
  constructor() {
    super(resolutionFailureMessage);
    this.name = "PullRequestResolutionFailure";
  }
}

function selectPullRequest(pulls, expected) {
  if (!Array.isArray(pulls)) throw new PullRequestResolutionFailure();
  const matches = pulls.filter((pull) => (
    pull?.state === "open"
    && pull?.base?.repo?.full_name === expected.baseRepository
    && pull?.base?.ref === expected.baseBranch
    && pull?.head?.repo?.full_name === expected.headRepository
    && pull?.head?.ref === expected.headBranch
    && pull?.head?.sha === expected.headSha
    && Number.isInteger(pull?.number)
    && pull.number > 0
    && shaPattern.test(pull?.base?.sha ?? "")
  ));
  if (matches.length !== 1) throw new PullRequestResolutionFailure();
  return {
    pullNumber: matches[0].number,
    baseSha: matches[0].base.sha,
    headSha: matches[0].head.sha,
  };
}

function validBranch(value) {
  return typeof value === "string"
    && value.length > 0
    && !value.includes("\r")
    && !value.includes("\n");
}

function validRepository(value) {
  if (!repositoryPattern.test(value ?? "")) return false;
  return value.split("/").every((segment) => segment !== "." && segment !== "..");
}

function validateLookup({ repository, token, baseBranch, headRepository, headBranch }) {
  if (
    !validRepository(repository)
    || !validRepository(headRepository)
    || typeof token !== "string"
    || token.length === 0
    || !validBranch(baseBranch)
    || !validBranch(headBranch)
  ) {
    throw new PullRequestResolutionFailure();
  }
}

async function listCandidatePullRequests({
  fetchImpl,
  repository,
  token,
  baseBranch,
  headRepository,
  headBranch,
}) {
  validateLookup({ repository, token, baseBranch, headRepository, headBranch });
  if (typeof fetchImpl !== "function") throw new PullRequestResolutionFailure();
  const [headOwner] = headRepository.split("/");
  const pulls = [];

  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(`https://api.github.com/repos/${repository}/pulls`);
    url.searchParams.set("state", "open");
    url.searchParams.set("base", baseBranch);
    url.searchParams.set("head", `${headOwner}:${headBranch}`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response?.ok) throw new PullRequestResolutionFailure();

    let pagePulls;
    try {
      pagePulls = await response.json();
    } catch {
      throw new PullRequestResolutionFailure();
    }
    if (!Array.isArray(pagePulls)) throw new PullRequestResolutionFailure();
    pulls.push(...pagePulls);
    if (pagePulls.length < 100) return pulls;
  }

  throw new PullRequestResolutionFailure();
}

function expectedFromEnvironment(env) {
  const expected = {
    baseRepository: env?.GITHUB_REPOSITORY,
    baseBranch: env?.OPENCODE_BASE_BRANCH,
    headRepository: env?.OPENCODE_HEAD_REPOSITORY,
    headBranch: env?.OPENCODE_HEAD_BRANCH,
    headSha: env?.OPENCODE_HEAD_SHA,
  };
  if (
    !validRepository(expected.baseRepository)
    || !validRepository(expected.headRepository)
    || !validBranch(expected.baseBranch)
    || !validBranch(expected.headBranch)
    || !shaPattern.test(expected.headSha ?? "")
    || typeof env?.GITHUB_TOKEN !== "string"
    || env.GITHUB_TOKEN.length === 0
    || typeof env?.GITHUB_OUTPUT !== "string"
    || env.GITHUB_OUTPUT.length === 0
  ) {
    throw new PullRequestResolutionFailure();
  }
  return expected;
}

async function main({
  env = process.env,
  fetchImpl = fetch,
  appendOutput = (outputPath, value) => appendFile(outputPath, value, "utf8"),
  stderr = console.error,
} = {}) {
  try {
    const expected = expectedFromEnvironment(env);
    const pulls = await listCandidatePullRequests({
      fetchImpl,
      repository: expected.baseRepository,
      token: env.GITHUB_TOKEN,
      baseBranch: expected.baseBranch,
      headRepository: expected.headRepository,
      headBranch: expected.headBranch,
    });
    const resolution = selectPullRequest(pulls, expected);
    await appendOutput(
      env.GITHUB_OUTPUT,
      `pull-number=${resolution.pullNumber}\nbase-sha=${resolution.baseSha}\nhead-sha=${resolution.headSha}\n`,
    );
    return { exitCode: 0, resolution };
  } catch {
    stderr(resolutionFailureMessage);
    return { exitCode: 1 };
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().then(({ exitCode }) => { process.exitCode = exitCode; });
}

export {
  PullRequestResolutionFailure,
  listCandidatePullRequests,
  main,
  selectPullRequest,
};
