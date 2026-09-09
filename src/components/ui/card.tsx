import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The design is nearly flat (docs/README.md § Elevation): surfaces separate by
 * fill and radius, not shadow. Top-level cards are radius 24; padding varies
 * per screen, so callers set it.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-24 bg-surface", className)} {...props} />;
}

/** The inset #f9fafb tiles and panels (radius 16-20). */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-16 bg-surface-subtle", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-16 font-bold tracking-[-.02em] text-ink", className)}
      {...props}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Title on the left, a text link or control on the right. */
export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-16", className)}>
      <CardTitle>{title}</CardTitle>
      {action}
    </div>
  );
}
