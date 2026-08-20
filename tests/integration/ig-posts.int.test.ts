import { describe, expect, it } from "vitest";

import { insertAuthUser } from "@/tests/setup/factories";
import { asAnon, asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const POST_URL = "https://www.instagram.com/p/ABC123xyz/";

async function insertScrape(
  client: Parameters<Parameters<typeof withRollback>[0]>[0],
  authId: string,
) {
  const { rows } = await client.query(
    `insert into public.ig_scrapes (ig_username, started_by)
     values ($1, $2)
     returning id`,
    ["example", authId],
  );

  return rows[0].id as string;
}

describe("ig_posts", () => {
  describe("RLS", () => {
    it("hides rows from anonymous visitors", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        const scrapeId = await insertScrape(client, auth.id);
        await asClaims(client, { sub: auth.id });
        await client.query(
          `insert into public.ig_posts (
             ig_scrape_id, uploaded_at, post_url, media_type
           ) values ($1, $2, $3, $4)`,
          [scrapeId, "2026-08-20T10:00:00.000Z", POST_URL, "static"],
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
        const scrapeId = await insertScrape(client, owner.id);
        await asClaims(client, { sub: other.id });

        await expect(
          client.query(
            `insert into public.ig_posts (
               ig_scrape_id, uploaded_at, post_url, media_type
             ) values ($1, $2, $3, $4)`,
            [scrapeId, "2026-08-20T10:00:00.000Z", POST_URL, "static"],
          ),
        ).rejects.toThrow(/permission denied|violates row-level security/);
      });
    });
  });

  describe("constraints", () => {
    it("stores post metrics, media fields, and carousel image urls", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        const scrapeId = await insertScrape(client, auth.id);
        await asClaims(client, { sub: auth.id });

        const carouselUrls = [
          "https://cdn.example/carousel-1.jpg",
          "https://cdn.example/carousel-2.jpg",
        ];

        const { rows } = await client.query(
          `insert into public.ig_posts (
             ig_scrape_id,
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
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           returning
             media_type as "mediaType",
             carousel_image_urls as "carouselImageUrls",
             like_count as "likeCount",
             video_length_secs as "videoLengthSecs"`,
          [
            scrapeId,
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

    it("rejects duplicate post_url within the same scrape", async () => {
      await withRollback(async (client) => {
        const auth = await insertAuthUser(client);
        const scrapeId = await insertScrape(client, auth.id);
        await asClaims(client, { sub: auth.id });

        await client.query(
          `insert into public.ig_posts (
             ig_scrape_id, uploaded_at, post_url, media_type
           ) values ($1, $2, $3, $4)`,
          [scrapeId, "2026-08-20T10:00:00.000Z", POST_URL, "static"],
        );

        await expect(
          client.query(
            `insert into public.ig_posts (
               ig_scrape_id, uploaded_at, post_url, media_type
             ) values ($1, $2, $3, $4)`,
            [scrapeId, "2026-08-21T10:00:00.000Z", POST_URL, "short"],
          ),
        ).rejects.toThrow(/ig_posts_ig_scrape_id_post_url_key/);
      });
    });
  });
});
