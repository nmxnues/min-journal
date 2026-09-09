"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, Field, Input } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { login } from "./actions";
import { createLoginSchema, type LoginInput } from "./schema";

// No mockup exists for /login (docs/README.md § Routes lists it with none).
// Built from the shared primitives so it stays in step with the rest of the
// design system.
export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const locale = useLocale();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(createLoginSchema(locale)),
  });

  function onSubmit(values: LoginInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await login(values, next);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-16">
      <Field label={t({ en: "Email", ko: "이메일" })} htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>

      <Field
        label={t({ en: "Password", ko: "비밀번호" })}
        htmlFor="password"
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
      </Field>

      {serverError !== null && <p className="text-13 font-semibold text-loss">{serverError}</p>}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending
          ? t({ en: "Logging in…", ko: "로그인하는 중…" })
          : t({ en: "Log in", ko: "로그인" })}
      </Button>
    </form>
  );
}
