import { describe, expect, it } from "vitest";
import { getViewportLocale, isMobileViewport, parseLocalePreference, resolveLocale } from "./locale";

describe("language preference", () => {
  it("defaults to auto for a missing or unknown cookie", () => {
    expect(parseLocalePreference(undefined)).toBe("auto");
    expect(parseLocalePreference("")).toBe("auto");
    expect(parseLocalePreference("fr")).toBe("auto");
    expect(parseLocalePreference("ko")).toBe("ko");
    expect(parseLocalePreference("en")).toBe("en");
  });

  it("auto keeps the original rule: English on desktop, Korean on phones", () => {
    expect(resolveLocale("auto", getViewportLocale(1440))).toBe("en");
    expect(resolveLocale("auto", getViewportLocale(390))).toBe("ko");
  });

  it("a pinned language wins on every width", () => {
    for (const width of [390, 899, 900, 1440]) {
      expect(resolveLocale("ko", getViewportLocale(width))).toBe("ko");
      expect(resolveLocale("en", getViewportLocale(width))).toBe("en");
    }
  });

  it("layout follows the width only, never the language", () => {
    expect(isMobileViewport(getViewportLocale(390))).toBe(true);
    expect(isMobileViewport(getViewportLocale(899))).toBe(true);
    expect(isMobileViewport(getViewportLocale(900))).toBe(false);
    expect(isMobileViewport(getViewportLocale(1440))).toBe(false);
  });
});
