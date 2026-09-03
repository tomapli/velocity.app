import { notFound } from "next/navigation";
import { after } from "next/server";

import { IgProfilePageClient } from "@/components/ig/ig-profile-page-client";
import { PageShell } from "@/components/ui/page-shell";
import { IG_USERNAME_PATTERN } from "@/lib/ig/constants";
import { syncUnsettledApifyRunsForGroup } from "@/lib/ig/process-apify-run";
import {
  getLatestIgScrapeJobForUsername,
  getUploadedSinceIso,
  listIgPostsPageForProfile,
} from "@/lib/ig/queries";
import { META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS } from "@/lib/meta/constants";
import { maybeScheduleMetaInsightsRefresh } from "@/lib/meta/refresh-account-insights";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface IgProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function IgProfilePage({ params }: IgProfilePageProps) {
  const { username: rawUsername } = await params;
  const username = rawUsername.toLowerCase();

  if (!IG_USERNAME_PATTERN.test(username)) {
    notFound();
  }

  const supabase = await createClient();
  const latestJob = await getLatestIgScrapeJobForUsername(supabase, username);

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (latestJob && apifyToken) {
    const hasUnsettledRuns = latestJob.scrapes.some(
      (scrape) => scrape.apify_run_id && !scrape.finished_at,
    );
    if (hasUnsettledRuns) {
      after(async () => {
        try {
          await syncUnsettledApifyRunsForGroup(
            createAdminClient(),
            apifyToken,
            latestJob.group.id,
          );
        } catch (error) {
          console.error("Could not sync unsettled Apify runs", error);
        }
      });
    }
  }

  if (latestJob) {
    // Kick off a fresh account-insights scrape for every page open; the TTL
    // and in-flight checks inside keep it from stacking runs.
    after(async () => {
      try {
        await maybeScheduleMetaInsightsRefresh(createAdminClient(), latestJob.group);
      } catch (error) {
        console.error("Could not schedule Meta insights refresh", error);
      }
    });
  }

  // Hybrid profiles show account insights for a default range that also
  // filters the posts list, so the first page is fetched with the same cutoff.
  const initialPostsPage = latestJob
    ? await listIgPostsPageForProfile(
        supabase,
        latestJob.profile.id,
        latestJob.group.data_source === "meta_hybrid"
          ? {
              uploadedSince: getUploadedSinceIso(
                META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
              ),
            }
          : {},
      )
    : { posts: [], hasMore: false, nextOffset: 0 };

  return (
    <PageShell size="full">
      <IgProfilePageClient
        username={username}
        initialJob={latestJob}
        initialPostsPage={initialPostsPage}
      />
    </PageShell>
  );
}
