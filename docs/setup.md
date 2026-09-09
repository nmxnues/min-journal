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

## 2. Link the Supabase CLI (for migrations + type generation)
The CLI is a project devDependency (`pnpm supabase ...`).

```bash
pnpm supabase login
pnpm supabase link --project-ref <your-project-ref>   # ref is in the project URL / dashboard
```

## 3. Run migrations
Migrations live in `supabase/migrations/*.sql` (added in Phase 1).

```bash
pnpm supabase db push
```

## 4. Generate types
Regenerate `src/lib/database.types.ts` after any schema change:

```bash
pnpm supabase gen types typescript --linked > src/lib/database.types.ts
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
