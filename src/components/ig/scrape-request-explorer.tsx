"use client";

import { useState } from "react";

import { ScrapeRequestDetails } from "@/components/ig/scrape-request-details";
import { ScrapeRequestGraph } from "@/components/ig/scrape-request-graph";
import type { IgScrapeJob } from "@/lib/ig/groups";
import { pickFocusScheduledScrape } from "@/lib/ig/scrape-requests";

interface ScrapeRequestExplorerProps {
  job: IgScrapeJob;
}

/**
 * Request pipeline graph with the selected request's details underneath.
 * Defaults to the request that needs attention (failed, then running).
 */
export function ScrapeRequestExplorer({ job }: ScrapeRequestExplorerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    job.scrapes.find((scrape) => scrape.id === selectedId) ??
    pickFocusScheduledScrape(job.scrapes);

  return (
    <div className="space-y-4">
      <ScrapeRequestGraph
        scrapes={job.scrapes}
        startedAt={job.group.created_at}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
      />
      {selected ? (
        <ScrapeRequestDetails scrape={selected} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No requests were created for this scrape yet.
        </p>
      )}
    </div>
  );
}
