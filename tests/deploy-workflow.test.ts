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
