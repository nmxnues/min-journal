"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/**
 * docs/README.md § New trade > Chart & notes: "2px dashed #dde1e6, radius 20,
 * height 210, #fbfcfd fill, centered stack" with a title, a hint, and a
 * "Choose file" button.
 */
export interface DropzoneProps {
  title: ReactNode;
  hint?: ReactNode;
  buttonLabel: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
}

export function Dropzone({
  title,
  hint,
  buttonLabel,
  accept = "image/*",
  multiple = true,
  disabled = false,
  onFiles,
  className,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex h-[210px] flex-col items-center justify-center gap-8 rounded-20 border-2 border-dashed",
        "bg-surface-faint transition-colors duration-150 ease-out",
        isDragging ? "border-accent bg-accent-tint" : "border-border",
        disabled && "opacity-40",
        className,
      )}
    >
      <p className="text-14 font-bold text-secondary">{title}</p>
      {hint !== undefined && <p className="text-12 font-medium text-faint">{hint}</p>}
      <Button
        tone="subtle"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mt-6"
      >
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
