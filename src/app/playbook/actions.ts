"use server";

import { revalidatePath } from "next/cache";
import { getModels } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import type { ModelStatus } from "@/lib/domain/types";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * A brand-new model starts empty and active, appended after every existing
 * one (docs/README.md § Playbook: "the dashboard's model breakdown reads its
 * order from here" — new entries go last, not first, since nothing about a
 * model's performance is known yet). Everything else (name, description,
 * rules) is filled in afterward through the same inline editing every other
 * field on this screen uses — there's no separate "create" form to keep in
 * sync with it.
 */
export async function createModel(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  const existing = await getModels();
  const nextSortOrder = existing.reduce((max, m) => Math.max(max, m.sortOrder), -1) + 1;

  const { data, error } = await supabase
    .from("models")
    .insert({
      user_id: user.id,
      name: "New model",
      description: null,
      rules: [],
      status: "active",
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/playbook");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

export interface UpdateModelInput {
  name: string;
  description: string;
  rules: string[];
}

export async function updateModel(id: string, input: UpdateModelInput): Promise<ActionResult> {
  const supabase = await createClient();

  const name = input.name.trim();
  if (name === "") return { ok: false, error: "Name can't be empty." };

  const { error } = await supabase
    .from("models")
    .update({
      name,
      description: input.description.trim() === "" ? null : input.description.trim(),
      rules: input.rules.map((r) => r.trim()).filter((r) => r !== ""),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/playbook");
  revalidatePath("/");
  return { ok: true, id };
}

/**
 * Retiring (or reactivating) a model never touches a single trade row —
 * `offPlan` is computed fresh from each trade's own fields on every read
 * (docs/decisions.md § Phase 2), so a trade logged while a model was active
 * reads exactly the same after that model retires. Only which *future*
 * trades count as off-plan changes, and that happens automatically the next
 * time this model is picked on the trade form.
 */
export async function setModelStatus(id: string, status: ModelStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("models").update({ status }).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/playbook");
  revalidatePath("/");
  return { ok: true, id };
}
