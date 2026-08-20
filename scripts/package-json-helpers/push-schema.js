import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyRealtimeSql } from "./apply-realtime.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.SUPABASE_DB_URL ??
  DEFAULT_DATABASE_URL;

/**
 * Pushes `db/schema/*.ts` to the target Postgres, then reapplies the first
 * realtime migration so grants and the items broadcast trigger attach.
 */
const main = async () => {
  execFileSync("pnpm", ["exec", "drizzle-kit", "push", "--force"], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  await applyRealtimeSql(databaseUrl);

  console.log("Pushed Drizzle schema and applied realtime SQL");
};

main().catch((error) => {
  console.error(
    "Failed to push schema:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
