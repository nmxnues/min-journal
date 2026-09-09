"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { login } from "./actions";
import { loginSchema, type LoginInput } from "./schema";

// No mockup exists for /login (docs/README.md § Routes lists it with none).
// Built from the same token vocabulary as the rest of the app; plain
// Tailwind + tokens for now rather than the Button/Input primitives, which
// land in Phase 3 — this gets a pass to consume them once those exist.
export function LoginForm({ next }: { next?: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
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
      <div>
        <label htmlFor="email" className="mb-8 block text-13 font-semibold text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-14 bg-divider px-16 py-14 text-15 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          {...register("email")}
        />
        {errors.email && <p className="mt-6 text-11_5 text-loss">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-8 block text-13 font-semibold text-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-14 bg-divider px-16 py-14 text-15 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          {...register("password")}
        />
        {errors.password && <p className="mt-6 text-11_5 text-loss">{errors.password.message}</p>}
      </div>

      {serverError && <p className="text-13 font-semibold text-loss">{serverError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-12 bg-accent py-17 text-16 font-bold text-white transition-colors hover:bg-accent-pressed disabled:opacity-40"
      >
        {isPending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
