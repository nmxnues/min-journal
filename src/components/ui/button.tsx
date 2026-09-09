import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * docs/README.md § Design Tokens > States: neutral fills step to
 * --color-divider-hover on hover, accent to accent-pressed; focus-visible is
 * a 2px accent ring at 2px offset; disabled is 40% opacity.
 */
export const buttonBase =
  "inline-flex items-center justify-center gap-8 whitespace-nowrap transition-colors duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "disabled:opacity-40 disabled:pointer-events-none";

const tones = {
  /** Filled accent — the page's single primary action. */
  primary: "bg-accent text-white hover:bg-accent-pressed",
  /** Neutral fill, for secondary actions sitting beside a primary one. */
  neutral: "bg-divider text-secondary hover:bg-divider-hover",
  /** Neutral fill with darker ink — the dropzone's "Choose file". */
  subtle: "bg-divider text-body hover:bg-divider-hover",
  /** Text link, e.g. "View all 61" / "Reset". */
  link: "text-accent hover:text-accent-pressed",
  /** Nav-pill look: dark fill, used by the calendar's Week/Month toggle. */
  ink: "bg-ink text-white hover:bg-ink/90",
} as const;

const sizes = {
  /** 9/14 padding, radius 10 — inline actions like "Export CSV". */
  sm: "px-14 py-9 rounded-10 text-13 font-semibold",
  /** 11/18 padding, radius 12 — the top bar's "New trade". */
  md: "px-18 py-11 rounded-12 text-14 font-bold",
  /** 17 vertical, radius 16 — the form's action row. */
  lg: "px-22 py-17 rounded-16 text-16 font-bold",
  /** 16 padding, radius 18 — the mobile full-width CTA. */
  xl: "px-20 py-16 rounded-18 text-16 font-bold",
  /** No padding — for `link`. */
  none: "text-13 font-semibold",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
}

export function Button({
  tone = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonBase, tones[tone], sizes[tone === "link" ? "none" : size], className)}
      {...props}
    />
  );
}
