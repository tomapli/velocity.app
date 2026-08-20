import { describe, expect, it } from "vitest";

import { insertAuthUser, insertAuthorizedUser } from "@/tests/setup/factories";
import { asAnon, asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const UNAUTHORIZED_SIGNUP_EMAIL = "stranger@example.com";
const AUTHORIZED_SIGNUP_EMAIL = "allowed@example.com";

function hookEvent(email: string) {
  return {
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      email,
    },
  };
}

describe("authorized_users", () => {
  describe("RLS", () => {
    it("hides rows from anonymous visitors", async () => {
      await withRollback(async (client) => {
        await insertAuthorizedUser(client, { email: AUTHORIZED_SIGNUP_EMAIL });
        await asAnon(client);
        await expect(
          client.query("select count(*)::int as cnt from public.authorized_users"),
        ).rejects.toThrow(/permission denied/);
      });
    });

    it("hides rows from authenticated users", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await insertAuthorizedUser(client, { email: AUTHORIZED_SIGNUP_EMAIL });
        await asClaims(client, { sub: auth.id });
        await expect(
          client.query("select count(*)::int as cnt from public.authorized_users"),
        ).rejects.toThrow(/permission denied/);
      });
    });
  });

  describe("email normalization", () => {
    it("stores emails in lowercase", async () => {
      await withRollback(async (client) => {
        const row = await insertAuthorizedUser(client, {
          email: "  Allowed@Example.COM  ",
        });
        expect(row.email).toBe("allowed@example.com");
      });
    });
  });

  describe("before_user_created_hook", () => {
    it("rejects signups whose email is not on the allowlist", async () => {
      await withRollback(async (client) => {
        const { rows } = await client.query(
          "select public.before_user_created_hook($1::jsonb) as result",
          [JSON.stringify(hookEvent(UNAUTHORIZED_SIGNUP_EMAIL))],
        );

        expect(rows[0].result).toEqual({
          error: {
            message: "This email is not authorized to access the app.",
            http_code: 403,
          },
        });
      });
    });

    it("rejects signups with a missing email", async () => {
      await withRollback(async (client) => {
        const { rows } = await client.query(
          "select public.before_user_created_hook($1::jsonb) as result",
          [JSON.stringify(hookEvent(""))],
        );

        expect(rows[0].result).toEqual({
          error: {
            message: "An email address is required to sign up.",
            http_code: 400,
          },
        });
      });
    });

    it("allows signups whose email is on the allowlist, ignoring case", async () => {
      await withRollback(async (client) => {
        await insertAuthorizedUser(client, { email: AUTHORIZED_SIGNUP_EMAIL });
        const { rows } = await client.query(
          "select public.before_user_created_hook($1::jsonb) as result",
          [JSON.stringify(hookEvent("Allowed@Example.com"))],
        );

        expect(rows[0].result).toEqual({});
      });
    });
  });

  describe("link to auth.users", () => {
    it("sets user_id when a matching auth user is created", async () => {
      await withRollback(async (client) => {
        const authorized = await insertAuthorizedUser(client, {
          email: AUTHORIZED_SIGNUP_EMAIL,
        });
        expect(authorized.userId).toBeNull();

        const auth = await insertAuthUser(client, {
          email: AUTHORIZED_SIGNUP_EMAIL,
        });
        const { rows } = await client.query(
          `select user_id as "userId"
           from public.authorized_users
           where id = $1`,
          [authorized.id],
        );

        expect(rows[0].userId).toBe(auth.id);
      });
    });

    it("sets user_id when an existing auth user is added to the allowlist", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client, {
          email: AUTHORIZED_SIGNUP_EMAIL,
        });
        const authorized = await insertAuthorizedUser(client, {
          email: AUTHORIZED_SIGNUP_EMAIL,
        });

        expect(authorized.userId).toBe(auth.id);
      });
    });

    it("clears user_id when the auth user is deleted", async () => {
      await withRollback(async (client) => {
        await insertAuthorizedUser(client, { email: AUTHORIZED_SIGNUP_EMAIL });
        const auth = await insertAuthUser(client, {
          email: AUTHORIZED_SIGNUP_EMAIL,
        });

        await client.query("delete from auth.users where id = $1", [auth.id]);

        const { rows } = await client.query(
          `select user_id as "userId"
           from public.authorized_users
           where email = $1`,
          [AUTHORIZED_SIGNUP_EMAIL],
        );

        expect(rows[0].userId).toBeNull();
      });
    });
  });
});
