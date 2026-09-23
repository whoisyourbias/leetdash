import { describe, expect, it } from "vitest";
import {
  focusLineForSource,
  highlightSet,
  normalizeRanges,
  splitLines,
  targetLine,
  tokenizeCodeLine,
} from "@/app/components/solution-code-viewer-helpers";

describe("splitLines", () => {
  it("returns an empty array for an empty string", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("returns a single element for a string with no newline", () => {
    expect(splitLines("hello")).toEqual(["hello"]);
  });

  it("splits on newline, preserving an empty trailing element for a final \\n", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b", ""]);
  });

  it("preserves every line including blanks between content", () => {
    expect(splitLines("\n\nc\n")).toEqual(["", "", "c", ""]);
  });

  it("handles CRLF input (\\r\\n) — split treats \\r as part of the preceding token", () => {
    const lines = splitLines("x\r\ny\r\n");
    expect(lines).toHaveLength(3);
    // \r is NOT stripped; this is a plain split on \n.
    expect(lines[0]).toBe("x\r");
    expect(lines[1]).toBe("y\r");
    expect(lines[2]).toBe("");
  });

  it("returns one element for a string of only newlines", () => {
    expect(splitLines("\n\n\n")).toEqual(["", "", "", ""]);
  });

  it("handles a multi-line source exactly matching editor display", () => {
    const source = "line1\nline2\nline3";
    expect(splitLines(source)).toEqual(["line1", "line2", "line3"]);
  });
});

describe("tokenizeCodeLine", () => {
  it("recognizes SQL keywords for the plain 'sql' language (Programmers SQL solutions)", () => {
    const tokens = tokenizeCodeLine("SELECT name FROM users WHERE id = 1;", "sql");
    expect(tokens.find((t) => t.text === "SELECT")?.kind).toBe("keyword");
    expect(tokens.find((t) => t.text === "FROM")?.kind).toBe("keyword");
    expect(tokens.find((t) => t.text === "WHERE")?.kind).toBe("keyword");
  });

  it("recognizes SQL keywords for CodeMirror-style 'text/x-mysql' language strings", () => {
    const tokens = tokenizeCodeLine("select * from orders;", "text/x-mysql");
    expect(tokens.find((t) => t.text === "select")?.kind).toBe("keyword");
    expect(tokens.find((t) => t.text === "from")?.kind).toBe("keyword");
  });

  it("recognizes SQL keywords for 'x-mysql' and 'mysql' language strings", () => {
    for (const language of ["x-mysql", "mysql", "MySQL"]) {
      const tokens = tokenizeCodeLine("GROUP BY id", language);
      expect(tokens.find((t) => t.text === "GROUP")?.kind).toBe("keyword");
      expect(tokens.find((t) => t.text === "BY")?.kind).toBe("keyword");
    }
  });

  it("treats `--` as a line comment for SQL languages", () => {
    const tokens = tokenizeCodeLine("SELECT 1 -- trailing note", "mysql");
    const commentToken = tokens.find((t) => t.kind === "comment");
    expect(commentToken?.text).toBe("-- trailing note");
  });

  it("does not misclassify `--` as a comment for non-SQL languages", () => {
    const tokens = tokenizeCodeLine("i--;", "java");
    const decrementToken = tokens.find((t) => t.text === "--");
    expect(decrementToken?.kind).toBe("operator");
    expect(tokens.some((t) => t.kind === "comment")).toBe(false);
  });

  it("does not treat SQL keywords as keywords for unrelated languages", () => {
    const tokens = tokenizeCodeLine("select = 1;", "java");
    expect(tokens.find((t) => t.text === "select")?.kind).toBe("plain");
  });
});

describe("normalizeRanges", () => {
  it("returns an empty array when totalLines is 0", () => {
    expect(normalizeRanges([{ start: 1, end: 3 }], 0)).toEqual([]);
  });

  it("returns an empty array when totalLines is negative", () => {
    expect(normalizeRanges([{ start: 1, end: 3 }], -1)).toEqual([]);
  });

  it("clamps start below 1 to 1", () => {
    expect(normalizeRanges([{ start: 0, end: 5 }], 10)).toEqual([
      { start: 1, end: 5 },
    ]);
  });

  it("clamps end above totalLines to totalLines", () => {
    expect(normalizeRanges([{ start: 5, end: 99 }], 10)).toEqual([
      { start: 5, end: 10 },
    ]);
  });

  it("sets end to start when end < start after clamping", () => {
    // start gets clamped to 8, end to 8 → legal
    expect(normalizeRanges([{ start: 12, end: 5 }], 8)).toEqual([
      { start: 8, end: 8 },
    ]);
  });

  it("sorts ranges by start ascending, then end ascending", () => {
    const refs = [
      { start: 20, end: 25 },
      { start: 3, end: 5 },
      { start: 3, end: 4 },
    ];
    expect(normalizeRanges(refs, 50)).toEqual([
      { start: 3, end: 4 },
      { start: 3, end: 5 },
      { start: 20, end: 25 },
    ]);
  });

  it("preserves a single valid range unchanged", () => {
    expect(normalizeRanges([{ start: 2, end: 4 }], 10)).toEqual([
      { start: 2, end: 4 },
    ]);
  });

  it("handles an empty input array", () => {
    expect(normalizeRanges([], 10)).toEqual([]);
  });

  it("clamps both start and end when both are out of bounds", () => {
    expect(normalizeRanges([{ start: -5, end: 100 }], 8)).toEqual([
      { start: 1, end: 8 },
    ]);
  });
});

describe("highlightSet", () => {
  it("returns an empty Set for empty refs", () => {
    expect(highlightSet([], 10).size).toBe(0);
  });

  it("returns an empty Set when totalLines is 0", () => {
    expect(highlightSet([{ start: 1, end: 3 }], 0).size).toBe(0);
  });

  it("builds a Set covering every line in each range", () => {
    const set = highlightSet(
      [
        { start: 2, end: 3 },
        { start: 7, end: 8 },
      ],
      10,
    );
    expect(set.has(1)).toBe(false);
    expect(set.has(2)).toBe(true);
    expect(set.has(3)).toBe(true);
    expect(set.has(4)).toBe(false);
    expect(set.has(7)).toBe(true);
    expect(set.has(8)).toBe(true);
    expect(set.has(9)).toBe(false);
  });

  it("clamps out-of-bounds ranges before building the set", () => {
    const set = highlightSet([{ start: -2, end: 2 }], 5);
    expect(set.has(1)).toBe(true);
    expect(set.has(2)).toBe(true);
    expect(set.has(3)).toBe(false);
  });
});

describe("targetLine", () => {
  it("returns null for an empty array", () => {
    expect(targetLine([])).toBeNull();
  });

  it("returns the start line of the first reference", () => {
    expect(targetLine([{ start: 7, end: 10 }])).toBe(7);
  });

  it("returns the first reference's start even with multiple ranges", () => {
    expect(
      targetLine([
        { start: 12, end: 14 },
        { start: 3, end: 5 },
      ]),
    ).toBe(12);
  });
});

describe("focusLineForSource", () => {
  it("returns null for undefined refs", () => {
    expect(focusLineForSource("line1\nline2", undefined)).toBeNull();
  });

  it("returns null for an empty refs array", () => {
    expect(focusLineForSource("line1\nline2", [])).toBeNull();
  });

  it("returns null for empty source text (zero lines)", () => {
    // splitLines("") → [], normalizeRanges returns [] → targetLine returns null
    expect(focusLineForSource("", [{ start: 1, end: 3 }])).toBeNull();
  });

  it("returns the start of a normal in-range reference", () => {
    expect(
      focusLineForSource("a\nb\nc\nd\ne", [{ start: 3, end: 4 }]),
    ).toBe(3);
  });

  it("clamps an above-range reference to the last valid line", () => {
    // 3 lines; ref points to line 50 → clamp to 3
    expect(
      focusLineForSource("a\nb\nc", [{ start: 50, end: 55 }]),
    ).toBe(3);
  });

  it("clamps a below-range reference to line 1", () => {
    expect(
      focusLineForSource("a\nb\nc", [{ start: -3, end: -1 }]),
    ).toBe(1);
  });

  it("returns the first reference start after clamping and sorting", () => {
    expect(
      focusLineForSource("a\nb\nc\nd", [
        { start: 10, end: 12 },
        { start: 2, end: 3 },
      ]),
    ).toBe(2);
  });

  it("matches the rendered focus line for an out-of-range reference", () => {
    // Simulate exactly what the loaded render case computes:
    //   splitLines → normalizeRanges → targetLine
    const source = "line1\nline2\nline3";
    const rawRefs = [{ start: 42, end: 44 }];
    const expected = targetLine(normalizeRanges(rawRefs, splitLines(source).length));
    expect(focusLineForSource(source, rawRefs)).toBe(expected);
  });
});
