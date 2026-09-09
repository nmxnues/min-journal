"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft, type DraftPayload } from "./draft-actions";

/**
 * docs/decisions.md § Phase 4b: field edits autosave 1.5s after the trader
 * stops typing (short enough that closing the browser mid-edit doesn't lose
 * the last few characters — a draft write is cheap, there's no reason to
 * wait longer). Attachment changes bypass the debounce entirely and save
 * immediately, since losing track of an upload is worse than an extra write.
 */
const DEBOUNCE_MS = 1500;

export type DraftSaveStatus = "idle" | "saving" | "saved" | "restored";

export function useDraftAutosave(payload: DraftPayload, restoredAt: string | null) {
  const [status, setStatus] = useState<DraftSaveStatus>(restoredAt !== null ? "restored" : "idle");
  const [savedAt, setSavedAt] = useState<Date | null>(
    restoredAt !== null ? new Date(restoredAt) : null,
  );

  const serialized = JSON.stringify(payload);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const lastSavedRef = useRef(serialized);
  const lastAttachmentsRef = useRef(JSON.stringify(payload.attachmentPaths));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(() => {
    lastSavedRef.current = JSON.stringify(payloadRef.current);
    lastAttachmentsRef.current = JSON.stringify(payloadRef.current.attachmentPaths);
    setStatus("saving");
    return saveDraft(payloadRef.current).then((result) => {
      if (result.ok) {
        setSavedAt(new Date(result.updatedAt));
        setStatus("saved");
      }
      return result;
    });
  }, []);

  useEffect(() => {
    if (serialized === lastSavedRef.current) return;

    const attachmentsChanged =
      JSON.stringify(payload.attachmentPaths) !== lastAttachmentsRef.current;

    if (timerRef.current !== null) clearTimeout(timerRef.current);

    if (attachmentsChanged) {
      void commit();
    } else {
      timerRef.current = setTimeout(() => void commit(), DEBOUNCE_MS);
    }

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
    // `serialized` is the real dependency; payload/commit are stable via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  /** Used by the "Save draft" button: save right now, skipping the debounce. */
  const flush = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (serialized === lastSavedRef.current) return Promise.resolve();
    return commit();
  }, [commit, serialized]);

  return { status, savedAt, flush };
}
