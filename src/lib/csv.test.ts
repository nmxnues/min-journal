import { describe, expect, it } from "vitest";
import { parseCsv, stringifyCsv } from "./csv";

describe("parseCsv", () => {
  it("splits plain rows on commas and newlines", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a comma inside a quoted field", () => {
    expect(parseCsv('a,"b, c",d')).toEqual([["a", "b, c", "d"]]);
  });

  it("keeps a newline inside a quoted field", () => {
    expect(parseCsv('a,"line1\nline2",b')).toEqual([["a", "line1\nline2", "b"]]);
  });

  it("unescapes a doubled quote as one literal quote", () => {
    expect(parseCsv('a,"she said ""hi""",b')).toEqual([["a", 'she said "hi"', "b"]]);
  });

  it("drops trailing blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("stringifyCsv", () => {
  it("joins plain rows with commas and CRLF", () => {
    expect(
      stringifyCsv([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toBe("a,b\r\n1,2");
  });

  it("quotes a field containing a comma, quote, or newline", () => {
    expect(stringifyCsv([["a, b", 'say "hi"', "line1\nline2"]])).toBe(
      '"a, b","say ""hi""","line1\nline2"',
    );
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["date", "instrument", "notes"],
      ["2026-09-09", "EURUSD", 'clean sweep, "textbook" setup\nheld to close'],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
});
