import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in · Min Journal",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center bg-page px-16">
      <div className="w-full max-w-[380px] rounded-24 bg-surface p-32">
        <p className="text-17 font-extrabold tracking-[-.03em] text-ink">Min Journal</p>
        <p className="mt-6 mb-32 text-13_5 text-secondary">Log in to continue.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
