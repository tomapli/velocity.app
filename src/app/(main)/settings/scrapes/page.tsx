import { ScrapesManager } from "@/components/ig/scrapes-manager";
import { PageShell } from "@/components/ui/page-shell";
import { loadIgScrapeSnapshot } from "@/lib/ig/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ScrapesPage() {
  const supabase = await createClient();
  const snapshot = await loadIgScrapeSnapshot(supabase);

  return (
    <PageShell size="wide" className="space-y-6 py-8">
      <ScrapesManager initialSnapshot={snapshot} />
    </PageShell>
  );
}
