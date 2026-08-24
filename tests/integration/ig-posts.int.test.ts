import { describe, expect, it } from "vitest";

import { insertAuthUser } from "@/tests/setup/factories";
import { asAnon, asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const POST_URL = "https://www.instagram.com/p/ABC123xyz/";

async function insertSourceScrape(
  client: Parameters<Parameters<typeof withRollback>[0]>[0],
  authId: string,
) {
  const profile = await client.query(
    `insert into public.ig_profiles (ig_username, created_by)
     values ($1, $2)
     returning id`,
    ["example", authId],
  );
  const group = await client.query(
    `insert into public.groups (ig_profile_id, created_by)
     values ($1, $2)
     returning id`,
    [profile.rows[0].id, authId],
  );
  const scrape = await client.query(
    `insert into public.scheduled_scrapes (group_id, scrape_type)
     values ($1, $2)
     returning id`,
    [group.rows[0].id, "posts"],
  );

  return {
    profileId: profile.rows[0].id as string,
    scrapeId: scrape.rows[0].id as string,
  };
}

describe("ig_posts", () => {
  describe("RLS", () => {
    it("hides rows from anonymous visitors", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        const ids = await insertSourceScrape(client, auth.id);
        await asClaims(client, { sub: auth.id });
        await client.query(
          `insert into public.ig_posts (
             ig_profile_id, source_scrape_id, post_url
           ) values ($1, $2, $3)`,
          [ids.profileId, ids.scrapeId, POST_URL],
        );
        await asAnon(client);
        await expect(
          client.query("select count(*)::int as cnt from public.ig_posts"),
        ).rejects.toThrow(/permission denied/);
      });
    });

    it("rejects inserts for scrapes owned by another user", async () => {
      await withRollback(async (client) => {
        const owner = await insertAuthUser(client);
        const other = await insertAuthUser(client);
        const ids = await insertSourceScrape(client, owner.id);
        await asClaims(client, { sub: other.id });

        await expect(
          client.query(
            `insert into public.ig_posts (
               ig_profile_id, source_scrape_id, post_url
             ) values ($1, $2, $3)`,
            [ids.profileId, ids.scrapeId, POST_URL],
          ),
        ).rejects.toThrow(/permission denied|violates row-level security/);
      });
    });
  });

  describe("constraints", () => {
    it("stores a pending URL before details are scraped", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        const ids = await insertSourceScrape(client, auth.id);
        await asClaims(client, { sub: auth.id });

        const { rows } = await client.query(
          `insert into public.ig_posts (
             ig_profile_id,
             source_scrape_id,
             post_url,
             thumbnail_url
           )
           values ($1, $2, $3, $4)
           returning post_url as "postUrl", media_type as "mediaType", details_scrape_id as "detailsScrapeId"`,
          [ids.profileId, ids.scrapeId, POST_URL, "https://cdn.example/thumb.jpg"],
        );

        expect(rows[0]).toEqual({
          postUrl: POST_URL,
          mediaType: null,
          detailsScrapeId: null,
        });
      });
    });

    it("stores post metrics, media fields, and carousel image urls", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        const ids = await insertSourceScrape(client, auth.id);
        await asClaims(client, { sub: auth.id });

        const carouselUrls = [
          "https://cdn.example/carousel-1.jpg",
          "https://cdn.example/carousel-2.jpg",
        ];

        const { rows } = await client.query(
          `insert into public.ig_posts (
             ig_profile_id,
             source_scrape_id,
             uploaded_at,
             thumbnail_url,
             post_url,
             first_frame_url,
             video_embed_url,
             media_type,
             carousel_image_urls,
             video_length_secs,
             view_count,
             save_count,
             share_count,
             comment_count,
             like_count,
             description
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           returning
             media_type as "mediaType",
             carousel_image_urls as "carouselImageUrls",
             like_count as "likeCount",
             video_length_secs as "videoLengthSecs"`,
          [
            ids.profileId,
            ids.scrapeId,
            "2026-08-20T10:00:00.000Z",
            "https://cdn.example/thumb.jpg",
            POST_URL,
            "https://cdn.example/first-frame.jpg",
            "https://cdn.example/video.mp4",
            "carousel",
            carouselUrls,
            42,
            1000,
            50,
            12,
            8,
            200,
            "Caption text",
          ],
        );

        expect(rows[0]).toEqual({
          mediaType: "carousel",
          carouselImageUrls: carouselUrls,
          likeCount: 200,
          videoLengthSecs: 42,
        });
      });
    });

    it("rejects duplicate post_url within the same profile", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        const ids = await insertSourceScrape(client, auth.id);
        await asClaims(client, { sub: auth.id });

        await client.query(
          `insert into public.ig_posts (
             ig_profile_id, source_scrape_id, post_url
           ) values ($1, $2, $3)`,
          [ids.profileId, ids.scrapeId, POST_URL],
        );

        await expect(
          client.query(
            `insert into public.ig_posts (
               ig_profile_id, source_scrape_id, post_url
             ) values ($1, $2, $3)`,
            [ids.profileId, ids.scrapeId, POST_URL],
          ),
        ).rejects.toThrow(/ig_posts_ig_profile_id_post_url_key/);
      });
    });
  });
});
