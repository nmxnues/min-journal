import "server-only";
import type { Json } from "@/lib/database.types";
import { carryOverFocusItems, shiftIsoWeek, type IsoWeek } from "@/lib/domain/weekly-review";
import type { WeeklyReview } from "@/lib/domain/types";
import { getWeeklyReview, toWeeklyReview } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Also returns the previous week's review (needed anyway to compute
 * carry-over) so the page never has to fetch it a second time just to
 * power "Copy last week's notes".
 */
export async function getOrCreateWeeklyReview(
  isoWeek: IsoWeek,
): Promise<{ review: WeeklyReview; previous: WeeklyReview | null }> {
  const previous = await getWeeklyReview(shiftIsoWeek(isoWeek, -1));
  const existing = await getWeeklyReview(isoWeek);
  if (existing !== null) return { review: existing, previous };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) throw new Error("Not signed in.");

  const focusItems = previous !== null ? carryOverFocusItems(previous.focusItems) : [];

  const { data, error } = await supabase
    .from("weekly_reviews")
    .insert({ user_id: user.id, iso_week: isoWeek, focus_items: focusItems as unknown as Json })
    .select("*")
    .single();

  if (error) throw error;
  return { review: toWeeklyReview(data), previous };
}
