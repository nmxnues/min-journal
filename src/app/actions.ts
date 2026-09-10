"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Single-user app, but a way to end the session was still missing (no
 * Settings screen yet — that's Phase 9). Needed sooner than planned: without
 * it, verifying anything with a disposable test user meant fighting whatever
 * session was already sitting in the browser, with no way to clear it short
 * of clearing cookies by hand.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
