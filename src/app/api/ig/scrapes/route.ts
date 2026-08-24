import { after, NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage } from "@/lib/errors";
import { buildIgScrapeJobs } from "@/lib/ig/groups";
import { startListingRun } from "@/lib/ig/start-runs";
import { upsertIgProfile } from "@/lib/ig/queries";
import {
  resolveMetaAccountAccess,
  type ResolvedMetaAccountAccess,
} from "@/lib/meta/connections";
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
  let metaAccess: ResolvedMetaAccountAccess | null = null;

  if (
    parsedBody.data.dataSource === "meta_hybrid" &&
    parsedBody.data.metaInstagramAccountId
  ) {
    try {
      metaAccess = await resolveMetaAccountAccess(
        admin,
        parsedBody.data.metaInstagramAccountId,
        profile.ig_username,
      );
    } catch (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "Could not validate Meta access") },
        { status: 502 },
      );
    }
  }

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
      meta_connection_id: metaAccess?.connection.id ?? null,
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
    let metaImport: Parameters<typeof importMetaScrape>[0] | null = null;
    if (metaAccess) {
      metaImport = {
        admin,
        access: metaAccess,
        groupId: group.id,
        profileId: profile.id,
        requestedPostCount,
        sinceWhen,
        listingScrapes: scrapes,
      };
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

    if (metaImport) {
      const importParams = metaImport;
      after(async () => {
        try {
          await importMetaScrape(importParams);
        } catch (error) {
          console.error("Meta scrape import failed", {
            error,
            groupId: importParams.groupId,
            profileId: importParams.profileId,
          });
        }
      });
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "Could not start scrape");
    await admin.from("groups").delete().eq("id", group.id);

    return NextResponse.json({ error: message, groupId: group.id }, { status: 502 });
  }
}
