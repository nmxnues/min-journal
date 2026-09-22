/**
 * Layout is decided by viewport width. Language follows it by default
 * ("auto"), but can be pinned per browser — see LocalePreference below.
 *
 * Original note, which still describes "auto": language by viewport width —
 * confirmed
 * with the design owner (docs/decisions.md § Phase 3). Mobile is for logging
 * a trade right after taking it, where the native language reads faster;
 * desktop is for analysis, where trading terms read more naturally in their
 * original English. There is no /mobile route: this is the same responsive
 * codebase branching its copy, the same way it already branches its layout.
 *
 *   >= LOCALE_BREAKPOINT_PX (900px, matching the responsive rules'
 *   <900px breakpoint exactly) -> "en" (docs/README.md's PC mocks: 1a-1c,
 *   2a-2d, 3a are authored in English)
 *   <  LOCALE_BREAKPOINT_PX -> "ko" (the 1d / 3b-mobile mocks are Korean)
 */
export type Locale = "ko" | "en";

export const LOCALE_BREAKPOINT_PX = 900;

export function getViewportLocale(widthPx: number): Locale {
  return widthPx >= LOCALE_BREAKPOINT_PX ? "en" : "ko";
}

/** A pair of copy in both locales, resolved inline at the call site by useT(). */
export type LocaleStrings = Record<Locale, string>;

/**
 * Written by LocaleProvider on every visit. Its value is the *viewport's*
 * locale — "ko" means a narrow (phone) screen, "en" a wide one — so it drives
 * the layout (phone vs desktop) and, only in "auto", the language too. The
 * values were kept as they were when language and layout were one thing, so
 * cookies already on existing devices keep working.
 */
export const VIEWPORT_LOCALE_COOKIE = "viewport-locale";

/**
 * The Settings screen's language choice. "auto" is the original behaviour
 * (the viewport picks); "ko"/"en" pin the language on this browser only —
 * it lives in a cookie, not the settings row, so a desktop and a phone can
 * differ, and the server reads it so the first paint is already right.
 * Layout never follows this: an English phone still gets the phone layout.
 */
export type LocalePreference = "auto" | Locale;

export const LOCALE_PREFERENCE_COOKIE = "locale-preference";

export function parseLocalePreference(value: string | undefined | null): LocalePreference {
  return isLocale(value) ? value : "auto";
}

export function resolveLocale(preference: LocalePreference, viewportLocale: Locale): Locale {
  return preference === "auto" ? viewportLocale : preference;
}

/** Phone layout — the viewport locale's "ko" half, whatever the display language. */
export function isMobileViewport(viewportLocale: Locale): boolean {
  return viewportLocale === "ko";
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "ko" || value === "en";
}

/** Reads the cookie a Server Component (RootLayout) already fetched, for the
 * very first client render. Deliberately NOT in locale-context.tsx: that
 * file is "use client", and a Server Component cannot call a plain function
 * exported from a "use client" module directly (only render it as a
 * Component or pass it as a prop) — Next's RSC boundary rejects it outright. */
export function parseInitialLocale(cookieValue: string | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : "en";
}
