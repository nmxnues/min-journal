"use server";

import { revalidatePath } from "next/cache";
import {
  ALLOWED_ATTACHMENT_TYPES,
  basename,
  CHART_SHOTS_BUCKET,
  draftAttachmentFolder,
  draftAttachmentPath,
  MAX_ATTACHMENTS_PER_TRADE,
  MAX_ATTACHMENT_BYTES,
  tradeAttachmentPath,
  uniqueAttachmentFilename,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n/server-locale";

export interface UploadedAttachment {
  path: string;
  width: number | null;
  height: number | null;
}

export type UploadDraftAttachmentResult =
  | { ok: true; attachment: UploadedAttachment }
  | { ok: false; error: string };

/**
 * The upload itself happens client-side (direct browser -> Storage, so large
 * files don't round-trip through a Server Action's body) — this only mints
 * the destination path and validates count server-side, since a client-side
 * cap is trivially bypassable.
 */
export async function reserveDraftAttachmentPath(
  file: { name: string; type: string; size: number },
  existingCount: number,
): Promise<UploadDraftAttachmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: await tr({ en: "Not signed in.", ko: "로그인이 필요합니다." }) };

  // The client's own validateAttachments() call already gates the picker/drop
  // UI; this is the check that actually matters, since anything client-side
  // is trivially bypassable.
  if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: await tr({ en: "That file type isn't supported.", ko: "지원하지 않는 파일 형식입니다." }) };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: await tr({ en: "That file is too large.", ko: "파일이 너무 큽니다." }) };
  }
  if (existingCount >= MAX_ATTACHMENTS_PER_TRADE) {
    return { ok: false, error: await tr({ en: `Up to ${MAX_ATTACHMENTS_PER_TRADE} attachments per trade.`, ko: `트레이드당 첨부는 최대 ${MAX_ATTACHMENTS_PER_TRADE}개입니다.` }) };
  }

  const path = draftAttachmentPath(user.id, uniqueAttachmentFilename(file.name));
  return { ok: true, attachment: { path, width: null, height: null } };
}

/** Deletes a still-draft (never attached to a trade) upload immediately. */
export async function deleteDraftAttachment(path: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return;
  if (!path.startsWith(`${user.id}/drafts/`)) return; // never delete outside your own draft folder

  await supabase.storage.from(CHART_SHOTS_BUCKET).remove([path]);
  revalidatePath("/trades/new");
}

/**
 * Best-effort cleanup, run once per New Trade page load: anything sitting in
 * the user's draft folder that the current draft no longer references is a
 * leftover from an overwritten/abandoned draft, not a file anything still
 * needs. Not a cron job — there's exactly one draft per user, so the next
 * time they open this page is always a safe moment to reconcile.
 */
export async function reconcileDraftAttachments(referencedPaths: readonly string[]): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return;

  const { data, error } = await supabase.storage
    .from(CHART_SHOTS_BUCKET)
    .list(draftAttachmentFolder(user.id));
  if (error || data === null) return;

  const referenced = new Set(referencedPaths);
  const orphaned = data
    .map((entry) => draftAttachmentPath(user.id, entry.name))
    .filter((path) => !referenced.has(path));

  if (orphaned.length > 0) {
    await supabase.storage.from(CHART_SHOTS_BUCKET).remove(orphaned);
  }
}

/**
 * Moves every draft attachment into its trade's own folder and inserts the
 * `attachments` rows — called once a trade has actually been created, since
 * `attachments.trade_id` is NOT NULL. `move` is an atomic rename within the
 * bucket, so nothing is left behind at the draft path to clean up afterward.
 * Best-effort per file: one failed move doesn't roll back the trade that was
 * already saved, it just leaves that file for a retry later.
 */
export async function attachDraftFilesToTrade(
  userId: string,
  tradeId: string,
  draftPaths: readonly string[],
): Promise<void> {
  if (draftPaths.length === 0) return;

  const supabase = await createClient();

  for (const draftPath of draftPaths) {
    const finalPath = tradeAttachmentPath(userId, tradeId, basename(draftPath));
    const { error: moveError } = await supabase.storage
      .from(CHART_SHOTS_BUCKET)
      .move(draftPath, finalPath);
    if (moveError) continue;

    await supabase.from("attachments").insert({
      user_id: userId,
      trade_id: tradeId,
      storage_path: finalPath,
    });
  }
}
