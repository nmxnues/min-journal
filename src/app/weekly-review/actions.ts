"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import type { FocusItem } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface ReviewTextInput {
  whatWorked: string;
  whatDidnt: string;
  oneChange: string;
}

export async function saveReviewText(isoWeek: string, input: ReviewTextInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_reviews")
    .update({
      what_worked: input.whatWorked.trim() === "" ? null : input.whatWorked.trim(),
      what_didnt: input.whatDidnt.trim() === "" ? null : input.whatDidnt.trim(),
      one_change: input.oneChange.trim() === "" ? null : input.oneChange.trim(),
    })
    .eq("iso_week", isoWeek);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/weekly-review");
  return { ok: true };
}

/** The client already holds the full array (it's what renders the checklist) — simplest to just save the whole thing back rather than index-addressed toggle/add/remove actions. */
export async function saveFocusItems(isoWeek: string, items: FocusItem[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_reviews")
    .update({ focus_items: items as unknown as Json })
    .eq("iso_week", isoWeek);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/weekly-review");
  return { ok: true };
}
