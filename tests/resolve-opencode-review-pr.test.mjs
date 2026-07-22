import { describe, expect, it, vi } from "vitest";

import {
  listCandidatePullRequests,
  main,
  selectPullRequest,
} from "../scripts/resolve-opencode-review-pr.mjs";

const sha = (character) => character.repeat(40);

const expected = {
  baseRepository: "whoisyourbias/leetdash",
  baseBranch: "master",
  headRepository: "jhee22/leetdash",
  headBranch: "jeehee",
  headSha: sha("c"),
};

function pull(overrides = {}) {
  return {
    number: 49,
    state: "open",
    base: {
      ref: "master",
      sha: sha("b"),
      repo: { full_name: "whoisyourbias/leetdash" },
    },
    head: {
      ref: "jeehee",
      sha: sha("c"),
      repo: { full_name: "jhee22/leetdash" },
    },
    ...overrides,
  };
}

describe("selectPullRequest", () => {
  it("selects one exact fork pull request", () => {
    expect(selectPullRequest([pull()], expected)).toEqual({
      pullNumber: 49,
      baseSha: sha("b"),
      headSha: sha("c"),
    });
  });

  it("rejects zero exact matches", () => {
    expect(() => selectPullRequest([
      pull({
        head: {
          ref: "jeehee",
          sha: sha("d"),
          repo: { full_name: "jhee22/leetdash" },
        },
      }),
    ], expected)).toThrow("OpenCode pull-request resolution failed.");
  });

  it.each([
    ["base repository", { base: { ref: "master", sha: sha("b"), repo: { full_name: "other/leetdash" } } }],
    ["base branch", { base: { ref: "release", sha: sha("b"), repo: { full_name: "whoisyourbias/leetdash" } } }],
    ["head repository", { head: { ref: "jeehee", sha: sha("c"), repo: { full_name: "other/leetdash" } } }],
    ["head branch", { head: { ref: "other", sha: sha("c"), repo: { full_name: "jhee22/leetdash" } } }],
  ])("rejects a mismatched %s", (_name, override) => {
    expect(() => selectPullRequest([pull(override)], expected))
      .toThrow("OpenCode pull-request resolution failed.");
  });

  it("rejects ambiguous exact matches", () => {
    expect(() => selectPullRequest([pull(), pull({ number: 50 })], expected))
      .toThrow("OpenCode pull-request resolution failed.");
  });
});

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const validEnv = {
  GITHUB_REPOSITORY: "whoisyourbias/leetdash",
  GITHUB_TOKEN: "github-secret",
  GITHUB_OUTPUT: "/tmp/github-output",
  OPENCODE_BASE_BRANCH: "master",
  OPENCODE_HEAD_REPOSITORY: "jhee22/leetdash",
  OPENCODE_HEAD_BRANCH: "jeehee",
  OPENCODE_HEAD_SHA: sha("c"),
};

describe("listCandidatePullRequests", () => {
  it("queries and paginates open pull requests by base and fork head", async () => {
    const requests = [];
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ number: index + 1 }));
    const fetchImpl = async (url, init) => {
      const requestUrl = new URL(url);
      requests.push({ url: requestUrl, init });
      return jsonResponse(requestUrl.searchParams.get("page") === "1" ? firstPage : [pull()]);
    };

    await expect(listCandidatePullRequests({
      fetchImpl,
      repository: "whoisyourbias/leetdash",
      token: "github-secret",
      baseBranch: "master",
      headRepository: "jhee22/leetdash",
      headBranch: "jeehee",
    })).resolves.toEqual([...firstPage, pull()]);

    expect(requests).toHaveLength(2);
    expect(requests.map(({ url }) => ({
      pathname: url.pathname,
      state: url.searchParams.get("state"),
      base: url.searchParams.get("base"),
      head: url.searchParams.get("head"),
      perPage: url.searchParams.get("per_page"),
      page: url.searchParams.get("page"),
    }))).toEqual([
      {
        pathname: "/repos/whoisyourbias/leetdash/pulls",
        state: "open",
        base: "master",
        head: "jhee22:jeehee",
        perPage: "100",
        page: "1",
      },
      {
        pathname: "/repos/whoisyourbias/leetdash/pulls",
        state: "open",
        base: "master",
        head: "jhee22:jeehee",
        perPage: "100",
        page: "2",
      },
    ]);
    expect(requests.every(({ init }) => init.method === "GET")).toBe(true);
    expect(requests.every(({ init }) => init.headers.Authorization === "Bearer github-secret")).toBe(true);
  });
});

describe("resolver CLI", () => {
  it("writes validated GitHub step outputs", async () => {
    const appendOutput = vi.fn(async () => {});
    const stderr = vi.fn();

    await expect(main({
      env: validEnv,
      fetchImpl: async () => jsonResponse([pull()]),
      appendOutput,
      stderr,
    })).resolves.toEqual({
      exitCode: 0,
      resolution: {
        pullNumber: 49,
        baseSha: sha("b"),
        headSha: sha("c"),
      },
    });

    expect(appendOutput).toHaveBeenCalledOnce();
    expect(appendOutput).toHaveBeenCalledWith(
      "/tmp/github-output",
      `pull-number=49\nbase-sha=${sha("b")}\nhead-sha=${sha("c")}\n`,
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it.each(Object.keys(validEnv))("rejects missing %s before fetching", async (name) => {
    const env = { ...validEnv };
    delete env[name];
    const fetchImpl = vi.fn();
    const stderr = vi.fn();

    await expect(main({ env, fetchImpl, appendOutput: vi.fn(), stderr }))
      .resolves.toEqual({ exitCode: 1 });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith("OpenCode pull-request resolution failed.");
  });

  it.each([
    ["GITHUB_REPOSITORY", "../leetdash"],
    ["GITHUB_REPOSITORY", "owner/.."],
    ["OPENCODE_HEAD_REPOSITORY", "../leetdash"],
    ["OPENCODE_HEAD_REPOSITORY", "owner/.."],
  ])("rejects unsafe repository path %s=%s before fetching", async (name, value) => {
    const fetchImpl = vi.fn();
    const stderr = vi.fn();

    await expect(main({
      env: { ...validEnv, [name]: value },
      fetchImpl,
      appendOutput: vi.fn(),
      stderr,
    })).resolves.toEqual({ exitCode: 1 });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith("OpenCode pull-request resolution failed.");
  });

  it.each([
    ["API status", async () => jsonResponse({ raw: "provider-secret" }, { status: 500 }), vi.fn(async () => {})],
    ["invalid JSON", async () => new Response("raw-provider-secret", { status: 200 }), vi.fn(async () => {})],
    ["output write", async () => jsonResponse([pull()]), vi.fn(async () => { throw new Error("output-secret"); })],
  ])("sanitizes %s failures", async (_name, fetchImpl, appendOutput) => {
    const stderr = vi.fn();

    await expect(main({ env: validEnv, fetchImpl, appendOutput, stderr }))
      .resolves.toEqual({ exitCode: 1 });

    expect(stderr).toHaveBeenCalledWith("OpenCode pull-request resolution failed.");
    expect(stderr.mock.calls.flat().join(" ")).not.toMatch(/provider-secret|output-secret/);
  });
});
