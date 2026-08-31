import { ScrapeStatusBadge } from "@/components/ig/scrape-badges";
import { getIgScrapeJobStatus, type IgScrapeJob } from "@/lib/ig/groups";
import { igScrapePath } from "@/lib/ig/routes";

interface ScrapeStatusLinkProps {
  job: IgScrapeJob;
  className?: string;
}

/** Status badge that links to the scrape's own page with its request pipeline. */
export function ScrapeStatusLink({ job, className }: ScrapeStatusLinkProps) {
  return (
    <ScrapeStatusBadge
      status={getIgScrapeJobStatus(job)}
      className={className}
      href={igScrapePath(job.group.id)}
    />
  );
}
