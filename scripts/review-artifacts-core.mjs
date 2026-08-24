// Safe review artifact parser.
//
// Converts managed Chalsakbot (opencode-review) GitHub issue comments into a
// JSON-safe review artifact consumed by the comparison pages. Comments are
// untrusted external text: this module never emits raw GitHub response
// objects, HTML, remote image URLs, tokens, workflow metadata, or
// author-controlled links.
//
// Contract:
//   - Input comments look like GitHub issue-comment objects:
//     { id, user: { login }, html_url, updated_at, body }.
//   - Only comments from the exact login `github-actions[bot]` with a managed
//     kind=file marker pair (path + content SHA-256 markers) are accepted.
//   - Artifacts are emitted ONLY with the seven safe fields:
//     { pathKey, contentKey, commentUrl, updatedAt, text, lineReferences, reviews }.
//   - `text` is the producer's display text with exactly one layer of the
//     producer's known entity escaping decoded (so `<`, `>`, `&`, `@`, and URL
//     punctuation are readable and no double entities remain), with trusted
//     injected blob permalinks restored to bare `Lx`/`Lx-Ly` labels and any
//     remaining remote URL stripped. It is safe ONLY as a React text node
//     (React escapes angle brackets); never render it as HTML/Markdown.
//     `text === null` is the explicit no-comment representation
//     (`리뷰 코멘트 없음.`); `lineReferences` and `reviews` are then empty.
//   - `reviews` preserve each producer-formatted inline comment as a separate
//     `{ text, lineReference }` item. A review starts with a source anchor at
//     the beginning of a line (`L<num>` / `L<start>-L<end>`). Anchors inside
//     fenced code or prose are never treated as review boundaries.
//   - `lineReferences` is the sorted, deduplicated projection of `reviews`.
//   - `parseReviewArtifacts` maps comments against current solution metadata
//     and selects the newest comment by `updated_at`, then the highest safe
//     numeric comment id for deterministic ties.

import { parseManagedReviewMarker } from "./opencode-review-core.mjs";

const managedBotLogin = "github-actions[bot]";
const hex64Pattern = /^[a-f0-9]{64}$/;
const fileMarkerPattern = /^<!-- leetdash-opencode-review-file:([a-f0-9]{64}) -->$/;
const contentMarkerPattern = /^<!-- leetdash-opencode-review-content:([a-f0-9]{64}) -->$/;
const modelMarkerPattern = /^<!-- leetdash-opencode-review-model:[a-z0-9][a-z0-9./_-]* -->$/;
const mascotImagePattern = /^<img\b/;
const brandedHeadingPattern = /^##\s+/;
const metadataLinePattern = /^(?:파일|커밋|모델|워크플로):\s*/;
const maxLineReferences = 100;
const noCommentText = "리뷰 코멘트 없음.";

// The producer (scripts/opencode-review.mjs) injects commit-pinned line
// permalinks AFTER sanitization, so the comment body contains raw
// `https://github.com/<owner>/<repo>/blob/<sha>/<path>#L<num>` URLs.
// Restoring them to the original bare labels keeps prose readable and keeps
// SHA/repo/path out of artifact text.
const injectedPermalinkPattern = /\bhttps:\/\/github\.com\/[^\s#)]*\/blob\/[^\s#)]*#L(\d+)(?:-L(\d+))?/g;

// Model-authored URLs were neutralized by the producer (`https:` ->
// `https&#58;`, `www.` -> `www&#46;`) and become raw URL strings again after
// decoding; remove them so no remote URL survives in artifact text. Trailing
// sentence punctuation is preserved.
const remoteUrlPattern = /\b(?:https?|ftp):\/\/[^\s<>"']+|\bmailto:[^\s<>"']+|\bwww\.[^\s<>"']+/gi;

// Display pipeline order matters:
//   1. restore trusted injected blob permalinks to bare `Lx`/`Lx-Ly` labels
//      (raw `https://github.com/...` URLs the producer injected after
//      sanitization);
//   2. decode exactly one layer of the producer's known escaping in
//      reverse-safe order — atomic entities first, `&amp;` LAST — so a
//      literal entity the model wrote (`&lt;` -> producer `&amp;lt;`) stays
//      literal while real escapes (`<` -> producer `&lt;`) become readable
//      angle brackets; the producer's markdown-link breaks (`](` -> `\](`,
//      `][` -> `\][`) are undone too, but the text is never rendered as
//      Markdown, so no link can be reconstructed;
//   3. remove any remaining remote URL (model-authored URLs were neutralized
//      by the producer and become raw strings again after decoding), keeping
//      trailing sentence punctuation.
function toDisplayText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(injectedPermalinkPattern, (_match, start, end) => (
      end === undefined ? `L${start}` : `L${start}-L${end}`
    ))
    .replace(/&#58;/g, ":")
    .replace(/&#46;/g, ".")
    .replace(/&#64;/g, "@")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\\]\s*\[/g, "][")
    .replace(/\\]\(/g, "](")
    .replace(/&amp;/g, "&")
    .replace(remoteUrlPattern, (match) => {
      const trailing = /[.,;:!?)\]}"']+$/.exec(match);
      return trailing ? trailing[0] : "";
    })
    .trim();
}

function stripManagedPrefix(body) {
  const lines = body.replace(/^\uFEFF/, "").split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const isPrefixLine = fileMarkerPattern.test(line)
      || contentMarkerPattern.test(line)
      || modelMarkerPattern.test(line)
      || mascotImagePattern.test(line)
      || brandedHeadingPattern.test(line)
      || metadataLinePattern.test(line)
      || line.trim() === "";
    if (!isPrefixLine) break;
    index += 1;
  }
  return lines.slice(index).join("\n");
}

function extractReviews(text) {
  const lines = text.split("\n");
  const starts = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!inFence) {
      const match = /^L(\d{1,6})(?:-L(\d{1,6}))?(?=\s|:)/.exec(line);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] === undefined ? start : Number(match[2]);
        if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 1 && end >= start) {
          starts.push({ index, lineReference: { start, end } });
          if (starts.length >= maxLineReferences) break;
        }
      }
    }

    const fenceCount = line.match(/```/g)?.length ?? 0;
    if (fenceCount % 2 === 1) inFence = !inFence;
  }

  return starts.map((entry, index) => {
    const next = starts[index + 1];
    return {
      text: lines.slice(entry.index, next?.index ?? lines.length).join("\n").trim(),
      lineReference: entry.lineReference,
    };
  });
}

function extractLineReferences(reviews) {
  const refs = reviews.map((review) => review.lineReference);
  refs.sort((a, b) => a.start - b.start || a.end - b.end);
  const deduped = [];
  const seen = new Set();
  for (const ref of refs) {
    const key = `${ref.start}:${ref.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ref);
    if (deduped.length >= maxLineReferences) break;
  }
  return deduped;
}

function isTrustedCommentUrl(value) {
  if (typeof value !== "string") return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.hostname === "github.com";
}

/**
 * Validate a single raw GitHub comment and project it to a safe review
 * artifact, or return null when the comment is not a managed file review.
 * Never throws for untrusted input.
 */
export function parseReviewArtifact(comment) {
  if (!comment || typeof comment !== "object") return null;
  if (comment.user?.login !== managedBotLogin) return null;
  if (!Number.isSafeInteger(comment.id)) return null;

  const marker = parseManagedReviewMarker(comment.body);
  if (!marker || marker.kind !== "file") return null;
  if (!hex64Pattern.test(marker.key) || !hex64Pattern.test(marker.contentKey)) return null;

  if (!isTrustedCommentUrl(comment.html_url)) return null;
  const updatedAt = comment.updated_at;
  if (typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) return null;

  const text = toDisplayText(stripManagedPrefix(comment.body));
  if (text === noCommentText) {
    return {
      pathKey: marker.key,
      contentKey: marker.contentKey,
      commentUrl: comment.html_url,
      updatedAt,
      text: null,
      lineReferences: [],
      reviews: [],
    };
  }
  if (text.length === 0) return null;

  const reviews = extractReviews(text);

  return {
    pathKey: marker.key,
    contentKey: marker.contentKey,
    commentUrl: comment.html_url,
    updatedAt,
    text,
    lineReferences: extractLineReferences(reviews),
    reviews,
  };
}

/**
 * Map raw comments against current solution metadata (pathKey/contentKey
 * computed from the solution path and file bytes). Returns at most one
 * artifact: the newest matching comment by `updated_at`, with the highest
 * safe numeric comment id as the deterministic tie-breaker.
 * Throws TypeError only for invalid programmer inputs, never for untrusted
 * comment content.
 */
export function parseReviewArtifacts(comments, current) {
  if (!Array.isArray(comments)) throw new TypeError("comments must be an array");
  if (!current || typeof current !== "object") throw new TypeError("current must include pathKey and contentKey");
  const { pathKey, contentKey } = current;
  if (!hex64Pattern.test(pathKey) || !hex64Pattern.test(contentKey)) {
    throw new TypeError("current pathKey/contentKey must be 64-char hex SHA-256 keys");
  }

  const matched = comments
    .map((comment) => ({ comment, artifact: parseReviewArtifact(comment) }))
    .filter(({ artifact }) => artifact && artifact.pathKey === pathKey && artifact.contentKey === contentKey)
    .sort((a, b) => {
      const timeDelta = Date.parse(b.artifact.updatedAt) - Date.parse(a.artifact.updatedAt);
      if (timeDelta !== 0) return timeDelta;
      return b.comment.id - a.comment.id;
    });

  const artifacts = [];
  const seen = new Set();
  for (const { artifact } of matched) {
    const pair = `${artifact.pathKey}:${artifact.contentKey}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    artifacts.push(artifact);
  }
  return artifacts;
}
