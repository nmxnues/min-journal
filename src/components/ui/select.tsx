import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlBase } from "./field";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Field styling plus the mock's trailing chevron (its "▾" glyph) in faint ink. */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "cursor-pointer appearance-none pr-40", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 right-16 -translate-y-1/2 text-faint"
      />
    </div>
  );
}
