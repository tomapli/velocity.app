import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BOOTSTRAP_SQL = join(REPO_ROOT, "tests", "setup", "bootstrap.sql");

let container: StartedPostgreSqlContainer | undefined;
let pool: Pool | undefined;

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

  execFileSync("pnpm", ["db:push"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
    },
  });

  const grants = new Pool({ connectionString });
  try {
    await grants.query(`
      grant all privileges on all tables in schema public to anon, authenticated, service_role;
      grant all privileges on all sequences in schema public to anon, authenticated, service_role;
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
