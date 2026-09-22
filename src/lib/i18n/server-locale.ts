import "server-only";
import { cookies } from "next/headers";
import {
  LOCALE_PREFERENCE_COOKIE,
  parseInitialLocale,
  parseLocalePreference,
  resolveLocale,
  VIEWPORT_LOCALE_COOKIE,
  type Locale,
  type LocaleStrings,
} from "./locale";

/**
 * The display language for this request, from the same two cookies the
 * client's LocaleProvider writes: the Settings choice, else the viewport's.
 * Lets server actions and page titles answer in the language on screen
 * without every caller having to pass it in.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return resolveLocale(
    parseLocalePreference(cookieStore.get(LOCALE_PREFERENCE_COOKIE)?.value),
    parseInitialLocale(cookieStore.get(VIEWPORT_LOCALE_COOKIE)?.value),
  );
}

/** Server-side `useT()`: `const t = await getServerT(); t({ en, ko })`. */
export async function getServerT(): Promise<(strings: LocaleStrings) => string> {
  const locale = await getRequestLocale();
  return (strings) => strings[locale];
}

/** `generateMetadata` for a page whose title is one translated name. */
export function localizedTitle(name: LocaleStrings) {
  return async () => {
    const t = await getServerT();
    return { title: `${t(name)} · Min Journal` };
  };
}

/** One translated message in the request's language — for server actions' `error` strings. */
export async function tr(strings: LocaleStrings): Promise<string> {
  return strings[await getRequestLocale()];
}
