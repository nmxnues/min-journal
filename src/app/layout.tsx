import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { parseInitialLocale, VIEWPORT_LOCALE_COOKIE } from "@/lib/i18n/locale";
import "./globals.css";

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

  return (
    <html lang={initialLocale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
