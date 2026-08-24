import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  getOpenCodeModelProfile,
  isRetryableStatus,
  openCodeApiModel,
  openCodeChatCompletionsUrl,
  openCodeMessagesUrl,
  openCodeRequestTimeoutMs,
  parseAssistantResponse,
  parseMessagesAssistantResponse,
} from "../scripts/opencode-api-contract.mjs";

describe("opencode-api-contract", () => {
  it("exports the shared chat-completions request policy constants", () => {
    expect(openCodeChatCompletionsUrl).toBe("https://opencode.ai/zen/go/v1/chat/completions");
    expect(openCodeApiModel).toBe("deepseek-v4-flash");
    expect(openCodeRequestTimeoutMs).toBe(300_000);
  });

  it("maps configured model IDs to their supported API protocols", () => {
    expect(getOpenCodeModelProfile("opencode-go/mimo-v2.5")).toMatchObject({
      apiModel: "mimo-v2.5",
      protocol: "chat-completions",
      url: openCodeChatCompletionsUrl,
    });
    expect(getOpenCodeModelProfile("opencode-go/qwen3.7-plus")).toEqual({
      apiModel: "qwen3.7-plus",
      protocol: "messages",
      url: openCodeMessagesUrl,
      maxTokens: 8192,
    });
    expect(getOpenCodeModelProfile("opencode-go/unknown")).toBeUndefined();
  });

  it("accepts Anthropic assistant text while ignoring thinking blocks", () => {
    expect(parseMessagesAssistantResponse({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "private reasoning" },
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    })).toEqual({ ok: true, content: "first\nsecond" });
  });

  it.each([
    ["wrong role", { role: "user", content: [{ type: "text", text: "review" }] }],
    ["no text", { role: "assistant", content: [{ type: "thinking", thinking: "secret" }] }],
    ["blank text", { role: "assistant", content: [{ type: "text", text: " " }] }],
    ["unsupported block", { role: "assistant", content: [{ type: "tool_use", id: "1" }] }],
  ])("rejects malformed Anthropic response: %s", (_name, body) => {
    expect(parseMessagesAssistantResponse(body)).toEqual({ ok: false });
  });

  it.each([
    ["408", 408],
    ["425", 425],
    ["429", 429],
    ["500", 500],
    ["503", 503],
  ])("classifies HTTP %s as retryable", (_name, status) => {
    expect(isRetryableStatus(status)).toBe(true);
  });

  it.each([
    ["401", 401],
    ["403", 403],
    ["404", 404],
  ])("classifies HTTP %s as non-retryable", (_name, status) => {
    expect(isRetryableStatus(status)).toBe(false);
  });

  it("classifies non-status inputs as non-retryable", () => {
    expect(isRetryableStatus(undefined)).toBe(false);
    expect(isRetryableStatus(null)).toBe(false);
    expect(isRetryableStatus("429")).toBe(false);
    expect(isRetryableStatus(0)).toBe(false);
  });

  it("accepts exactly one assistant choice with nonblank string content", () => {
    const parsed = parseAssistantResponse({ choices: [{ message: { role: "assistant", content: "review result" } }] });
    expect(parsed).toEqual({ ok: true, content: "review result" });
  });

  it.each([
    ["zero choices", { choices: [] }, "zero-choices-sentinel"],
    ["missing choices", {}, "missing-choices-sentinel"],
    [
      "multiple choices",
      {
        choices: [
          { message: { role: "assistant", content: "first" } },
          { message: { role: "assistant", content: "second" } },
        ],
      },
      "multi-choice-sentinel",
    ],
    ["non-assistant role", { choices: [{ message: { role: "user", content: "review result" } }] }, "wrong-role-sentinel"],
    ["missing role", { choices: [{ message: { content: "review result" } }] }, "missing-role-sentinel"],
    ["blank content", { choices: [{ message: { role: "assistant", content: "  " } }] }, "blank-content-sentinel"],
    ["non-string content", { choices: [{ message: { role: "assistant", content: [{ type: "text", text: "review" }] } }] }, "non-string-sentinel"],
    ["missing content", { choices: [{ message: { role: "assistant" } }] }, "missing-content-sentinel"],
  ])("rejects %s with a fixed typed invalid result that never embeds the supplied payload", (_name, body, sentinel) => {
    const parsed = parseAssistantResponse({ ...body, sentinel });
    expect(parsed).toEqual({ ok: false });
    expect(JSON.stringify(parsed)).not.toContain(sentinel);
  });

  it("consumes the shared contract from the review client without redeclaring request policy", async () => {
    const source = await readFile(new URL("../scripts/opencode-review-clients.mjs", import.meta.url), "utf8");
    expect(source).toContain('from "./opencode-api-contract.mjs"');
    expect(source).not.toMatch(/const openCodeChatCompletionsUrl\s*=\s*"https:\/\//);
    expect(source).not.toMatch(/const openCodeApiModel\s*=\s*"deepseek-v4-flash"/);
    expect(source).not.toMatch(/const openCodeRequestTimeoutMs\s*=\s*300_000/);
    expect(source).not.toMatch(/function isRetryableStatus\s*\(/);
    expect(source).not.toMatch(/function parseAssistantResponse\s*\(/);
  });
});
