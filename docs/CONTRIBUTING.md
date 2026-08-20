# Contributing

Make sure the project can run without extra environment variables, so a new clone can start with `pnpm install` and `pnpm dev`. If a variable is required, add it to `.env.example` when it is not sensitive, and add it to `scripts/package-json-helpers/required-dev-env.js` so `ensure-env` can prompt for it.

# Database

Schema source of truth is `db/schema/*.ts` (Drizzle). The app talks to Postgres only through `supabase-js` (RLS). There are no Drizzle-generated migrations in this template; realtime SQL is the first hand-authored file in `supabase/migrations/`.

## Tables, columns, enums, indexes, RLS

1. Edit `db/schema/`
2. Apply locally:

```bash
pnpm db:push
```

When you want a versioned migration (for preview/production), generate and apply it:

```bash
pnpm db:migrate
```

If Drizzle asks whether something is a rename but you changed the type, answer no.

```bash
pnpm db:force-migrate  # Wipes local data, then generate + reset
```

## Functions and triggers

Drizzle cannot model these. Put them in `supabase/migrations/` as the first hand-authored SQL file (timestamp before the Drizzle baseline). `pnpm db:push` reapplies that file after pushing tables.

```bash
pnpm db:generate:custom
# edit the empty migration
pnpm db:up
```

# Tests

```bash
pnpm test            # unit + component
pnpm test:watch
pnpm test:integration  # Testcontainers; does not touch the local Supabase DB
pnpm test:e2e          # needs a built app (`pnpm build`) and local Supabase
```

Full guide: [Testing](runbooks/testing.md)

# Wiki

Start the VitePress docs site with:

```bash
pnpm wiki
```

It currently includes [Testing](runbooks/testing.md) and this contributing guide. Check local links while it is running:

```bash
pnpm wiki:doctor
```

# Supabase

Develop against local Supabase. Studio is at http://localhost:54323. Mailpit (outbound auth email) is at http://localhost:54324.

Cursor MCP for the local project is useful: open Studio and use the connection button at the top.
