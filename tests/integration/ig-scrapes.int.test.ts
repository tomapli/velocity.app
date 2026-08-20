import { describe, expect, it } from "vitest";

import { insertAuthUser, insertAuthorizedUser } from "@/tests/setup/factories";
import { asAnon, asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const AUTHORIZED_EMAIL = "allowed@example.com";
const GOOGLE_PICTURE = "https://lh3.googleusercontent.com/a/example-photo";

describe("ig_profiles", () => {
  describe("RLS", () => {
    it("hides rows from anonymous visitors", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });
        await client.query(
          `insert into public.ig_profiles (ig_username, created_by)
           values ($1, $2)`,
          ["example", auth.id],
        );
        await asAnon(client);
        await expect(
          client.query("select count(*)::int as cnt from public.ig_profiles"),
        ).rejects.toThrow(/permission denied/);
      });
    });

    it("lets authenticated users insert a profile they created", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        const { rows } = await client.query(
          `insert into public.ig_profiles (ig_username, created_by)
           values ($1, $2)
           returning ig_username as "igUsername", created_by as "createdBy"`,
          ["example", auth.id],
        );

        expect(rows[0]).toEqual({
          igUsername: "example",
          createdBy: auth.id,
        });
      });
    });
  });

  describe("constraints", () => {
    it("rejects duplicate usernames", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        await client.query(
          `insert into public.ig_profiles (ig_username, created_by)
           values ($1, $2)`,
          ["example", auth.id],
        );

        await expect(
          client.query(
            `insert into public.ig_profiles (ig_username, created_by)
             values ($1, $2)`,
            ["example", auth.id],
          ),
        ).rejects.toThrow(/ig_profiles_ig_username_key/);
      });
    });

    it("rejects negative post_count values", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });

        await expect(
          client.query(
            `insert into public.ig_profiles (ig_username, created_by, post_count)
             values ($1, $2, $3)`,
            ["example", auth.id, -1],
          ),
        ).rejects.toThrow(/ig_profiles_post_count_non_negative/);
      });
    });
  });
});

describe("scheduled_scrapes", () => {
  describe("constraints", () => {
    it("stores apify_run_id when the actor is started", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });
        const profileId = await insertProfile(client, auth.id);

        const { rows } = await client.query(
          `insert into public.scheduled_scrapes (
             ig_profile_id, started_by, group_id, scrape_type, apify_run_id, apify_called_at
           )
           values ($1, $2, $3, $4, $5, now())
           returning apify_run_id as "apifyRunId"`,
          [profileId, auth.id, crypto.randomUUID(), "posts", "sxfSOvMdx4kXZjQ0r"],
        );

        expect(rows[0].apifyRunId).toBe("sxfSOvMdx4kXZjQ0r");
      });
    });

    it("rejects duplicate apify_run_id values", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        await asClaims(client, { sub: auth.id });
        const profileId = await insertProfile(client, auth.id);

        await client.query(
          `insert into public.scheduled_scrapes (
             ig_profile_id, started_by, group_id, scrape_type, apify_run_id
           )
           values ($1, $2, $3, $4, $5)`,
          [profileId, auth.id, crypto.randomUUID(), "posts", "sxfSOvMdx4kXZjQ0r"],
        );

        await expect(
          client.query(
            `insert into public.scheduled_scrapes (
               ig_profile_id, started_by, group_id, scrape_type, apify_run_id
             )
             values ($1, $2, $3, $4, $5)`,
            [profileId, auth.id, crypto.randomUUID(), "reels", "sxfSOvMdx4kXZjQ0r"],
          ),
        ).rejects.toThrow(/scheduled_scrapes_apify_run_id_key/);
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

async function insertProfile(
  client: Parameters<Parameters<typeof withRollback>[0]>[0],
  authId: string,
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.ig_profiles (ig_username, created_by)
     values ($1, $2)
     returning id`,
    ["example", authId],
  );

  return rows[0].id as string;
}
