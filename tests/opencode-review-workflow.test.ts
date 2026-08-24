import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/opencode-review.yml";

function readWorkflow() {
  return readFileSync(workflowPath, "utf8").replaceAll("\r\n", "\n");
}

describe("trusted OpenCode review workflow", () => {
  it("runs from workflow_run for completed Deploy Pages pull-request runs", () => {
    expect(existsSync(workflowPath)).toBe(true);
    const workflow = readWorkflow();

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["Deploy GitHub Pages"]');
    expect(workflow).toContain("run-name: opencode-review:${{ github.event.workflow_run.head_sha || github.event.pull_request.head.sha }}");
    expect(workflow).toContain("types:\n      - completed");
    expect(workflow).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(workflow).toContain("(github.event_name == 'pull_request_target' || github.event.workflow_run.conclusion == 'success') &&");
    expect(workflow).toContain("steps.resolve-pr.outputs.is-draft != 'true'");
    expect(workflow).not.toContain("workflow_run.pull_requests[0]");
    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("github.event.label.name == 'ai-review:qwen'");
    expect(workflow).toContain("runs-on: ubuntu-latest\n    concurrency:");
  });

  it("reports submission validation failures from trusted code", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("name: Sync submission validation result");
    expect(workflow).toContain("node scripts/report-submission-validation.mjs \\");
    expect(workflow).toContain('--base "${{ steps.resolve-pr.outputs.base-sha }}"');
    expect(workflow).toContain('--head "${{ steps.resolve-pr.outputs.head-sha }}"');
    expect(workflow).toContain('--pull-number "${{ steps.resolve-pr.outputs.pull-number }}"');
    expect(workflow).toContain("pull-requests: write");
  });

  it("resolves a fork PR from trusted default-branch code before checking out its base", () => {
    const workflow = readWorkflow();

    expect(workflow.match(/uses: actions\/checkout@v6/g)).toHaveLength(2);
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(2);
    expect(workflow).toContain("ref: ${{ github.event.repository.default_branch }}");
    expect(workflow).toContain("id: resolve-pr");
    expect(workflow).toContain("node scripts/resolve-opencode-review-pr.mjs");
    expect(workflow).toContain("OPENCODE_BASE_BRANCH: ${{ github.event.repository.default_branch }}");
    expect(workflow).toContain("OPENCODE_HEAD_REPOSITORY: ${{ github.event.workflow_run.head_repository.full_name || github.event.pull_request.head.repo.full_name }}");
    expect(workflow).toContain("OPENCODE_HEAD_BRANCH: ${{ github.event.workflow_run.head_branch || github.event.pull_request.head.ref }}");
    expect(workflow).toContain("OPENCODE_HEAD_SHA: ${{ github.event.workflow_run.head_sha || github.event.pull_request.head.sha }}");
    expect(workflow).toContain("ref: ${{ steps.resolve-pr.outputs.base-sha }}");
    expect(workflow).not.toMatch(/ref:.*(?:head_sha|\.head\.sha)/);
    expect(workflow).toContain("node scripts/opencode-review.mjs \\");
    expect(workflow).toContain('--base "${{ steps.resolve-pr.outputs.base-sha }}"');
    expect(workflow).toContain('--head "${{ steps.resolve-pr.outputs.head-sha }}"');
    expect(workflow).toContain('--pull-number "${{ steps.resolve-pr.outputs.pull-number }}"');
    expect(workflow).not.toContain("--submission-only");
    expect(workflow).toContain("if: steps.opencode-review.outcome == 'failure'");
  });

  it("grants only the permissions and secrets needed by trusted review code", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("review:\n    timeout-minutes: 90");
    expect(workflow).toContain("permissions:\n      contents: read\n      checks: write\n      pull-requests: write\n      statuses: write");
    expect(workflow).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(workflow).toContain("OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}");
    expect(workflow).toContain("OPENCODE_REVIEW_MODEL: ${{ vars.OPENCODE_REVIEW_MODEL || 'opencode-go/deepseek-v4-flash' }}");
    expect(workflow).toContain("OPENCODE_REVIEW_FALLBACK_MODEL: ${{ vars.OPENCODE_REVIEW_FALLBACK_MODEL || 'opencode-go/mimo-v2.5' }}");
    expect(workflow).toContain("OPENCODE_REVIEW_HARD_MODEL: ${{ vars.OPENCODE_REVIEW_HARD_MODEL || 'opencode-go/qwen3.7-plus' }}");
    expect(workflow).toContain("OPENCODE_FORCE_REVIEW: ${{ github.event_name == 'pull_request_target' && 'true' || 'false' }}");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("actions: write");
  });
});
