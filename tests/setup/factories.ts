import type { PoolClient } from "pg";

let seq = 0;

export async function insertAuthUser(
  client: PoolClient,
  opts: { email?: string; meta?: Record<string, unknown> } = {},
): Promise<{ id: string; email: string }> {
  seq += 1;
  const email = opts.email ?? `test-user-${seq}@example.com`;
  const meta = JSON.stringify(opts.meta ?? {});
  const { rows } = await client.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, $2::jsonb) returning id, email`,
    [email, meta],
  );
  return rows[0] as { id: string; email: string };
}

/**
 * Inserts an allowlist row. Email is stored lowercase by trigger.
 */
export async function insertAuthorizedUser(
  client: PoolClient,
  opts: { email: string; userId?: string | null },
): Promise<{ id: string; email: string; userId: string | null }> {
  const { rows } = await client.query(
    `insert into public.authorized_users (email, user_id)
     values ($1, $2)
     returning id, email, user_id as "userId"`,
    [opts.email, opts.userId ?? null],
  );

  return rows[0] as { id: string; email: string; userId: string | null };
}
