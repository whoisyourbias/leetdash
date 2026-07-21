import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/sweep-submission-prs.yml", "utf8").replaceAll("\r\n", "\n");

describe("submission sweeper workflow triggers", () => {
  it("runs after PR validation completes and keeps the backup schedule", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["Deploy GitHub Pages"]');
    expect(workflow).toContain("types:\n      - completed");
    expect(workflow).toContain('cron: "17 * * * *"');
    expect(workflow).toContain("workflow_dispatch:");
  });
});
