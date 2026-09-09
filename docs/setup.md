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

## Deploying
Deploy to Vercel; add the same three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in the Vercel project settings.

## Optional: local Supabase stack (no cloud project needed)
For offline schema work, `supabase start` runs the full stack (Postgres, Auth, Storage, Studio) in Docker and applies every migration in `supabase/migrations/` automatically:

```bash
pnpm exec supabase start   # prints local API URL + anon/service keys
pnpm exec supabase stop    # when done
```

Point `.env.local` at the printed local `API_URL` / anon key instead of the cloud project to develop against it. This was used once during Phase 1 to confirm all four migrations apply cleanly (schema, RLS, auth trigger, storage bucket) before handing them off — it's not required for normal development against the cloud project.
