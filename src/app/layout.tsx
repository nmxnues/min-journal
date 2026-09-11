import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { parseInitialLocale, VIEWPORT_LOCALE_COOKIE } from "@/lib/i18n/locale";
import { SettingsProvider } from "@/lib/settings/context";
import { getSettings } from "@/lib/supabase/queries";
import "./globals.css";

// PWA manifest + icons + `viewport` are Phase 9's task 4, not part of this
// pass (docs/decisions.md) — added here once the actual icon files exist,
// rather than pointing metadata at assets that don't exist yet.
export const metadata: Metadata = {
  title: "Min Journal",
  description: "A single-user CRT trading journal.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The cookie is written by LocaleProvider on every prior visit, so almost
  // every request already knows the real viewport width. Only a visitor's
  // very first-ever request has no cookie; "en" is the fallback guess for
  // that one case, corrected client-side before paint (see locale-context.tsx).
  const cookieStore = await cookies();
  const initialLocale = parseInitialLocale(cookieStore.get(VIEWPORT_LOCALE_COOKIE)?.value);

  // getSettings() is RLS-scoped and returns null rather than throwing when
  // there's no session (e.g. /login) or no row yet — safe to call on every
  // route. `pnl_convention` needs no React state (see settings/context.tsx);
  // it's applied here, once, as the `data-pnl` attribute globals.css keys
  // off. `r_precision` does need to reach client components, via
  // SettingsProvider — a Settings screen save calls `router.refresh()`,
  // which re-runs this layout and hands the provider the new value, the same
  // round trip every other write in this app already uses.
  const settings = await getSettings();
  const pnlConvention = settings?.pnl_convention === "west" ? "west" : undefined;
  const rPrecision = settings?.r_precision ?? 1;

  return (
    <html lang={initialLocale} data-pnl={pnlConvention} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={initialLocale}>
          <SettingsProvider value={{ rPrecision }}>{children}</SettingsProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
