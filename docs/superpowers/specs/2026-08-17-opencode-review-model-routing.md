# OpenCode Review Model Routing

## Policy

The default review model remains `opencode-go/deepseek-v4-flash`. A response is classified as a model quota exhaustion only when its body contains the exact provider error name `GoUsageLimitError`. The raw provider body is never copied to logs, checks, statuses, or comments.

After a DeepSeek quota exhaustion, the current workflow run keeps DeepSeek disabled. The file that observed the exhaustion and all later files use the trusted base-branch problem catalog:

- LeetCode Hard, Programmers Level 3 or above, and SWEA D5 or above use `opencode-go/qwen3.7-plus`.
- Every other or unclassified problem uses `opencode-go/mimo-v2.5`.

Ordinary HTTP 408, 425, 429, and 5xx responses and transport failures retain the existing two-attempt same-model policy. They do not activate fallback. A MiMo or Qwen quota exhaustion or final failure becomes the existing sanitized file warning and failed review gate; it does not cascade to another model.

## Protocols

- DeepSeek and MiMo use `POST /chat/completions` and OpenAI-style assistant response validation.
- Qwen uses `POST /messages`, `max_tokens: 8192`, and Anthropic-style assistant content block validation. Thinking blocks are ignored and one or more nonblank text blocks are required.
- Unsupported configured model IDs fail validation before any model network request.

## Forced Qwen review

Adding the `ai-review:qwen` label triggers the trusted `pull_request_target` review path. The workflow checks out only trusted default/base code and reads the fork head source through the GitHub API. The label event bypasses the content cache so every target file is replaced with a Qwen review. While the label remains present, later automatic reviews also select Qwen.

## Cache and gate invariants

Successful file comments record both a content hash and model metadata. A cache hit requires both values to match. Legacy comments without model metadata miss once. Existing managed comment upsert, check run, commit status, retry recovery marker, and `opencode-review-gate` behavior remain unchanged.
