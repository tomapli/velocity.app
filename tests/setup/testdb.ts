import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BOOTSTRAP_SQL = join(REPO_ROOT, "tests", "setup", "bootstrap.sql");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");

let container: StartedPostgreSqlContainer | undefined;
let pool: Pool | undefined;

/**
 * Applies every `supabase/migrations/*.sql` file in filename order.
 * Failures surface as `Migration failed: <file>` so missing bootstrap objects
 * are easy to spot.
 */
async function applyMigrations(connectionString: string): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const client = new Pool({ connectionString });

  try {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

      try {
        await client.query(sql);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration failed: ${file}\n${message}`);
      }
    }
  } finally {
    await client.end();
  }
}

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:16").start();
  const connectionString = container.getConnectionUri();
  process.env.TEST_DATABASE_URL = connectionString;
  process.env.DATABASE_URL = connectionString;

  const admin = new Pool({ connectionString });
  try {
    await admin.query(readFileSync(BOOTSTRAP_SQL, "utf8"));
  } finally {
    await admin.end();
  }

  await applyMigrations(connectionString);

  const grants = new Pool({ connectionString });
  try {
    await grants.query(`
      grant all privileges on all tables in schema public to anon, authenticated, service_role;
      grant all privileges on all sequences in schema public to anon, authenticated, service_role;
      revoke all on table public.authorized_users from anon, authenticated, public;
    `);
  } finally {
    await grants.end();
  }
}

export async function teardown(): Promise<void> {
  await pool?.end();
  await container?.stop();
}

export function getPool(): Pool {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL not set -- is the integration globalSetup running?");
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  }
  return pool;
}
