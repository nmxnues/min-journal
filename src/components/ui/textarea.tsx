import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const tones = {
  /** Notes field on the trade form: radius 20, 210 tall, 18/20 padding. */
  notes: "rounded-20 px-20 py-18 text-14 font-medium leading-[1.6] min-h-[210px]",
  /** Weekly review columns: radius 16, 16/18 padding, min-height 110. */
  review: "rounded-16 px-18 py-16 text-13_5 font-normal leading-[1.6] min-h-[110px]",
} as const;

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: keyof typeof tones;
}

export function Textarea({ tone = "notes", className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full resize-none bg-divider text-ink placeholder:text-muted transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        "disabled:opacity-40 disabled:pointer-events-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
