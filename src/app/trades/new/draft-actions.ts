"use server";

import { createClient } from "@/lib/supabase/server";
import type { NewTradeInput } from "./schema";
import { tr } from "@/lib/i18n/server-locale";

/**
 * `drafts` is one row per user (user_id is the PK) — a single in-progress
 * trade, per docs/README.md's `Draft` entity. That single-row shape is what
 * makes the attachment orphan story tractable (see attachments.ts): there is
 * exactly one place temp uploads can belong to.
 */
export interface DraftPayload {
  values: NewTradeInput;
  /** Storage paths under {user_id}/drafts/ — not yet attached to a trade. */
  attachmentPaths: string[];
}

export interface DraftRecord {
  payload: DraftPayload;
  updatedAt: string;
}

/**
 * No `auth.getUser()` first: that's a round trip to the Auth server before
 * the query can even start, on every New trade page load. RLS already scopes
 * `drafts` to the signed-in user, and the table holds one row per user, so
 * this reads back that row — or null with no draft or no session — the same
 * way `getSettings()` reads its one row.
 */
export async function getDraft(): Promise<DraftRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("drafts").select("payload, updated_at").maybeSingle();

  if (error) throw error;
  if (data === null) return null;

  return { payload: data.payload as unknown as DraftPayload, updatedAt: data.updated_at };
}

export async function saveDraft(
  payload: DraftPayload,
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: await tr({ en: "Not signed in.", ko: "로그인이 필요합니다." }) };

  const { data, error } = await supabase
    .from("drafts")
    .upsert({ user_id: user.id, payload: payload as unknown as never }, { onConflict: "user_id" })
    .select("updated_at")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, updatedAt: data.updated_at };
}

export async function deleteDraft(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return;

  await supabase.from("drafts").delete().eq("user_id", user.id);
}
