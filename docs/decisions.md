# Decisions

One line per decision made where the spec was silent, ambiguous, or (rarely) contradicted itself. Newest at the bottom, grouped by phase.

## Phase 0

- **Repo location.** The session's shell started in `/Users/seungmin` (the whole home directory, already an empty untracked git repo — not something to build into) and later in `/Users/seungmin/Documents/trading-journal`, an existing, unrelated trading-journal app (Prisma/Express/Docker) that `docs/build-prompt.md` §0 explicitly says not to reference or reuse. Created a fresh repo at `/Users/seungmin/Documents/min-journal` instead. **Flag for the user:** say if a different location/name was intended.
- **`docs/` folder name.** The handed-off bundle's docs folder was named `docs:` (a colon, not a slash) on disk — an extraction artifact, not a spec choice. Copied its contents into `docs/` (no colon) in the new repo.
- **Storage architecture — README vs. build prompt.** `docs/README.md` (Overview, and "State Management" → Storage) recommends a local-first SPA persisting to IndexedDB, explicitly out of scope for sync in v1. `docs/build-prompt.md` §2 locks in Next.js 15 + Supabase (Postgres + Auth + Storage) and marks that stack "변경 금지" (do not change). Followed the build prompt: README's own wording frames its storage suggestion as a fallback ("if no codebase exists yet, pick the framework most appropriate... local-first is a reasonable default"), not a hard requirement, and the build prompt is the more specific, later, deliberate instruction. Everything else in README (screens, copy, tokens, entity shapes) still governs.
- **Next.js version.** `create-next-app@latest` scaffolds Next 16 today; pinned `next` and `eslint-config-next` to `15.5.25` (latest stable 15.x) to match the locked spec.
- **ESLint flat-config bridge.** `eslint-config-next@15.x` still ships the legacy eslintrc format (its native flat-config export ships in v16), so `eslint.config.mjs` bridges it with `@eslint/eslintrc`'s `FlatCompat`, loaded via `createRequire` (Next's internal lint step doesn't reliably follow the package's ESM `exports` condition). Routine compatibility plumbing, not a design decision — noted here in case it looks surprising in review.
- **Pretendard delivery.** Self-hosted the **variable** font file (`pretendard/dist/web/variable/pretendardvariable.css`, ~2MB, one file covering the full weight axis) rather than four separate static weight files (~3MB combined for 500/600/700/800). Same visual result, smaller download.
- **Western P&L convention colors.** `docs/README.md` deliberately leaves these unspecified ("expose the convention as a setting... rather than hardcoding" — no hex given). Chose gain `#22c55e` / loss `#f04452` (reusing the existing KR-gain red for the western loss role, since western loss=red is the same hue already in the palette). Both pairs live behind CSS variables (`--pnl-gain` / `--pnl-loss`, swapped by `[data-pnl="west"]` on `<html>`), so this is a one-line change if the user has a different pair in mind.
- **Tailwind theme keys for half-step sizes.** CSS custom-property names can't contain a bare `.`, so the type scale's half-steps (11.5, 12.5, …) are keyed as `--text-11_5` etc., producing utility classes like `text-11_5`. Verified these actually emit CSS (not just silently dropped) via the production build output.

## Open items to resolve before Phase 4 (New trade / Trade detail)

Not blocking Phase 0–3, but flagged now rather than guessed silently later:

- **`Trade.confirmation`.** Present in both `docs/README.md`'s entity list and the build prompt's SQL skeleton, but no screen spec (New trade form, Trade detail) shows a control or display for it. Need to know what it represents (e.g. a confirmation-type select — MSS / FVG / OB / other) and where it belongs in the 4-section CRT form before building the form.
- **HTF pairing options.** Spec'd as a `select`, but only one example value appears anywhere ("H4 → M15"). Will need the actual option list, or will propose one from common CRT HTF/LTF pairings and log it here if no direction is given.
- **Instrument field.** Not specified as free text vs. a fixed/select list. Default plan: free text with autocomplete from previously logged instruments (single-user journal, open instrument set) — will log here as a decision at Phase 4 unless told otherwise.
