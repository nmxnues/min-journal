"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCurrentAccount } from "@/lib/current-account-context";
import { useT } from "@/lib/i18n/locale-context";
import { ACCOUNT_KIND_LABELS } from "@/lib/labels";

/**
 * docs/README.md § Dashboard > Components: white bar, 20/32 padding; wordmark
 * 800 17px letter-spacing -.03em; nav items 600 14px, the active one on a
 * #f2f4f6 radius-10 pill at 8/14 with ink text, inactive #8b95a1 with no fill.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Route doesn't exist yet — render inert rather than linking into a 404. */
  disabled?: boolean;
}

export interface TopBarProps {
  items: readonly NavItem[];
  activeHref: string;
  /** Month label, primary button, etc. */
  right?: ReactNode;
  /** Shown only when there is no current account yet (e.g. before the first one is set up). */
  wordmark?: string;
  className?: string;
}

export function TopBar({
  items,
  activeHref,
  right,
  wordmark = "Min's",
  className,
}: TopBarProps) {
  const t = useT();
  const account = useCurrentAccount();
  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-x-16 gap-y-10 bg-surface px-20 py-16",
        "min-[1440px]:flex-nowrap min-[1440px]:gap-24 min-[1440px]:px-32 min-[1440px]:py-20",
        className,
      )}
    >
      {/*
        The current account's name where the wordmark was, with a small
        Live/Backtest tag (the account switcher's own chip). Still the home
        link it always was.

        The slot is a fixed width, so the nav starts in the same place
        whatever the account is called; a longer name truncates inside it
        (full name on hover) rather than moving anything.

        Below 1440px the row cannot hold all three: the English nav plus the
        dashboard's own buttons already overflowed at 900-1024px with the old
        wordmark, and a readable account name needs ~240px more. There the
        nav drops to its own second line (`w-full` + `order-3`), which keeps
        every label readable and the name at full width instead of squeezing
        it to one letter. 1440 is where one row measurably fits again.
      */}
      <Link
        href="/"
        title={account?.name}
        className="order-1 flex w-[240px] shrink-0 items-center gap-8 overflow-hidden rounded-6 pr-16 min-[1440px]:w-[280px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <span className="truncate text-17 font-extrabold tracking-[-.03em] text-ink">{account?.name ?? wordmark}</span>
        {account !== null && (
          <Chip tone={account.kind === "backtest" ? "accent" : "neutral"} shape="stat" className="shrink-0 px-6 py-3 text-11">
            {t(ACCOUNT_KIND_LABELS[account.kind])}
          </Chip>
        )}
      </Link>

      <nav className="order-3 flex w-full shrink-0 items-center gap-4 min-[1440px]:order-2 min-[1440px]:w-auto">
        {items.map((item) => {
          if (item.disabled === true) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="rounded-10 px-14 py-8 text-14 font-semibold text-faint opacity-40"
              >
                {item.label}
              </span>
            );
          }

          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-10 px-14 py-8 text-14 font-semibold transition-colors duration-150 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                isActive ? "bg-divider text-ink" : "text-muted hover:text-secondary",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {right !== undefined && (
        <div className="order-2 ml-auto flex shrink-0 items-center gap-10 whitespace-nowrap min-[1440px]:order-3 min-[1440px]:gap-16">{right}</div>
      )}
    </header>
  );
}
