"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHART_SHOTS_BUCKET, validateAttachments } from "@/lib/attachments";
import { readImageDimensions } from "@/lib/attachment-client";
import { createClient } from "@/lib/supabase/client";
import { confirmTradeAttachment, removeTradeAttachment, reserveTradeAttachmentPath } from "./attachments-actions";

export interface TradeAttachment {
  path: string;
  previewUrl: string | null;
}

/**
 * Trade detail's Charts card (docs/README.md § Trade detail): unlike the New
 * trade form's draft attachments, these upload straight to the trade's final
 * `{user_id}/{tradeId}/` folder — the trade already exists, so there is no
 * draft stage to move out of.
 */
export function useTradeAttachments(tradeId: string, initial: readonly { path: string }[]) {
  const [attachments, setAttachments] = useState<TradeAttachment[]>(
    initial.map((a) => ({ path: a.path, previewUrl: null })),
  );
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    let cancelled = false;
    async function loadPreviews() {
      const needing = attachments.filter((a) => a.previewUrl === null);
      if (needing.length === 0) return;

      const results = await Promise.all(
        needing.map((a) =>
          supabaseRef.current.storage.from(CHART_SHOTS_BUCKET).createSignedUrl(a.path, 3600),
        ),
      );
      if (cancelled) return;

      setAttachments((current) =>
        current.map((a) => {
          const index = needing.findIndex((n) => n.path === a.path);
          if (index === -1) return a;
          const url = results[index].data?.signedUrl ?? null;
          return url === null ? a : { ...a, previewUrl: url };
        }),
      );
    }
    void loadPreviews();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.map((a) => a.path).join(",")]);

  const addFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      const { accepted, rejected } = validateAttachments(files, attachments.length);
      if (rejected.length > 0) {
        const reason = rejected[0].reason;
        setError(
          reason === "type"
            ? "Only PNG, JPEG, or WebP images are supported."
            : reason === "size"
              ? "Each attachment can be at most 8MB."
              : "Up to 6 attachments per trade.",
        );
      }
      if (accepted.length === 0) return;

      setUploading((n) => n + accepted.length);
      for (const file of accepted) {
        const reserved = await reserveTradeAttachmentPath(
          tradeId,
          { name: file.name, type: file.type, size: file.size },
          attachments.length,
        );
        if (!reserved.ok) {
          setError(reserved.error);
          setUploading((n) => n - 1);
          continue;
        }

        const { path } = reserved;
        const [dimensions, uploadResult] = await Promise.all([
          readImageDimensions(file),
          supabaseRef.current.storage.from(CHART_SHOTS_BUCKET).upload(path, file, {
            contentType: file.type,
            upsert: false,
          }),
        ]);

        if (uploadResult.error) {
          setError(uploadResult.error.message);
          setUploading((n) => n - 1);
          continue;
        }

        const confirmed = await confirmTradeAttachment(
          tradeId,
          path,
          dimensions?.width ?? null,
          dimensions?.height ?? null,
        );
        setUploading((n) => n - 1);
        if (!confirmed.ok) {
          setError(confirmed.error);
          continue;
        }

        setAttachments((current) => [...current, { path, previewUrl: URL.createObjectURL(file) }]);
      }
    },
    [attachments.length, tradeId],
  );

  const removeAttachment = useCallback(
    async (path: string) => {
      setAttachments((current) => current.filter((a) => a.path !== path));
      await removeTradeAttachment(tradeId, path);
    },
    [tradeId],
  );

  return { attachments, addFiles, removeAttachment, uploading, error };
}
