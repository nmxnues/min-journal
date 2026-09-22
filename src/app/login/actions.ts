"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "./schema";
import { tr } from "@/lib/i18n/server-locale";

// A "use server" module may only export async functions (server actions) —
// loginSchema/LoginInput live in ./schema so the client component can import
// the real zod object instead of whatever the server-action compiler does
// with a non-function export from this file.
export async function login(values: LoginInput, next?: string) {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? await tr({ en: "Invalid input.", ko: "입력값이 올바르지 않습니다." }) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: await tr({ en: "Incorrect email or password.", ko: "이메일 또는 비밀번호가 올바르지 않습니다." }) };
  }

  redirect(next && next.startsWith("/") && next !== "/login" ? next : "/");
}
