"use client";

import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/locale-context";

export interface SignOutButtonProps {
  signOutAction: () => Promise<void>;
}

/** A plain "Sign out" action is the whole account menu for now — one user, one action. */
export function SignOutButton({ signOutAction }: SignOutButtonProps) {
  const t = useT();
  return (
    <form action={signOutAction}>
      <Button type="submit" tone="neutral" size="sm">
        {t({ en: "Sign out", ko: "로그아웃" })}
      </Button>
    </form>
  );
}
