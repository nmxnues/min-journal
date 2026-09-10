import Link from "next/link";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";

/**
 * Mobile navigation. The 1d mock has no tab bar drawn (its home screen ends at
 * the "기록하기" CTA), so this is designed from the same vocabulary as TopBar:
 * the active item takes ink, inactive stays muted, and every target clears the
 * 44px minimum from docs/README.md § Responsive rules.
 */
export interface TabItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  /** Route doesn't exist yet — render inert rather than linking into a 404. */
  disabled?: boolean;
}

export interface BottomTabBarProps {
  items: readonly TabItem[];
  activeHref: string;
  className?: string;
}

export function BottomTabBar({ items, activeHref, className }: BottomTabBarProps) {
  return (
    <nav
      className={cn(
        "sticky bottom-0 flex border-t border-divider bg-surface pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;

        if (item.disabled === true) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-4 py-8 text-muted opacity-40"
            >
              <Icon aria-hidden size={20} />
              <span className="text-11 font-semibold">{item.label}</span>
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
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-4 py-8",
              "transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              isActive ? "text-ink" : "text-muted",
            )}
          >
            <Icon aria-hidden size={20} />
            <span className={cn("text-11 font-semibold", isActive && "font-bold")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
