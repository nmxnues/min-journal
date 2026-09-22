"use server";

import { revalidatePath } from "next/cache";
import {
  ALLOWED_ATTACHMENT_TYPES,
  CHART_SHOTS_BUCKET,
  MAX_ATTACHMENTS_PER_TRADE,
  MAX_ATTACHMENT_BYTES,
  tradeAttachmentPath,
  uniqueAttachmentFilename,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n/server-locale";

export type ReserveResult = { ok: true; path: string } | { ok: false; error: string };
export type ActionResultVoid = { ok: true } | { ok: false; error: string };

/**
 * Trade detail's "Add" link (docs/README.md § Trade detail, Charts card)
 * uploads straight into the trade's own final folder — unlike the New trade
 * form there is no draft stage to pass through first, since the trade this
 * attachment belongs to already exists. Upload itself happens client-side
 * (direct browser -> Storage), this only mints the destination path and
 * re-checks type/size/count server-side.
 */
export async function reserveTradeAttachmentPath(
  tradeId: string,
  file: { name: string; type: string; size: number },
  existingCount: number,
): Promise<ReserveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: await tr({ en: "Not signed in.", ko: "로그인이 필요합니다." }) };

  if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: await tr({ en: "That file type isn't supported.", ko: "지원하지 않는 파일 형식입니다." }) };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: await tr({ en: "That file is too large.", ko: "파일이 너무 큽니다." }) };
  }
  if (existingCount >= MAX_ATTACHMENTS_PER_TRADE) {
    return { ok: false, error: await tr({ en: `Up to ${MAX_ATTACHMENTS_PER_TRADE} attachments per trade.`, ko: `트레이드당 첨부는 최대 ${MAX_ATTACHMENTS_PER_TRADE}개입니다.` }) };
  }

  const path = tradeAttachmentPath(user.id, tradeId, uniqueAttachmentFilename(file.name));
  return { ok: true, path };
}

/** Inserts the `attachments` row once the client's direct upload has succeeded. */
export async function confirmTradeAttachment(
  tradeId: string,
  path: string,
  width: number | null,
  height: number | null,
): Promise<ActionResultVoid> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: await tr({ en: "Not signed in.", ko: "로그인이 필요합니다." }) };

  const { error } = await supabase.from("attachments").insert({
    user_id: user.id,
    trade_id: tradeId,
    storage_path: path,
    width,
    height,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/trades/${tradeId}`);
  return { ok: true };
}

/**
 * Removes both the Storage object and its `attachments` row, matched by
 * `storage_path` rather than the row's own id — `uniqueAttachmentFilename`
 * already makes the path unique, so the client never needs to learn the
 * database-generated id just to delete what it just uploaded.
 */
export async function removeTradeAttachment(tradeId: string, path: string): Promise<ActionResultVoid> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: await tr({ en: "Not signed in.", ko: "로그인이 필요합니다." }) };
  if (!path.startsWith(`${user.id}/`)) return { ok: false, error: await tr({ en: "Not your attachment.", ko: "내 첨부 파일이 아닙니다." }) };

  await supabase.storage.from(CHART_SHOTS_BUCKET).remove([path]);
  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("trade_id", tradeId)
    .eq("storage_path", path);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/trades/${tradeId}`);
  return { ok: true };
}
