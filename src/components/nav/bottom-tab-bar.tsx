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

/**
 * `fixed`, not `sticky` — a page shorter than the viewport (an empty state,
 * a short list) has nothing for `sticky` to stick against, so it rendered in
 * normal flow right after the content instead of pinned to the screen's own
 * bottom edge, leaving a gap of bare page background below it (found on a
 * real phone, not just reasoned about). The leading spacer div reserves the
 * same height in normal flow so the bar never overlaps the last thing on the
 * page — one place to get this right instead of a bottom-padding value
 * copied into every mobile screen that renders this component.
 *
 * `BAR_EXTRA_BOTTOM_PADDING` is a second, separate real-phone finding: with
 * only `env(safe-area-inset-bottom)` below the tab content, the labels sat
 * right on top of the iOS home-indicator strip with nothing between them,
 * cramped enough to mistap. Added *on top of* the safe-area inset, not
 * instead of it, so the row of tabs sits a real 10px above the indicator on
 * any device — zero extra padding added on a device with no inset at all
 * (an older iPhone SE shape), since `env()` resolves to 0 there.
 */
const BAR_EXTRA_BOTTOM_PADDING = 10;

export function BottomTabBar({ items, activeHref, className }: BottomTabBarProps) {
  return (
    <>
      <div
        aria-hidden
        style={{ height: `calc(56px + env(safe-area-inset-bottom) + ${BAR_EXTRA_BOTTOM_PADDING}px)` }}
      />
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex border-t border-divider bg-surface",
          className,
        )}
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${BAR_EXTRA_BOTTOM_PADDING}px)` }}
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
    </>
  );
}
