# Cloudflare Workers

The app deploys to Cloudflare Workers through the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare). Vercel
remains supported; the host is detected at runtime, so the same code runs on
both without flags.

## What is host-specific

| Concern | Vercel | Cloudflare Workers |
| --- | --- | --- |
| Entry point | Next.js default | `worker.ts` wraps the generated `.open-next/worker.js` |
| Meta scrape queue | `@vercel/queue` (`vercel.json` trigger) | Cloudflare Queues binding `META_SCRAPES_QUEUE` + `queue()` consumer in `worker.ts` |
| Queue callback auth | Vercel-signed callback | Shared secret `META_SCRAPES_QUEUE_SECRET` (bearer token, checked in the route) |
| Public origin | `VERCEL_URL` | `APP_URL` var (see `src/lib/app-url.ts`) |
| Message dedup | `idempotencyKey` | none — steps are replay-safe and guarded by the scrape row's optimistic lock |
| `maxDuration` | honoured | ignored; Workers limit CPU time, not wall time (`limits.cpu_ms` in `wrangler.jsonc` if needed) |
| Image optimization | built-in | not enabled (no `next/image` usage); add the `images` binding if that changes |
| ISR / `"use cache"` | built-in | none used; add an R2/KV incremental cache in `open-next.config.ts` before introducing it |

Key files: `wrangler.jsonc`, `open-next.config.ts`, `worker.ts`,
`cloudflare-env.d.ts`, `public/_headers`,
`src/lib/meta/scrape-queue.ts` (transport selection),
`src/lib/meta/cloudflare-queue-consumer.ts` (consumer),
`src/app/api/queues/meta-scrapes/route.ts` (handles both transports).

### How the queue works on Workers

1. `enqueueMetaScrape()` sees the `META_SCRAPES_QUEUE` binding via
   `getCloudflareContext()` and calls `queue.send({ scrapeId })`.
2. Cloudflare invokes `worker.ts` → `queue(batch)`. For each message the
   consumer POSTs `{ messageId, attempts, body }` to
   `/api/queues/meta-scrapes` **in-process** (it calls the OpenNext `fetch`
   handler directly, no network hop) with
   `x-meta-scrapes-delivery: cloudflare` and
   `Authorization: Bearer $META_SCRAPES_QUEUE_SECRET`.
3. The route runs one step. `2xx` → `message.ack()`. `503 { retryAfterSeconds }`
   → `message.retry({ delaySeconds })` with the same exponential backoff used
   on Vercel (`src/lib/meta/scrape-retry.ts`). Anything else → retry with the
   fallback backoff.
4. After `META_SCRAPE_MAX_DELIVERY_COUNT` (8) failed deliveries the app records
   the failure and acks. `max_retries` in `wrangler.jsonc` plus the
   `velocityapp-meta-scrapes-dlq` dead-letter queue only catch delivery-level
   failures (e.g. the route itself unreachable).

Under `pnpm dev` the local producer binding exists but no consumer runs, so
`enqueueMetaScrape()` throws and the scrape is processed inline (same fallback
as before). Use `pnpm cf:preview` to exercise the real queue locally.

## Prerequisites

- **Workers Paid plan.** The compressed worker is ≈3.5 MiB, above the 3 MiB
  free-plan limit (paid: 10 MiB). Almost all of it is Next.js itself.
- Node 24 + pnpm (see `mise.toml`); `wrangler` and `@opennextjs/cloudflare`
  are already in `package.json`.
- Cloudflare login: `pnpm exec wrangler login`.

## One-time setup

1. **Create the queues**

   ```sh
   pnpm exec wrangler queues create velocityapp-meta-scrapes
   pnpm exec wrangler queues create velocityapp-meta-scrapes-dlq
   ```

2. **Set the public origin.** Edit `vars.APP_URL` in `wrangler.jsonc` to the
   URL users will hit (custom domain or `https://velocityapp.<account>.workers.dev`).
   It feeds `metadataBase` and the Apify webhook URL. For a custom domain add
   `"routes": [{ "pattern": "app.example.com", "custom_domain": true }]`.

3. **Runtime variables and secrets.** Non-secret values can go in
   `wrangler.jsonc` → `vars`; everything else via `wrangler secret put`:

   ```sh
   for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
     SUPABASE_SERVICE_ROLE_KEY APIFY_API_TOKEN APIFY_WEBHOOK_SECRET \
     META_FACEBOOK_APP_ID META_FACEBOOK_APP_SECRET META_INSTAGRAM_APP_ID \
     META_INSTAGRAM_APP_SECRET META_TOKEN_ENCRYPTION_KEY META_OAUTH_STATE_SECRET \
     META_GRAPH_API_VERSION NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST \
     META_SCRAPES_QUEUE_SECRET; do
     pnpm exec wrangler secret put "$name"
   done
   ```

   `META_SCRAPES_QUEUE_SECRET` is new for Workers: `openssl rand -base64 32`.
   (Bulk alternative: `pnpm exec wrangler secret bulk secrets.json` with a
   `{ "NAME": "value" }` file you do not commit.)

   Two build-time caveats:

   - `NEXT_PUBLIC_*` values are inlined into client bundles by `next build`, so
     they must also be present in the environment that runs `pnpm cf:deploy`
     (`.env.production` or `.env.local`).
   - OpenNext compiles every `.env*` file it finds into the worker as runtime
     **fallbacks** (Worker vars/secrets win). Build from a machine/CI job whose
     `.env.local` does not point at local Supabase, or make sure every runtime
     value is set as a Worker var/secret.

4. **Third-party callbacks.** Register the new origin where the old one was:
   Supabase Auth `site_url` / `additional_redirect_urls`
   (`supabase/config.toml`, pushed by CI), the Meta app's OAuth redirect URIs
   (`<APP_URL>/api/meta/oauth/<provider>/callback`), and Apify (webhook URL is
   derived from `APP_URL`, or set `APIFY_WEBHOOK_URL` explicitly).

## Deploy

```sh
pnpm cf:deploy          # opennextjs-cloudflare build && deploy
pnpm cf:upload          # build + upload a new version without routing traffic
```

Preview a production build locally in the Workers runtime (Miniflare, local
queue with a working consumer):

```sh
cp .dev.vars.example .dev.vars   # fill META_SCRAPES_QUEUE_SECRET, APP_URL=http://localhost:8787
pnpm cf:preview                  # http://localhost:8787
```

`pnpm dev` is unchanged; `next.config.ts` calls `initOpenNextCloudflareForDev()`
so `getCloudflareContext()` also works there.

### CI

Add a job after the test job, e.g.

```yaml
- run: pnpm cf:deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
```

Or connect the repo in the Cloudflare dashboard (Workers Builds) with build
command `pnpm cf:build` and deploy command `pnpm exec wrangler deploy`.

## Known limitations

- The adapter prints `Node.js middleware support is experimental` for
  `src/proxy.ts`. It works (verified: unauthenticated requests redirect to
  `/auth/login` in `wrangler dev`), but watch OpenNext release notes.
- `wrangler types` is not used: the global `@cloudflare/workers-types`
  conflict with the DOM lib the app compiles against, so bindings are typed by
  hand in `cloudflare-env.d.ts`. Update it when `wrangler.jsonc` changes.
- Cloudflare Queues deliver at-least-once with no idempotency keys; a
  duplicate delivery re-runs one replay-safe step.
