"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  getViewportLocale,
  isMobileViewport,
  LOCALE_BREAKPOINT_PX,
  LOCALE_PREFERENCE_COOKIE,
  resolveLocale,
  VIEWPORT_LOCALE_COOKIE,
  type Locale,
  type LocalePreference,
  type LocaleStrings,
} from "./locale";

interface LocaleState {
  /** The display language: the preference, or the viewport's under "auto". */
  locale: Locale;
  /** Layout only — true on a narrow screen whatever the language. */
  isMobile: boolean;
  preference: LocalePreference;
  setPreference: (preference: LocalePreference) => void;
}

const LocaleContext = createContext<LocaleState | null>(null);

function writeCookie(name: string, value: string) {
  // 1 year, readable by the server on the next request so SSR starts correct.
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export interface LocaleProviderProps {
  /**
   * The locale the server rendered with — from the `viewport-locale` cookie
   * if a previous visit set one, otherwise a guess (see root layout).
   * The client's first render MUST use this exact value (not a fresh
   * `window.innerWidth` read) or React throws a hydration mismatch, since
   * the server has no way to know the viewport width on a request it never
   * saw a screen for.
   *
   * This is the *viewport* locale (see VIEWPORT_LOCALE_COOKIE): it picks the
   * layout, and the language only under "auto".
   */
  initialLocale: Locale;
  /** From the `locale-preference` cookie; "auto" when unset. */
  initialPreference: LocalePreference;
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
export function LocaleProvider({ initialLocale, initialPreference, children }: LocaleProviderProps) {
  const router = useRouter();
  const [viewportLocale, setViewportLocale] = useState<Locale>(initialLocale);
  const [preference, setPreferenceState] = useState<LocalePreference>(initialPreference);
  const locale = resolveLocale(preference, viewportLocale);

  useLayoutEffect(() => {
    const measured = getViewportLocale(window.innerWidth);
    if (measured !== initialLocale) {
      setViewportLocale(measured);
    }
    writeCookie(VIEWPORT_LOCALE_COOKIE, measured);

    const query = window.matchMedia(`(min-width: ${LOCALE_BREAKPOINT_PX}px)`);
    function onChange(event: MediaQueryListEvent | MediaQueryList) {
      const next: Locale = event.matches ? "en" : "ko";
      setViewportLocale(next);
      writeCookie(VIEWPORT_LOCALE_COOKIE, next);
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [initialLocale]);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setPreference = useCallback(
    (next: LocalePreference) => {
      if (next === "auto") {
        document.cookie = `${LOCALE_PREFERENCE_COOKIE}=; path=/; max-age=0; samesite=lax`;
      } else {
        writeCookie(LOCALE_PREFERENCE_COOKIE, next);
      }
      setPreferenceState(next);
      // Server-rendered copy (page titles, anything a Server Component
      // printed) re-renders in the new language.
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({ locale, isMobile: isMobileViewport(viewportLocale), preference, setPreference }),
    [locale, viewportLocale, preference, setPreference],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleState(): LocaleState {
  const state = useContext(LocaleContext);
  if (state === null) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return state;
}

/** Display language. Never use this to pick a layout — that's `useIsMobile`. */
export function useLocale(): Locale {
  return useLocaleState().locale;
}

/** Phone layout vs desktop layout, from the viewport width alone. */
export function useIsMobile(): boolean {
  return useLocaleState().isMobile;
}

/** The Settings screen's language choice for this browser. */
export function useLocalePreference(): Pick<LocaleState, "preference" | "setPreference"> {
  const { preference, setPreference } = useLocaleState();
  return { preference, setPreference };
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

