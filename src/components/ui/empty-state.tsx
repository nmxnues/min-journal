import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Not drawn in the mocks — docs/README.md § Empty states asks for them to be
 * designed "from the same card vocabulary", so this is the card's own
 * typography at rest: a 700 16px title, a 500 13.5px body line, and one
 * optional action.
 */
export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-8 rounded-20 bg-surface-subtle px-24 py-40 text-center",
        className,
      )}
    >
      <p className="text-16 font-bold tracking-[-.02em] text-ink">{title}</p>
      {description !== undefined && (
        <p className="max-w-[320px] text-13_5 font-medium leading-[1.6] text-muted">{description}</p>
      )}
      {action !== undefined && <div className="mt-8">{action}</div>}
    </div>
  );
}
