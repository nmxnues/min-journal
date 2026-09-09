import { z } from "zod";
import type { Locale } from "@/lib/i18n/locale";

const MESSAGES = {
  email: { en: "Enter your email.", ko: "이메일을 입력하세요." },
  emailInvalid: { en: "Enter a valid email address.", ko: "올바른 이메일 주소를 입력하세요." },
  password: { en: "Enter your password.", ko: "비밀번호를 입력하세요." },
} as const;

/**
 * The client (LoginForm) builds this per the viewport locale, so validation
 * errors read in the same language as the rest of the screen. The server
 * action re-validates too (defense in depth against a bypassed client), but
 * has no viewport to read — it always uses the English default, since that
 * path only surfaces if JS is disabled or the request was malformed.
 */
export function createLoginSchema(locale: Locale = "en") {
  return z.object({
    email: z.string().min(1, MESSAGES.email[locale]).email(MESSAGES.emailInvalid[locale]),
    password: z.string().min(1, MESSAGES.password[locale]),
  });
}

export const loginSchema = createLoginSchema();

export type LoginInput = z.infer<typeof loginSchema>;
