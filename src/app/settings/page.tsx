import type { Metadata } from "next";
import type { Settings } from "@/lib/domain/types";
import { DEFAULT_TAG_PRESETS } from "@/lib/labels";
import { getSettings, toSettings } from "@/lib/supabase/queries";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = {
  title: "Settings · Min Journal",
};

const FALLBACK_SETTINGS: Settings = {
  pnlConvention: "kr",
  defaultInstrument: "EURUSD",
  defaultSession: "asia",
  rPrecision: 1,
  tagPresets: DEFAULT_TAG_PRESETS.slice(),
};

export default async function SettingsPage() {
  const row = await getSettings();
  // Every user gets a settings row via handle_new_user (docs/decisions.md §
  // Phase 1), so a missing row is a backfill gap rather than the normal
  // case — the form still works with column defaults, and saving creates
  // nothing new since the update simply matches zero rows... which is why
  // the action targets `user_id`, not an id it can't have yet. Falling back
  // here just keeps the screen from crashing in that edge case.
  const settings = row === null ? FALLBACK_SETTINGS : toSettings(row);

  return <SettingsView settings={settings} />;
}
