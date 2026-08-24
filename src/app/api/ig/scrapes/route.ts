import { NextResponse } from "next/server";
import { z } from "zod";

import { buildIgScrapeJobs } from "@/lib/ig/groups";
import { startListingRun } from "@/lib/ig/start-runs";
import { upsertIgProfile } from "@/lib/ig/queries";
import { resolveMetaAccountAccess } from "@/lib/meta/connections";
import { importMetaScrape } from "@/lib/meta/scrape";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const CreateIgScrapeSchema = z.object({
  igUsername: z.string().trim().toLowerCase().regex(/^[a-z0-9._]{1,30}$/),
  requestedPostCount: z.number().int().min(1).max(500).nullable().optional(),
  sinceWhen: z.string().datetime({ offset: true }).nullable().optional(),
  dataSource: z.enum(["public", "meta_hybrid"]).default("public"),
  metaInstagramAccountId: z.string().uuid().nullable().optional(),
}).superRefine((value, context) => {
  if (value.dataSource === "meta_hybrid" && !value.metaInstagramAccountId) {
    context.addIssue({
      code: "custom",
      path: ["metaInstagramAccountId"],
      message: "A Meta Instagram account is required",
    });
  }
});

/** Starts listing scrapes for posts and reels on the authenticated user. */
export async function POST(request: Request) {
  const parsedBody = CreateIgScrapeSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid scrape request" }, { status: 400 });
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Apify is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const profile = await upsertIgProfile(supabase, {
    igUsername: parsedBody.data.igUsername,
    createdBy: user.id,
  });
  const requestedPostCount = parsedBody.data.requestedPostCount ?? null;
  const sinceWhen = parsedBody.data.sinceWhen ?? null;
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      ig_profile_id: profile.id,
      created_by: user.id,
      requested_post_count: requestedPostCount,
      since_when: sinceWhen,
      data_source: parsedBody.data.dataSource,
      meta_instagram_account_id:
        parsedBody.data.dataSource === "meta_hybrid"
          ? parsedBody.data.metaInstagramAccountId
          : null,
    })
    .select("*")
    .single();

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }

  const { data: scrapes, error: insertError } = await supabase
    .from("scheduled_scrapes")
    .insert([
      {
        group_id: group.id,
        scrape_type: "posts",
      },
      {
        group_id: group.id,
        scrape_type: "reels",
      },
    ])
    .select("*");

  if (insertError || !scrapes) {
    await admin.from("groups").delete().eq("id", group.id);
    return NextResponse.json(
      { error: insertError?.message ?? "Could not schedule scrape" },
      { status: 500 },
    );
  }

  try {
    if (
      parsedBody.data.dataSource === "meta_hybrid" &&
      parsedBody.data.metaInstagramAccountId
    ) {
      const access = await resolveMetaAccountAccess(
        admin,
        parsedBody.data.metaInstagramAccountId,
        profile.ig_username,
      );
      const { error: connectionError } = await admin
        .from("groups")
        .update({ meta_connection_id: access.connection.id })
        .eq("id", group.id);
      if (connectionError) {
        throw connectionError;
      }
      await importMetaScrape({
        admin,
        access,
        groupId: group.id,
        profileId: profile.id,
        requestedPostCount,
        sinceWhen,
        listingScrapes: scrapes,
      });
    }

    const started = await Promise.all(
      scrapes.map(async (scrape) => {
        const run = await startListingRun(token, {
          scrapeType: scrape.scrape_type === "reels" ? "reels" : "posts",
          username: profile.ig_username,
          requestedPostCount,
          sinceWhen,
        });
        const { data: updated, error: updateError } = await supabase
          .from("scheduled_scrapes")
          .update({
            apify_called_at: new Date().toISOString(),
            apify_run_id: run.id,
          })
          .eq("id", scrape.id)
          .select("*")
          .single();

        if (updateError) {
          throw updateError;
        }

        return updated;
      }),
    );

    const job = buildIgScrapeJobs(
      [group],
      started,
      new Map([[profile.id, profile]]),
    )[0];
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Apify";
    await admin.from("groups").delete().eq("id", group.id);

    return NextResponse.json({ error: message, groupId: group.id }, { status: 502 });
  }
}
