import { describe, expect, it } from "vitest";

import { insertAuthUser, insertAuthorizedUser } from "@/tests/setup/factories";
import { asAnon, asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const AUTHORIZED_EMAIL = "allowed@example.com";
const GOOGLE_PICTURE = "https://lh3.googleusercontent.com/a/example-photo";

describe("ig_scrapes", () => {
  describe("RLS", () => {
    it("hides rows from anonymous visitors", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });
        await client.query(
          `insert into public.ig_scrapes (ig_username, started_by)
           values ($1, $2)`,
          ["example", auth.id],
        );
        await asAnon(client);
        await expect(
          client.query("select count(*)::int as cnt from public.ig_scrapes"),
        ).rejects.toThrow(/permission denied/);
      });
    });

    it("lets authenticated users insert their own scrapes", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        const { rows } = await client.query(
          `insert into public.ig_scrapes (ig_username, started_by)
           values ($1, $2)
           returning ig_username as "igUsername", started_by as "startedBy"`,
          ["example", auth.id],
        );

        expect(rows[0]).toEqual({
          igUsername: "example",
          startedBy: auth.id,
        });
      });
    });

    it("rejects inserts where started_by does not match auth uid", async () => {
      await withRollback(async (client) => {
        const owner = await insertAuthUser(client);
        const other = await insertAuthUser(client);
        await asClaims(client, { sub: owner.id });

        await expect(
          client.query(
            `insert into public.ig_scrapes (ig_username, started_by)
             values ($1, $2)`,
            ["example", other.id],
          ),
        ).rejects.toThrow(/permission denied|violates row-level security/);
      });
    });
  });

  describe("constraints", () => {
    it("stores apify_run_id when the actor is started", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        const { rows } = await client.query(
          `insert into public.ig_scrapes (ig_username, started_by, apify_run_id, apify_called_at)
           values ($1, $2, $3, now())
           returning apify_run_id as "apifyRunId"`,
          ["example", auth.id, "sxfSOvMdx4kXZjQ0r"],
        );

        expect(rows[0].apifyRunId).toBe("sxfSOvMdx4kXZjQ0r");
      });
    });

    it("rejects duplicate apify_run_id values", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        await client.query(
          `insert into public.ig_scrapes (ig_username, started_by, apify_run_id)
           values ($1, $2, $3)`,
          ["example", auth.id, "sxfSOvMdx4kXZjQ0r"],
        );

        await expect(
          client.query(
            `insert into public.ig_scrapes (ig_username, started_by, apify_run_id)
             values ($1, $2, $3)`,
            ["otheruser", auth.id, "sxfSOvMdx4kXZjQ0r"],
          ),
        ).rejects.toThrow(/ig_scrapes_apify_run_id_key/);
      });
    });

    it("rejects negative post_count values", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        await expect(
          client.query(
            `insert into public.ig_scrapes (ig_username, started_by, post_count)
             values ($1, $2, $3)`,
            ["example", auth.id, -1],
          ),
        ).rejects.toThrow(/ig_scrapes_post_count_non_negative/);
      });
    });

    it("stores scraped profile fields including post_count", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        const { rows } = await client.query(
          `insert into public.ig_scrapes (
             ig_username,
             started_by,
             apify_called_at,
             finished_at,
             profile_picture_url,
             ig_name,
             description,
             note,
             post_count
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           returning
             ig_username as "igUsername",
             post_count as "postCount",
             error_message as "errorMessage"`,
          [
            "example",
            auth.id,
            "2026-08-20T10:00:00.000Z",
            "2026-08-20T10:05:00.000Z",
            "https://cdn.example/avatar.jpg",
            "Example Name",
            "Bio text",
            "Team note",
            128,
          ],
        );

        expect(rows[0]).toEqual({
          igUsername: "example",
          postCount: 128,
          errorMessage: null,
        });
      });
    });
  });
});

describe("authorized_users picture sync", () => {
  it("stores picture_url when a matching auth user is created", async () => {
    await withRollback(async (client) => {
      const authorized = await insertAuthorizedUser(client, {
        email: AUTHORIZED_EMAIL,
      });
      expect(authorized.userId).toBeNull();

      await insertAuthUser(client, {
        email: AUTHORIZED_EMAIL,
        meta: { picture: GOOGLE_PICTURE },
      });

      const { rows } = await client.query(
        `select picture_url as "pictureUrl", user_id as "userId"
         from public.authorized_users
         where id = $1`,
        [authorized.id],
      );

      expect(rows[0].pictureUrl).toBe(GOOGLE_PICTURE);
      expect(rows[0].userId).not.toBeNull();
    });
  });

  it("updates picture_url when auth user metadata changes on login", async () => {
    await withRollback(async (client) => {
      await insertAuthorizedUser(client, { email: AUTHORIZED_EMAIL });
      const auth = await insertAuthUser(client, {
        email: AUTHORIZED_EMAIL,
        meta: { picture: GOOGLE_PICTURE },
      });

      const updatedPicture = "https://lh3.googleusercontent.com/a/new-photo";

      await client.query(
        `update auth.users
         set raw_user_meta_data = raw_user_meta_data || $2::jsonb
         where id = $1`,
        [auth.id, JSON.stringify({ picture: updatedPicture })],
      );

      const { rows } = await client.query(
        `select picture_url as "pictureUrl"
         from public.authorized_users
         where email = $1`,
        [AUTHORIZED_EMAIL],
      );

      expect(rows[0].pictureUrl).toBe(updatedPicture);
    });
  });
});
