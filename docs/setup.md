# Setup

## Prerequisites
- Node.js 24.x, pnpm (`corepack enable` or `brew install pnpm`)
- A Supabase account (https://supabase.com)

## 1. Create the Supabase project
1. In the Supabase dashboard, create a new project (any region; note the DB password somewhere safe — it's only needed for direct Postgres access, not for the app).
2. Go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never shipped to the browser)
3. Copy `.env.example` to `.env.local` and fill in the three values.

## 2. Get the database password
Settings → Database → **Database password** (reset it if you don't have it — this is separate from the anon/service-role keys above, needed only for the CLI's direct Postgres access, never read by the app itself). Add it to `.env.local` as `SUPABASE_DB_PASSWORD`.

## 3. Run migrations
Migrations live in `supabase/migrations/*.sql`. The CLI is a project devDependency (`pnpm exec supabase ...`). `supabase login`/`link` need a personal access token we don't have set up, so push straight to a connection URL instead — the regional **pooler** host (not `db.<ref>.supabase.co` directly) is what actually works from most networks, since the direct host is IPv6-only:

```bash
set -a; source .env.local; set +a
REF=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | sed -E 's#.*https://([a-z0-9]+)\.supabase\.co.*#\1#')
ENC_PW=$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe=''))")
DB_URL="postgresql://postgres.${REF}:${ENC_PW}@aws-0-<region>.pooler.supabase.com:5432/postgres"

pnpm exec supabase db push --db-url "$DB_URL" --dry-run   # preview first
pnpm exec supabase db push --db-url "$DB_URL" --yes
```

`<region>` matches your project's region (e.g. `ap-northeast-2` for Seoul) — same value visible in the pooler connection string on the Database settings page.

## 4. Generate types
Regenerate `src/lib/database.types.ts` after any schema change, using the same `DB_URL`:

```bash
pnpm exec supabase gen types typescript --db-url "$DB_URL" > src/lib/database.types.ts
```

## 5. Create the single user account
This app has no sign-up UI by design (single-user). Create the account by hand:
1. Supabase dashboard → **Authentication → Users → Add user**.
2. Enter an email + password (this becomes the login for `/login`).
3. No further setup needed — every table's RLS policy scopes to `auth.uid()`, and the app assumes exactly one user.

## 6. Run the app

```bash
pnpm install
pnpm dev
```

## Deploying to Vercel

Nothing in `next.config.ts` or the build needs Vercel-specific setup — it's a plain Next.js 15 App Router project (`pnpm build` / `pnpm start`), and `package.json`'s `packageManager: "pnpm@12.3.4"` field is enough for Vercel to pick the right pnpm version on its own. What follows is what actually differs from a stock "import and deploy" flow.

### 1. Import the repository
Vercel dashboard → **Add New → Project** → import `nmxnues/min-journal` from GitHub. Framework Preset auto-detects as Next.js; leave Build/Output/Install commands on their defaults (`pnpm build`, `pnpm install`).

### 2. Set the environment variables
Project Settings → **Environment Variables**. Add exactly the three the app actually reads at runtime — the same three in `.env.local`:

| Name | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase → Settings → API | public, ships to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase → Settings → API | public, ships to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API | **mark it Sensitive** — server-only, full-bypass-RLS access |

Apply all three to **Production**, **Preview**, and **Development** environments (a Preview deploy on a branch still needs to reach the same Supabase project — there's no separate staging database in this setup).

**Do not add `SUPABASE_DB_PASSWORD`.** It exists only for this doc's own `supabase db push`/`gen types` commands run from a developer's machine (§3–4 above); the deployed app never opens a direct Postgres connection and never reads that variable. Adding it to Vercel would just be a real Postgres credential sitting in a platform that has no use for it.

### 3. Push migrations before the deploy that needs them
Vercel's build does **not** run `supabase db push` — a deploy that ships code expecting a column/table a migration adds will break against a database that doesn't have it yet. Whenever `supabase/migrations/` has new files, run §3's push (and, if `database.types.ts` changed, §4's `gen types`, committed alongside) **before or during the same change** that deploys code depending on them — not after. For a schema change with no code depending on it yet, order doesn't matter; for one a deploy needs, push first.

### 4. Deploy
Push to `main` (or open a PR — Vercel deploys every branch as a Preview automatically once the project is imported). No manual trigger needed beyond the git push itself.

### 5. Supabase Auth — Site URL (optional)
This app has no email confirmation, magic links, or OAuth — just email+password against `/login` — so Supabase's **Authentication → URL Configuration → Site URL** doesn't gate login itself. Still worth setting to the production Vercel URL (`https://<project>.vercel.app` or a custom domain) once one exists, since Supabase uses it as the default redirect target for any auth email templates, even ones this app doesn't currently trigger.

### 6. Custom domain (optional)
Project Settings → **Domains**. Not required — the `*.vercel.app` domain Vercel assigns on import works as-is for a single-user app.

### Post-deploy checklist
- `/login` loads and is served over HTTPS (Vercel does this by default).
- Sign in with the account created in §5. A wrong/no session correctly bounces to `/login` (`middleware.ts`); a signed-in visit to `/login` bounces back to `/`.
- Open dev tools → Application → Manifest on the deployed URL: confirms `/manifest.webmanifest` and both icon sizes (`/icon-192.png`, `/icon-512.png`) resolve without a redirect (they're excluded from the auth middleware — see `src/middleware.ts` — precisely so this works logged out too). On a phone, "Add to Home Screen" should show the app's own icon and open without browser chrome.
- Log one real trade end to end, including an attachment upload, to confirm Supabase Storage's bucket/policies are reachable from the deployed domain (not just `localhost`).

## Optional: local Supabase stack (no cloud project needed)
For offline schema work, `supabase start` runs the full stack (Postgres, Auth, Storage, Studio) in Docker and applies every migration in `supabase/migrations/` automatically:

```bash
pnpm exec supabase start   # prints local API URL + anon/service keys
pnpm exec supabase stop    # when done
```

Point `.env.local` at the printed local `API_URL` / anon key instead of the cloud project to develop against it. This was used once during Phase 1 to confirm all four migrations apply cleanly (schema, RLS, auth trigger, storage bucket) before handing them off — it's not required for normal development against the cloud project.
