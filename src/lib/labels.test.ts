import { describe, expect, it } from "vitest";
import { HTF_PAIRING_LABELS, resolveLabel, SESSION_LABELS, tradeCountLabel } from "./labels";

describe("resolveLabel", () => {
  it("resolves the stored code itself, case-insensitively", () => {
    expect(resolveLabel(SESSION_LABELS, "asia")).toBe("asia");
    expect(resolveLabel(SESSION_LABELS, "ASIA")).toBe("asia");
  });

  it("resolves either locale's display label", () => {
    expect(resolveLabel(SESSION_LABELS, "New York AM")).toBe("ny_am");
    expect(resolveLabel(SESSION_LABELS, "뉴욕 오전")).toBe("ny_am");
  });

  it("treats a hand-typed ASCII arrow as the real arrow glyph", () => {
    expect(resolveLabel(HTF_PAIRING_LABELS, "W -> D")).toBe("w_d");
    expect(resolveLabel(HTF_PAIRING_LABELS, "w->d")).toBe("w_d");
    expect(resolveLabel(HTF_PAIRING_LABELS, "M -> W -> D")).toBe("m_w_d");
  });

  it("returns null for something unrecognized", () => {
    expect(resolveLabel(SESSION_LABELS, "Mars")).toBeNull();
  });
});

describe("tradeCountLabel", () => {
  it("uses the English singular for exactly one", () => {
    expect(tradeCountLabel(1).en).toBe("1 trade");
    expect(tradeCountLabel(2).en).toBe("2 trades");
    expect(tradeCountLabel(0).en).toBe("0 trades");
  });

  it("uses the same Korean counter word regardless of count", () => {
    expect(tradeCountLabel(1).ko).toBe("1건");
    expect(tradeCountLabel(5).ko).toBe("5건");
  });
});
