import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { parseInitialLocale, VIEWPORT_LOCALE_COOKIE } from "@/lib/i18n/locale";
import { SettingsProvider } from "@/lib/settings/context";
import { getSettings } from "@/lib/supabase/queries";
import "./globals.css";

// The manifest (app/manifest.ts) is a Next file convention and auto-linked
// into <head>. The favicons and apple-touch-icon are static files in public/,
// so they're declared here.
export const metadata: Metadata = {
  title: "Min Journal",
  description: "A single-user CRT trading journal.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Min Journal",
  },
};

// Matches manifest.ts's theme_color — this is the separate mechanism that
// also tints the browser chrome (e.g. Safari/Chrome's address-bar area on
// mobile) even before the app is ever added to a home screen.
//
// `viewportFit: "cover"` is the actual prerequisite for
// `env(safe-area-inset-*)` to resolve to anything but `0` on iOS — without
// it, Safari never lets the page draw under the home-indicator area at all,
// so `BottomTabBar`'s own safe-area padding (and the extra breathing room
// added on top of it) was computing against a permanently-zero inset no
// matter what the component itself did. Missing here the whole time; found
// only once the padding bump still didn't read as any different on a real
// iPhone.
export const viewport: Viewport = {
  themeColor: "#191f28",
  viewportFit: "cover",
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
