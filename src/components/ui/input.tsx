import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlBase } from "./field";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(controlBase, className)} {...props} />;
}
