import type { LineReference, ReviewItem } from "@/lib/solution-assets";

export type SyntaxTokenKind =
  | "plain"
  | "keyword"
  | "type"
  | "string"
  | "number"
  | "comment"
  | "function"
  | "operator"
  | "punctuation";

export type SyntaxToken = { kind: SyntaxTokenKind; text: string };

const KEYWORDS = new Set(
  [
    "as", "async", "await", "break", "case", "catch", "class", "const", "continue",
    "def", "default", "do", "else", "export", "extends", "finally", "for", "from",
    "function", "if", "implements", "import", "in", "instanceof", "interface", "new",
    "of", "package", "private", "protected", "public", "return", "static", "switch",
    "throw", "throws", "try", "typeof", "var", "void", "while", "with", "yield",
  ],
);
const TYPES = new Set(
  ["any", "boolean", "bool", "char", "double", "float", "int", "let", "long", "number",
    "object", "short", "String", "string", "undefined", "void", "Map", "Set", "List",
    "Array", "Integer", "Long", "Boolean", "Character"],
);
const SQL_KEYWORDS = new Set(
  ["select", "from", "where", "join", "inner", "left", "right", "outer", "full", "on",
    "group", "by", "order", "having", "insert", "into", "values", "update", "set", "delete",
    "create", "table", "alter", "drop", "distinct", "as", "and", "or", "not", "null", "is",
    "in", "like", "between", "limit", "offset", "union", "all", "case", "when", "then", "else",
    "end", "count", "sum", "avg", "min", "max", "asc", "desc", "exists", "default", "primary",
    "key", "foreign", "references", "index", "unique", "constraint", "with", "over", "partition",
    "cross", "using", "truncate", "view", "procedure", "function", "declare", "begin", "if",
    "while", "return"],
);

const DEFAULT_PATTERN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*|#.*|\/\*.*?\*\/|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|===|!==|=>|==|!=|<=|>=|&&|\|\||\+\+|--|[+*/%=!<>?:&|~-]|[{}()[\];,.:])/g;
/** SQL dialects (mysql, x-mysql, text/x-mysql, postgresql, ...) use `--` for line comments
 * instead of `//`, so this variant matches the rest of the line once `--` is seen. */
const SQL_PATTERN = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|--.*|\/\/.*|#.*|\/\*.*?\*\/|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|===|!==|=>|==|!=|<=|>=|&&|\|\||\+\+|--|[+*/%=!<>?:&|~-]|[{}()[\];,.:])/g;

/** Tokenizes one source line without changing its text. It intentionally stays small and
 * dependency-free so the viewer works for every submission language in the static app. */
export function tokenizeCodeLine(line: string, language = ""): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const lowerLanguage = language.toLowerCase();
  const isSql = lowerLanguage.includes("sql");
  const pattern = isSql ? SQL_PATTERN : DEFAULT_PATTERN;
  pattern.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > cursor) tokens.push({ kind: "plain", text: line.slice(cursor, match.index) });
    const text = match[0];
    let kind: SyntaxTokenKind = "plain";
    if (/^(?:\/\/|#|\/\*)/.test(text) || (isSql && text.startsWith("--"))) kind = "comment";
    else if (/^["'`]/.test(text)) kind = "string";
    else if (/^\d/.test(text)) kind = "number";
    else if (/^[A-Za-z_$]/.test(text)) {
      kind = KEYWORDS.has(text) ? "keyword" : TYPES.has(text) ? "type" :
        (lowerLanguage.includes("python") && ["True", "False", "None", "self"].includes(text)) ? "keyword" :
        (isSql && SQL_KEYWORDS.has(text.toLowerCase())) ? "keyword" :
        "plain";
      const next = line.slice(pattern.lastIndex).match(/^\s*\(/);
      if (kind === "plain" && next) kind = "function";
    } else if (/^[{}()[\];,.:]$/.test(text)) kind = "punctuation";
    else kind = "operator";
    tokens.push({ kind, text });
    cursor = pattern.lastIndex;
  }
  if (cursor < line.length) tokens.push({ kind: "plain", text: line.slice(cursor) });
  return tokens;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Split source text into lines, preserving a trailing empty string for a
 *  final newline so line-number count matches what editors display. */
export function splitLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  return text.split("\n");
}

/** Clamp every reference to `[1, totalLines]` and sort ascending. Zero or
 *  negative `totalLines` yields an empty result. */
export function normalizeRanges(
  refs: readonly LineReference[],
  totalLines: number,
): LineReference[] {
  if (totalLines <= 0) {
    return [];
  }
  const clamped: LineReference[] = [];
  for (const ref of refs) {
    const start = Math.max(1, Math.min(ref.start, totalLines));
    const end = Math.max(start, Math.min(ref.end, totalLines));
    clamped.push({ start, end });
  }
  return clamped.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Return the first line of the first reference, or `null` when none exist. */
export function targetLine(refs: readonly LineReference[]): number | null {
  if (refs.length === 0) {
    return null;
  }
  return refs[0]!.start;
}

/** Compute the focus-target line number from source text and raw references
 *  using the same pipeline the renderer uses: splitLines → normalizeRanges →
 *  targetLine. Returns `null` when refs is undefined, empty, or the source
 *  has zero lines. */
export function focusLineForSource(
  text: string,
  refs: readonly LineReference[] | undefined,
): number | null {
  if (!refs || refs.length === 0) {
    return null;
  }
  const totalLines = splitLines(text).length;
  return targetLine(normalizeRanges(refs, totalLines));
}

/** Build a set of highlighted line numbers from clamped ranges. */
export function highlightSet(
  refs: readonly LineReference[],
  totalLines: number,
): Set<number> {
  const set = new Set<number>();
  for (const ref of normalizeRanges(refs, totalLines)) {
    for (let n = ref.start; n <= ref.end; n += 1) {
      set.add(n);
    }
  }
  return set;
}

/** Resolve a code line to one review. More specific ranges win when reviews overlap. */
export function findReviewIndexForLine(
  reviews: readonly ReviewItem[],
  line: number,
): number | null {
  let match: { index: number; span: number } | null = null;
  for (let index = 0; index < reviews.length; index += 1) {
    const review = reviews[index]!;
    const { start, end } = review.lineReference;
    if (line < start || line > end) continue;
    const span = end - start;
    if (match === null || span < match.span) {
      match = { index, span };
    }
  }
  return match === null ? null : match.index;
}

// ── Discriminated state type ───────────────────────────────────────────────

export type SolutionCodeViewerState =
  | { status: "loading" }
  | { status: "unsolved" }
  | { status: "empty" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "oversize" }
  | { status: "mismatch" }
  | { status: "invalid-utf8" }
  | {
      status: "loaded";
      text: string;
      /** Optional line references for highlight / scroll-to. */
      lineRefs?: readonly LineReference[];
    };

// ── Props ──────────────────────────────────────────────────────────────────

export interface SolutionCodeViewerProps {
  state: SolutionCodeViewerState;
  language?: string | null;
  /** GitHub permalink to the source file. Shown in every non-unsolved state. */
  permalink?: string | null;
  className?: string;
  /** Transient range synchronized with a hovered/focused review item. */
  activeLineRef?: LineReference | null;
  onLineHover?: (line: number | null) => void;
}
