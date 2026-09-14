"use server";

import { revalidatePath } from "next/cache";
import { parseNumberInput } from "@/lib/format";
import type { PnlConvention, Session } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

export interface SettingsInput {
  pnlConvention: PnlConvention;
  defaultInstrument: string;
  defaultSession: Session;
  rPrecision: string;
  tagPresets: string[];
}

const VALID_PNL_CONVENTIONS: readonly PnlConvention[] = ["kr", "west"];
const VALID_SESSIONS: readonly Session[] = ["asia", "london", "ny_am"];

/**
 * One row per user (`settings.user_id` is the PK, already seeded by
 * `handle_new_user` — see docs/decisions.md § Phase 1), so this is always an
 * update, never an insert. Every field is re-validated server-side against
 * the same bounds the UI restricts to, since the UI's own restrictions
 * (e.g. only offering 0/1/2 for r_precision) are a display choice, not the
 * database's actual `check (r_precision between 0 and 4)`.
 */
export async function updateSettings(input: SettingsInput): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  if (!VALID_PNL_CONVENTIONS.includes(input.pnlConvention)) {
    return { ok: false, error: "Unknown P&L color convention." };
  }
  if (!VALID_SESSIONS.includes(input.defaultSession)) {
    return { ok: false, error: "Unknown default session." };
  }
  const instrument = input.defaultInstrument.trim();
  if (instrument === "") return { ok: false, error: "Enter a default instrument." };

  const rPrecision = parseNumberInput(input.rPrecision);
  if (rPrecision === null || !Number.isInteger(rPrecision) || rPrecision < 0 || rPrecision > 4) {
    return { ok: false, error: "R precision must be a whole number of decimal places, 0 to 4." };
  }

  // Trimmed, non-empty, de-duplicated — same re-validation stance as every
  // other field here (the client's own trim/dedupe is a display nicety, not
  // the source of truth).
  const tagPresets = [...new Set(input.tagPresets.map((tag) => tag.trim()).filter((tag) => tag !== ""))];
  if (tagPresets.length === 0) return { ok: false, error: "Add at least one tag." };

  // upsert, not update: settings.user_id is the PK, always seeded by
  // handle_new_user (docs/decisions.md § Phase 1) — but if that row is
  // somehow missing, an update would silently match zero rows rather than
  // creating one.
  const { error } = await supabase.from("settings").upsert({
    user_id: user.id,
    pnl_convention: input.pnlConvention,
    default_instrument: instrument,
    default_session: input.defaultSession,
    r_precision: rPrecision,
    tag_presets: tagPresets,
  });

  if (error) return { ok: false, error: error.message };

  // The whole tree, not just /settings: pnl_convention flips a `data-pnl`
  // attribute RootLayout sets, and r_precision feeds every screen through
  // SettingsProvider — both are only re-read there.
  revalidatePath("/", "layout");
  return { ok: true };
}
