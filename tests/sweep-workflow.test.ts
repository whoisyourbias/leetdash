import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/sweep-submission-prs.yml", "utf8").replaceAll("\r\n", "\n");

describe("submission sweeper workflow triggers", () => {
  it("runs after OpenCode review completes successfully and keeps the backup schedule", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["OpenCode Submission Review"]');
    expect(workflow).toContain("types:\n      - completed");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain('cron: "17 * * * *"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain('workflows: ["Deploy GitHub Pages"]');
  });

  it("requires validation checks and the dedicated OpenCode status gate", () => {
    expect(workflow).toContain("SWEEP_REQUIRED_CHECKS: validate");
    expect(workflow).toContain("SWEEP_REQUIRED_STATUSES: opencode-review-gate");
    expect(workflow).toContain("SWEEP_REQUIRED_CHECK_APP: github-actions");
    expect(workflow).toContain("SWEEP_REQUIRED_STATUS_CREATOR: github-actions[bot]");
    expect(workflow).not.toContain("SWEEP_REQUIRED_CHECK:");
  });
});
