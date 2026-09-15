import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * docs/README.md § Dashboard > Components: white bar, 20/32 padding; logo
 * mark (public/logo.png) at 26px — the line-box height of the 800 17px
 * wordmark it replaced; nav items 600 14px, the active one on a
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
  /** Alt text for the logo mark. */
  wordmark?: string;
  className?: string;
}

export function TopBar({
  items,
  activeHref,
  right,
  wordmark = "Min Journal",
  className,
}: TopBarProps) {
  return (
    <header className={cn("flex items-center gap-24 bg-surface px-32 py-20", className)}>
      <Link
        href="/"
        className="shrink-0 rounded-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <Image src="/logo.png" alt={wordmark} width={26} height={26} priority className="block h-26 w-26" />
      </Link>

      <nav className="flex items-center gap-4">
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

      {right !== undefined && <div className="ml-auto flex items-center gap-16">{right}</div>}
    </header>
  );
}
