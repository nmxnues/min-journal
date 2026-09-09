"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Modal (desktop, 520px card) and Sheet (mobile, full screen) share one
 * implementation — docs/README.md § Interactions: "New trade" opens the form
 * "full page on desktop, full-screen sheet on mobile", and cash movement is a
 * 520px radius-24 modal. Sheets/modals are the only surfaces that carry a
 * shadow (--shadow-sheet).
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  variant?: "modal" | "sheet";
  children: ReactNode;
  /** Pinned action row at the bottom. */
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  variant = "modal",
  children,
  footer,
  closeLabel = "Close",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const isSheet = variant === "sheet";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-ink/20",
        isSheet ? "items-stretch" : "items-center justify-center p-16",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "flex flex-col bg-surface shadow-sheet outline-none",
          isSheet
            ? "h-full w-full"
            : "max-h-[calc(100vh-32px)] w-full max-w-[520px] rounded-24",
          className,
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-16",
            isSheet ? "px-20 pt-20 pb-16" : "px-34 pt-32 pb-16",
          )}
        >
          <h2 className="text-17 font-bold tracking-[-.02em] text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={cn(
              "-mr-8 flex h-44 w-44 items-center justify-center rounded-12 text-muted",
              "transition-colors duration-150 ease-out hover:bg-divider hover:text-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            )}
          >
            <X aria-hidden size={20} />
          </button>
        </div>

        <div className={cn("flex-1 overflow-y-auto", isSheet ? "px-20" : "px-34")}>{children}</div>

        {footer !== undefined && (
          <div className={cn(isSheet ? "px-20 pt-16 pb-20" : "px-34 pt-16 pb-30")}>{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
