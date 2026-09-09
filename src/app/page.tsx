import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-16 bg-page px-32 text-center">
      <div>
        <p className="text-14 font-semibold text-muted">Min Journal</p>
        <h1 className="mt-6 text-30 font-extrabold tracking-[-.03em] text-ink">
          Phase 0 foundation
        </h1>
        <p className="mt-8 text-14 text-secondary">
          Screens land in later phases.{" "}
          <Link href="/dev/tokens" className="font-semibold text-accent hover:text-accent-pressed">
            View design tokens →
          </Link>
        </p>
      </div>
    </main>
  );
}
