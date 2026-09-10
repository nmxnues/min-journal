"use client";

import { useEffect } from "react";

/**
 * Lets a screenshot copied elsewhere (TradingView's own chart-capture puts
 * one straight on the clipboard) be dropped into an attachment list with
 * Cmd/Ctrl+V, instead of round-tripping through Save-to-file then Choose
 * file. Listens at `window` rather than requiring the dropzone itself to be
 * focused — after alt-tabbing back from another app, whatever last had focus
 * on the page is unpredictable, and a global listener only ever acts when
 * the clipboard actually contains an image, so it never interferes with a
 * normal text paste into some other field.
 */
export function usePasteAttachment(onFiles: (files: File[]) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function onPaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (items === undefined) return;

      const files: File[] = [];
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file !== null) files.push(file);
      }
      if (files.length === 0) return;

      event.preventDefault();
      onFiles(files);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles, enabled]);
}
