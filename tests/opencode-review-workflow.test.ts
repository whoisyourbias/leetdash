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
    expect(workflow).not.toContain("pull_request_target:");
  });

  it("checks out and executes only the trusted pull-request base revision", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("ref: ${{ github.event.workflow_run.pull_requests[0].base.sha }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toMatch(/ref:.*(?:head_sha|\.head\.sha)/);
    expect(workflow).toContain("node scripts/opencode-review.mjs \\");
    expect(workflow).toContain('--base "${{ github.event.workflow_run.pull_requests[0].base.sha }}"');
    expect(workflow).toContain('--head "${{ github.event.workflow_run.pull_requests[0].head.sha }}"');
    expect(workflow).toContain('--pull-number "${{ github.event.workflow_run.pull_requests[0].number }}"');
    expect(workflow).not.toContain("--submission-only");
  });

  it("grants only the permissions and secrets needed by trusted review code", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("review:\n    timeout-minutes: 45");
    expect(workflow).toContain("permissions:\n      contents: read\n      checks: write\n      pull-requests: write");
    expect(workflow).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(workflow).toContain("OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}");
    expect(workflow).toContain("OPENCODE_REVIEW_MODEL: ${{ vars.OPENCODE_REVIEW_MODEL }}");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("actions: write");
  });
});
