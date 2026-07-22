import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8").replaceAll("\r\n", "\n");

describe("deploy workflow triggers", () => {
  it("uploads and deploys Pages for both push and workflow dispatch runs", () => {
    expect(workflow).toContain("if: github.event_name != 'pull_request'\n        run: touch out/.nojekyll");
    expect(workflow).toContain("if: github.event_name != 'pull_request'\n        uses: actions/upload-pages-artifact@v4");
    expect(workflow).toContain("deploy:\n    if: github.event_name != 'pull_request'");
  });
});

describe("OpenCode submission review", () => {
  it("runs the review lifecycle for pull requests using the validated PR scope", () => {
    expect(workflow).toContain("outputs:\n      submission_only: ${{ steps.pr-scope.outputs.submission_only }}");
    expect(workflow).toContain("needs: validate");
    expect(workflow).toContain("if: github.event_name == 'pull_request'");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("checks: write");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("uses: actions/checkout@v6\n        with:\n          fetch-depth: 0");
    expect(workflow).toContain("node scripts/opencode-review.mjs \\");
    expect(workflow).toContain('--base "${{ github.event.pull_request.base.sha }}"');
    expect(workflow).toContain('--head "${{ github.event.pull_request.head.sha }}"');
    expect(workflow).toContain('--pull-number "${{ github.event.pull_request.number }}"');
    expect(workflow).toContain('--submission-only "${{ needs.validate.outputs.submission_only }}"');
    expect(workflow).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(workflow).toContain("OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}");
    expect(workflow).toContain("OPENCODE_REVIEW_MODEL: ${{ vars.OPENCODE_REVIEW_MODEL }}");
    expect(workflow).not.toContain("opencode-review:\n");
  });
});
