import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { parseInitialLocale, VIEWPORT_LOCALE_COOKIE } from "@/lib/i18n/locale";
import { SettingsProvider } from "@/lib/settings/context";
import { getSettings } from "@/lib/supabase/queries";
import "./globals.css";

// The manifest itself (app/manifest.ts) and the icon/apple-icon routes are
// Next's own file conventions — both auto-detected and auto-linked into
// <head>, so nothing about them belongs in this metadata object.
export const metadata: Metadata = {
  title: "Min Journal",
  description: "A single-user CRT trading journal.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Min Journal",
  },
};

// Matches manifest.ts's theme_color — this is the separate mechanism that
// also tints the browser chrome (e.g. Safari/Chrome's address-bar area on
// mobile) even before the app is ever added to a home screen.
export const viewport: Viewport = {
  themeColor: "#191f28",
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
