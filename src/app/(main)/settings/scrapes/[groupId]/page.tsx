import { notFound } from "next/navigation";
import { after } from "next/server";

import { ScrapeGroupPageClient } from "@/components/ig/scrape-group-page-client";
import { PageShell } from "@/components/ui/page-shell";
import { UUID_PATTERN } from "@/lib/ig/constants";
import { syncUnsettledApifyRunsForGroup } from "@/lib/ig/process-apify-run";
import { getIgScrapeJobById } from "@/lib/ig/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ScrapeGroupPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function ScrapeGroupPage({ params }: ScrapeGroupPageProps) {
  const { groupId } = await params;
  if (!UUID_PATTERN.test(groupId)) {
    notFound();
  }

  const supabase = await createClient();
  const job = await getIgScrapeJobById(supabase, groupId);
  if (!job) {
    notFound();
  }

  const apifyToken = process.env.APIFY_API_TOKEN;
  const hasUnsettledRuns = job.scrapes.some(
    (scrape) => scrape.apify_run_id && !scrape.finished_at,
  );
  if (apifyToken && hasUnsettledRuns) {
    // Runs that finished without a webhook callback are settled in the background.
    after(async () => {
      try {
        await syncUnsettledApifyRunsForGroup(createAdminClient(), apifyToken, job.group.id);
      } catch (error) {
        console.error("Could not sync unsettled Apify runs", error);
      }
    });
  }

  return (
    <PageShell size="wide" className="space-y-6 py-8">
      <ScrapeGroupPageClient initialJob={job} />
    </PageShell>
  );
}
