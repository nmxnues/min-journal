# Min Journal

A single-user trading journal built around CRT (Candle Range Theory). See `docs/README.md` for the full design/behavior handoff (single source of truth for copy, colors, spacing) and `docs/build-prompt.md` for the build plan this codebase follows phase by phase.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage) · Vitest.

## Getting started
See `docs/setup.md` for creating the Supabase project, env vars, and the one-time manual account creation.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest
pnpm build
pnpm lint
```

## Project docs
- `docs/README.md` — screen-by-screen spec, design tokens, data model (primary source of truth)
- `docs/design-canvas.html` — the ten high-fidelity mockups (open in a browser; `docs/support.js` is its renderer, not app code)
- `docs/build-prompt.md` — the phased build plan
- `docs/setup.md` — environment and Supabase setup
- `docs/decisions.md` — decisions made where the spec was silent or ambiguous
