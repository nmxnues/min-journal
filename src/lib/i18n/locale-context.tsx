"use client";

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import {
  getViewportLocale,
  LOCALE_BREAKPOINT_PX,
  VIEWPORT_LOCALE_COOKIE,
  type Locale,
  type LocaleStrings,
} from "./locale";

const LocaleContext = createContext<Locale | null>(null);

function writeCookie(locale: Locale) {
  // 1 year, readable by the server on the next request so SSR starts correct.
  document.cookie = `${VIEWPORT_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export interface LocaleProviderProps {
  /**
   * The locale the server rendered with — from the `viewport-locale` cookie
   * if a previous visit set one, otherwise a guess (see root layout).
   * The client's first render MUST use this exact value (not a fresh
   * `window.innerWidth` read) or React throws a hydration mismatch, since
   * the server has no way to know the viewport width on a request it never
   * saw a screen for.
   */
  initialLocale: Locale;
  children: ReactNode;
}

/**
 * No-flicker strategy (docs/decisions.md has the full writeup):
 *
 * 1. Server renders with the locale from the `viewport-locale` cookie (set by
 *    step 3 below on every prior visit), so almost every request is correct
 *    from the first byte — no client correction needed, ever.
 * 2. The only time the guess can be wrong is a visitor's very first request,
 *    when no cookie exists yet and the server defaults to "en". `useLayoutEffect`
 *    runs synchronously after the DOM is built but *before the browser paints*,
 *    so if the real width says otherwise, the correction lands before anything
 *    is visible — no flash, just a same-frame swap.
 * 3. That effect also writes the cookie, so every visit after the first is
 *    step 1 again, and attaches a matchMedia listener so live resizing across
 *    900px (e.g. rotating a tablet, or resizing a desktop window) updates the
 *    locale immediately without a reload.
 */
export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useLayoutEffect(() => {
    const measured = getViewportLocale(window.innerWidth);
    if (measured !== initialLocale) {
      setLocale(measured);
    }
    writeCookie(measured);
    document.documentElement.lang = measured;

    const query = window.matchMedia(`(min-width: ${LOCALE_BREAKPOINT_PX}px)`);
    function onChange(event: MediaQueryListEvent | MediaQueryList) {
      const next: Locale = event.matches ? "en" : "ko";
      setLocale(next);
      writeCookie(next);
      document.documentElement.lang = next;
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [initialLocale]);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext);
  if (locale === null) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return locale;
}

/**
 * docs/build-prompt.md §9: "타입 세이프한 사전 객체 + useT() 훅으로 충분히 구현한다"
 * — a dictionary object + useT() hook, no library. Pairs are given inline at
 * the call site (`t({ en: "...", ko: "..." })`) rather than pre-registered
 * under a central key, since no screen's copy exists yet beyond what Phase 3
 * touches; a keyed dictionary can replace this later if duplication across
 * call sites becomes a real problem.
 */
export function useT() {
  const locale = useLocale();
  return function t(strings: LocaleStrings): string {
    return strings[locale];
  };
}

