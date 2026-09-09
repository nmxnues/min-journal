"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHART_SHOTS_BUCKET, validateAttachments } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";
import { deleteDraftAttachment, reserveDraftAttachmentPath } from "./attachments-actions";

export interface DraftAttachment {
  path: string;
  width: number | null;
  height: number | null;
  /** Object/signed URL for the thumbnail — always present once loaded. */
  previewUrl: string | null;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Manages the draft's attachments: uploads land immediately in
 * {user_id}/drafts/ (see docs/decisions.md § Phase 4b) so they survive a
 * reload the same way the rest of the draft does, and the hook exposes
 * exactly the path list the draft-autosave effect needs to persist.
 */
export function useDraftAttachments(initial: readonly { path: string }[]) {
  const [attachments, setAttachments] = useState<DraftAttachment[]>(
    initial.map((a) => ({ path: a.path, width: null, height: null, previewUrl: null })),
  );
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  // Restored-draft attachments have no in-memory File, so their preview comes
  // from a signed URL (the bucket is private) instead of an object URL.
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
    // Only re-run when the set of paths actually changes.
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
        const reserved = await reserveDraftAttachmentPath(
          { name: file.name, type: file.type, size: file.size },
          attachments.length,
        );
        if (!reserved.ok) {
          setError(reserved.error);
          setUploading((n) => n - 1);
          continue;
        }

        const { path } = reserved.attachment;
        const [dimensions, uploadResult] = await Promise.all([
          readImageDimensions(file),
          supabaseRef.current.storage.from(CHART_SHOTS_BUCKET).upload(path, file, {
            contentType: file.type,
            upsert: false,
          }),
        ]);

        setUploading((n) => n - 1);
        if (uploadResult.error) {
          setError(uploadResult.error.message);
          continue;
        }

        setAttachments((current) => [
          ...current,
          {
            path,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
            previewUrl: URL.createObjectURL(file),
          },
        ]);
      }
    },
    [attachments.length],
  );

  const removeAttachment = useCallback(async (path: string) => {
    setAttachments((current) => current.filter((a) => a.path !== path));
    await deleteDraftAttachment(path);
  }, []);

  return { attachments, addFiles, removeAttachment, uploading, error };
}
