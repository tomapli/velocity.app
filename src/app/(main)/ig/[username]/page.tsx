import { notFound } from "next/navigation";

import { IgProfilePageClient } from "@/components/ig/ig-profile-page-client";
import { PageShell } from "@/components/ui/page-shell";
import { IG_USERNAME_PATTERN } from "@/lib/ig/constants";
import { syncUnsettledApifyRunsForGroup } from "@/lib/ig/process-apify-run";
import {
  getIgAccountInsightsForGroup,
  getLatestIgScrapeJobForUsername,
  listIgPostsForProfile,
} from "@/lib/ig/queries";
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
  let latestJob = await getLatestIgScrapeJobForUsername(supabase, username);

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (latestJob && apifyToken) {
    const hasUnsettledRuns = latestJob.scrapes.some(
      (scrape) => scrape.apify_run_id && !scrape.finished_at,
    );
    if (hasUnsettledRuns) {
      const admin = createAdminClient();
      await syncUnsettledApifyRunsForGroup(admin, apifyToken, latestJob.group.id);
      latestJob = await getLatestIgScrapeJobForUsername(supabase, username);
    }
  }

  const initialPosts = latestJob
    ? await listIgPostsForProfile(supabase, latestJob.profile.id)
    : [];
  const initialAccountInsights = latestJob
    ? await getIgAccountInsightsForGroup(supabase, latestJob.group.id)
    : null;

  return (
    <PageShell size="full">
      <IgProfilePageClient
        username={username}
        initialJob={latestJob}
        initialPosts={initialPosts}
        initialAccountInsights={initialAccountInsights}
      />
    </PageShell>
  );
}
