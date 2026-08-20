import { IgSearchHome } from "@/components/ig/ig-search-home";
import { PageShell } from "@/components/ui/page-shell";
import { listIgScrapeJobs } from "@/lib/ig/queries";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const jobs = await listIgScrapeJobs(supabase);

  return (
    <PageShell size="wide" className="flex flex-1 flex-col">
      <IgSearchHome initialJobs={jobs} />
    </PageShell>
  );
}
