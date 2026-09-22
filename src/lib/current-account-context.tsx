"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AccountKind } from "@/lib/domain/types";

export interface CurrentAccountSummary {
  name: string;
  kind: AccountKind;
}

const CurrentAccountContext = createContext<CurrentAccountSummary | null>(null);

/**
 * The account every screen is reading, for the desktop top bar's name slot.
 * Seeded by RootLayout from `getCurrentAccount()`. Switching accounts calls
 * `router.refresh()`, which re-runs the layout, so the name follows at once.
 * Null before sign-in or before the first account exists.
 */
export function CurrentAccountProvider({ value, children }: { value: CurrentAccountSummary | null; children: ReactNode }) {
  return <CurrentAccountContext.Provider value={value}>{children}</CurrentAccountContext.Provider>;
}

export function useCurrentAccount(): CurrentAccountSummary | null {
  return useContext(CurrentAccountContext);
}
