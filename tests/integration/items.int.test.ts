import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { insertAuthUser } from "@/tests/setup/factories";
import { asAnon, asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

async function insertItem(client: PoolClient, createdBy: string, title: string) {
  const { rows } = await client.query(
    `insert into public.items (title, created_by)
     values ($1, $2)
     returning id`,
    [title, createdBy],
  );
  return rows[0].id as string;
}

describe("items RLS", () => {
  it("lets an authenticated user insert a row they own", async () => {
    await withRollback(async (client) => {
      const auth = await insertAuthUser(client);
      await asClaims(client, { sub: auth.id });
      await insertItem(client, auth.id, "Notebook");
      const { rows } = await client.query(
        "select count(*)::int as cnt from public.items",
      );
      expect(rows[0].cnt).toBe(1);
    });
  });

  it("rejects inserting a row owned by someone else", async () => {
    await withRollback(async (client) => {
      const owner = await insertAuthUser(client);
      const other = await insertAuthUser(client);
      await asClaims(client, { sub: other.id });
      await expect(insertItem(client, owner.id, "Stolen")).rejects.toThrow();
    });
  });

  it("lets any authenticated user delete any row", async () => {
    await withRollback(async (client) => {
      const owner = await insertAuthUser(client);
      const other = await insertAuthUser(client);
      await asClaims(client, { sub: owner.id });
      const id = await insertItem(client, owner.id, "Shared");
      await asClaims(client, { sub: other.id });
      await client.query("delete from public.items where id = $1", [id]);
      const { rows } = await client.query(
        "select count(*)::int as cnt from public.items",
      );
      expect(rows[0].cnt).toBe(0);
    });
  });

  it("hides all rows from anonymous visitors", async () => {
    await withRollback(async (client) => {
      const owner = await insertAuthUser(client);
      await asClaims(client, { sub: owner.id });
      await insertItem(client, owner.id, "Secret");
      await asAnon(client);
      const { rows } = await client.query(
        "select count(*)::int as cnt from public.items",
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});
