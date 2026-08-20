import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const REALTIME_SQL_PATH = join(
  ROOT,
  "supabase/migrations/20260612193000_realtime.sql",
);

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Applies the first (pre-baseline) realtime migration. Safe to run before
 * `public.items` exists; grants and the broadcast trigger attach once it does.
 * @param {string} databaseUrl
 */
export const applyRealtimeSql = async (databaseUrl) => {
  const sql = readFileSync(REALTIME_SQL_PATH, "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    await client.query(sql);
    await client.query("notify pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
};

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DB_URL ??
    DEFAULT_DATABASE_URL;

  applyRealtimeSql(databaseUrl)
    .then(() => {
      console.log("Applied realtime SQL");
    })
    .catch((error) => {
      console.error(
        "Failed to apply realtime SQL:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    });
}
