import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/opencode-review.yml";

function readWorkflow() {
  return readFileSync(workflowPath, "utf8").replaceAll("\r\n", "\n");
}

describe("trusted OpenCode review workflow", () => {
  it("runs from workflow_run only for completed Deploy Pages pull-request runs", () => {
    expect(existsSync(workflowPath)).toBe(true);
    const workflow = readWorkflow();

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["Deploy GitHub Pages"]');
    expect(workflow).toContain("types:\n      - completed");
    expect(workflow).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).not.toContain("workflow_run.pull_requests[0]");
    expect(workflow).not.toContain("pull_request_target:");
  });

  it("resolves a fork PR from trusted default-branch code before checking out its base", () => {
    const workflow = readWorkflow();

    expect(workflow.match(/uses: actions\/checkout@v6/g)).toHaveLength(2);
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(2);
    expect(workflow).toContain("ref: ${{ github.event.repository.default_branch }}");
    expect(workflow).toContain("id: resolve-pr");
    expect(workflow).toContain("node scripts/resolve-opencode-review-pr.mjs");
    expect(workflow).toContain("OPENCODE_BASE_BRANCH: ${{ github.event.repository.default_branch }}");
    expect(workflow).toContain("OPENCODE_HEAD_REPOSITORY: ${{ github.event.workflow_run.head_repository.full_name }}");
    expect(workflow).toContain("OPENCODE_HEAD_BRANCH: ${{ github.event.workflow_run.head_branch }}");
    expect(workflow).toContain("OPENCODE_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}");
    expect(workflow).toContain("ref: ${{ steps.resolve-pr.outputs.base-sha }}");
    expect(workflow).not.toMatch(/ref:.*(?:head_sha|\.head\.sha)/);
    expect(workflow).toContain("node scripts/opencode-review.mjs \\");
    expect(workflow).toContain('--base "${{ steps.resolve-pr.outputs.base-sha }}"');
    expect(workflow).toContain('--head "${{ steps.resolve-pr.outputs.head-sha }}"');
    expect(workflow).toContain('--pull-number "${{ steps.resolve-pr.outputs.pull-number }}"');
    expect(workflow).not.toContain("--submission-only");
  });

  it("grants only the permissions and secrets needed by trusted review code", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("review:\n    timeout-minutes: 45");
    expect(workflow).toContain("permissions:\n      contents: read\n      checks: write\n      pull-requests: write\n      statuses: write");
    expect(workflow).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(workflow).toContain("OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}");
    expect(workflow).toContain("OPENCODE_REVIEW_MODEL: ${{ vars.OPENCODE_REVIEW_MODEL }}");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("actions: write");
  });
});
