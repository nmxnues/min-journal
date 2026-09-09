import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared field chrome — docs/README.md § New trade > Field styling:
 * "label 600 13px #8b95a1, 8px below-gap; control #f2f4f6 fill, radius 14,
 * padding 14/16, value 600 15px #191f28".
 */
export const controlBase =
  "w-full rounded-14 bg-divider px-16 py-14 text-15 font-semibold text-ink " +
  "placeholder:font-medium placeholder:text-muted transition-colors duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "disabled:opacity-40 disabled:pointer-events-none";

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label !== undefined && (
        <label htmlFor={htmlFor} className="mb-8 text-13 font-semibold text-muted">
          {label}
        </label>
      )}
      {children}
      {error !== undefined && error !== null ? (
        <p className="mt-6 text-11_5 font-medium text-loss">{error}</p>
      ) : (
        hint !== undefined && <p className="mt-6 text-11_5 font-medium text-faint">{hint}</p>
      )}
    </div>
  );
}
