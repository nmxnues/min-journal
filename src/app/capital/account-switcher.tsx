"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Account } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/locale-context";
import { AccountSetup } from "../trades/new/account-setup";
import { setCurrentAccount } from "./actions";

const KIND_LABELS = {
  live: { en: "Live", ko: "실거래" },
  backtest: { en: "Backtest", ko: "백테스트" },
} as const;

/**
 * Capital's account creation + switching (docs/decisions.md § Phase 9
 * multi-account follow-up). A compact trigger — current account's name plus
 * its kind chip — opens a popover listing every account, closes-on-blur like
 * every other dropdown in this app (`Combobox`/`FilterDropdown`), with
 * "+ New account" at the bottom rather than a separate button elsewhere.
 */
export function AccountSwitcher({
  accounts,
  currentAccountId,
  compact = false,
}: {
  accounts: readonly Account[];
  currentAccountId: string;
  /** Mobile's own tighter header. */
  compact?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [setupOpen, setSetupOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = accounts.find((a) => a.id === currentAccountId) ?? accounts[0];

  function onBlur() {
    blurTimer.current = setTimeout(() => setIsOpen(false), 120);
  }
  function onFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  function switchTo(id: string) {
    if (id === currentAccountId) {
      setIsOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await setCurrentAccount(id);
      setIsOpen(false);
      if (result.ok) router.refresh();
    });
  }

  if (current === undefined) return null;

  return (
    <div className="relative" onBlur={onBlur} onFocus={onFocus}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "flex items-center gap-8 rounded-12 bg-divider font-semibold text-ink transition-colors duration-150 ease-out hover:bg-divider-hover disabled:opacity-40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          compact ? "px-12 py-9 text-13" : "px-14 py-11 text-13_5",
        )}
      >
        <span className="max-w-[160px] truncate">{current.name}</span>
        <Chip tone={current.kind === "backtest" ? "accent" : "neutral"} shape="stat">
          {t(KIND_LABELS[current.kind])}
        </Chip>
        <ChevronDown aria-hidden size={14} className="text-faint" />
      </button>

      {isOpen && (
        <ul className="absolute z-20 mt-6 min-w-[240px] overflow-hidden rounded-14 bg-surface py-6 shadow-sheet">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  switchTo(account.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  switchTo(account.id);
                }}
                className={cn(
                  "flex w-full items-center gap-10 px-16 py-10 text-left text-14 font-semibold whitespace-nowrap text-body",
                  account.id === currentAccountId && "bg-divider",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                )}
              >
                <span className="flex w-16 shrink-0 justify-center text-accent">
                  {account.id === currentAccountId && <Check aria-hidden size={14} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{account.name}</span>
                <Chip tone={account.kind === "backtest" ? "accent" : "neutral"} shape="stat" className="shrink-0">
                  {t(KIND_LABELS[account.kind])}
                </Chip>
              </button>
            </li>
          ))}
          <li className="mt-6 border-t border-divider pt-6">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                if (blurTimer.current) clearTimeout(blurTimer.current);
                setIsOpen(false);
                setSetupOpen(true);
              }}
              className="flex w-full items-center gap-8 px-16 py-10 text-left text-14 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <Plus aria-hidden size={14} />
              {t({ en: "New account", ko: "새 계좌" })}
            </button>
          </li>
        </ul>
      )}

      {setupOpen && (
        <AccountSetup
          context="additional"
          onCreated={(newAccountId) => {
            setSetupOpen(false);
            startTransition(async () => {
              await setCurrentAccount(newAccountId);
              router.refresh();
            });
          }}
          onCancel={() => setSetupOpen(false)}
        />
      )}
    </div>
  );
}
