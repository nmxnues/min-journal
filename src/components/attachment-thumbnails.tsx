"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/locale-context";

export interface AttachmentThumbnailsProps {
  attachments: readonly { path: string; previewUrl: string | null }[];
  onRemove: (path: string) => void;
  className?: string;
}

/**
 * Shared by the New trade form, Trade detail's edit form, and Trade detail's
 * own Charts card (docs/decisions.md § Phase 4c thumbnail fix) — one fixed
 * 16:9 tile shape everywhere a chart screenshot shows up, cropped with
 * `object-cover` rather than stacked full-width at the original aspect ratio
 * (a TradingView capture is landscape, so an uncropped stack read as an
 * unrecognizable vertical sliver). 16:9 over a square: it keeps more of a
 * typical chart screenshot's horizontal detail than a square crop would.
 * Owns its own lightbox so every call site gets click-to-enlarge for free
 * instead of three separate copies of the same modal wiring.
 */
export function AttachmentThumbnails({ attachments, onRemove, className }: AttachmentThumbnailsProps) {
  const t = useT();
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className={cn("flex flex-wrap gap-8", className)}>
        {attachments.map((attachment) => (
          <div
            key={attachment.path}
            className="group relative h-90 w-160 shrink-0 overflow-hidden rounded-14 bg-divider"
          >
            <button
              type="button"
              onClick={() => {
                if (attachment.previewUrl !== null) setLightbox(attachment.previewUrl);
              }}
              aria-label={t({ en: "Open screenshot", ko: "스크린샷 열기" })}
              className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              {attachment.previewUrl !== null && (
                // Screenshots the trader just added — no next/image benefit
                // for private, ephemeral-URL thumbnails.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.previewUrl} alt="" className="h-full w-full object-cover" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(attachment.path)}
              aria-label={t({ en: "Remove", ko: "삭제" })}
              className="absolute top-6 right-6 flex h-24 w-24 items-center justify-center rounded-pill bg-ink/60 text-white opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X aria-hidden size={14} />
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        title={t({ en: "Chart", ko: "차트" })}
        closeLabel={t({ en: "Close", ko: "닫기" })}
      >
        {lightbox !== null && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lightbox} alt="" className="w-full rounded-16" />
        )}
      </Modal>
    </>
  );
}
