# Integration Schema

This folder contains SQL files to bootstrap the integration Supabase project
(`tmtspymjfnemygpquyhw`) from a blank slate to a schema that matches production
(`qsihlcmjjwarxrnmmsse`).

## Why this folder exists

The project's migration files in `supabase/migrations/` assume the original
pre-migration base tables already exist (they were created before migrations
were tracked). A fresh Supabase project has none of those tables, so the
migrations cannot be applied directly.

This folder provides:

1. `00_base_schema.sql` — Creates the original base tables exactly as they
   existed before any migration was applied.
2. `01_apply_all_migrations.sql` — Applies every migration from
   `supabase/migrations/` in order.

## How to apply

### Option A — via Supabase SQL Editor (recommended)

1. Open the Supabase dashboard for the integration project
   (https://supabase.com/dashboard/project/tmtspymjfnemygpquyhw).
2. Navigate to SQL Editor.
3. Paste and run `00_base_schema.sql` first.
4. Paste and run `01_apply_all_migrations.sql` second.

### Option B — via `supabase db push` (requires Docker)

If Docker is running:

```bash
supabase link --project-ref tmtspymjfnemygpquyhw
supabase db push
```

This will apply only the tracked migrations in `supabase/migrations/` — it
does NOT apply `00_base_schema.sql` automatically. Use Option A to bootstrap
first, then switch back to the production project link.

## After bootstrapping

Run the integration tests:

```bash
set -a && source .env.integration.local && set +a
npm run test:integration
```
