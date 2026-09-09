import { describe, expect, it } from "vitest";
import {
  basename,
  draftAttachmentPath,
  MAX_ATTACHMENTS_PER_TRADE,
  MAX_ATTACHMENT_BYTES,
  tradeAttachmentPath,
  uniqueAttachmentFilename,
  validateAttachments,
} from "./attachments";

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("validateAttachments", () => {
  it("accepts an on-spec image", () => {
    const file = makeFile("chart.png", "image/png", 1_000);
    const result = validateAttachments([file], 0);
    expect(result.accepted).toEqual([file]);
    expect(result.rejected).toEqual([]);
  });

  it("rejects a disallowed type", () => {
    const file = makeFile("chart.gif", "image/gif", 1_000);
    const result = validateAttachments([file], 0);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([{ file, reason: "type" }]);
  });

  it("rejects a file over the size cap", () => {
    const file = makeFile("huge.png", "image/png", MAX_ATTACHMENT_BYTES + 1);
    const result = validateAttachments([file], 0);
    expect(result.rejected).toEqual([{ file, reason: "size" }]);
  });

  it("accepts a file exactly at the size cap", () => {
    const file = makeFile("exact.png", "image/png", MAX_ATTACHMENT_BYTES);
    expect(validateAttachments([file], 0).accepted).toEqual([file]);
  });

  it("caps the count across the existing total, not just this drop", () => {
    const files = Array.from({ length: 3 }, (_, i) => makeFile(`c${i}.png`, "image/png", 100));
    // Already have 4 of the 6 allowed; only 2 of these 3 should fit.
    const result = validateAttachments(files, MAX_ATTACHMENTS_PER_TRADE - 2);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toEqual([{ file: files[2], reason: "count" }]);
  });

  it("rejects everything once already at the cap", () => {
    const file = makeFile("one-more.png", "image/png", 100);
    const result = validateAttachments([file], MAX_ATTACHMENTS_PER_TRADE);
    expect(result.rejected).toEqual([{ file, reason: "count" }]);
  });

  it("checks each file independently within one drop", () => {
    const good = makeFile("good.png", "image/png", 100);
    const badType = makeFile("bad.gif", "image/gif", 100);
    const badSize = makeFile("bad.png", "image/png", MAX_ATTACHMENT_BYTES + 1);
    const result = validateAttachments([good, badType, badSize], 0);
    expect(result.accepted).toEqual([good]);
    expect(result.rejected.map((r) => r.reason)).toEqual(["type", "size"]);
  });
});

describe("path builders", () => {
  it("puts drafts in one fixed temp folder per user", () => {
    expect(draftAttachmentPath("u1", "abc.png")).toBe("u1/drafts/abc.png");
  });

  it("puts saved attachments under the trade's own folder", () => {
    expect(tradeAttachmentPath("u1", "t1", "abc.png")).toBe("u1/t1/abc.png");
  });

  it("basename survives a move from draft to trade path", () => {
    const draft = draftAttachmentPath("u1", "abc.png");
    const final = tradeAttachmentPath("u1", "t1", basename(draft));
    expect(final).toBe("u1/t1/abc.png");
  });
});

describe("uniqueAttachmentFilename", () => {
  it("keeps the original extension", () => {
    expect(uniqueAttachmentFilename("Screenshot 2026-09-09.PNG".toLowerCase())).toMatch(/\.png$/);
    expect(uniqueAttachmentFilename("chart.jpeg")).toMatch(/\.jpeg$/);
  });

  it("never collides on repeated calls", () => {
    const names = new Set(Array.from({ length: 50 }, () => uniqueAttachmentFilename("a.png")));
    expect(names.size).toBe(50);
  });

  it("has no path separators, so it can't escape its folder", () => {
    const name = uniqueAttachmentFilename("../../etc/passwd.png");
    expect(name).not.toContain("/");
  });
});
