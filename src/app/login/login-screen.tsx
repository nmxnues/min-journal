"use client";

import { useT } from "@/lib/i18n/locale-context";
import { LoginForm } from "./login-form";

/**
 * No mockup exists for /login (docs/README.md § Routes lists it with none),
 * so both locales' copy here are original, not lifted from a screen — chosen
 * to read naturally rather than as a literal translation of each other,
 * matching docs/README.md §9's own example
 * (`dashboard.hero.label = { ko: "이번 달 누적", en: "Month to date" }`).
 */
export function LoginScreen({ next }: { next?: string }) {
  const t = useT();

  return (
    <main className="flex flex-1 items-center justify-center bg-page px-16">
      <div className="w-full max-w-[380px] rounded-24 bg-surface p-32">
        <p className="text-17 font-extrabold tracking-[-.03em] text-ink">Min Journal</p>
        <p className="mt-6 mb-32 text-13_5 text-secondary">
          {t({ en: "Log in to continue.", ko: "로그인하고 계속하세요." })}
        </p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
