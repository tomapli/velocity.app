import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext adapter config for Cloudflare Workers.
 *
 * The app has no ISR / `"use cache"` routes today, so no incremental-cache
 * binding is configured. When caching is introduced, add an R2 or KV
 * incremental cache here (see https://opennext.js.org/cloudflare/caching).
 */
export default defineCloudflareConfig({});
