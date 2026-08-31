"use client";

import { useId, useMemo } from "react";

import { RequestStatusBadge } from "@/components/ig/scrape-badges";
import { Button } from "@/components/ui/button";
import { formatIgDateTime } from "@/lib/ig/format";
import type { ScheduledScrape } from "@/lib/ig/queries";
import {
  SCRAPE_GRAPH_DEFAULT_LAYOUT,
  buildScrapeRequestGraph,
  layoutScrapeRequestGraph,
  type PositionedScrapeGraphNode,
} from "@/lib/ig/scrape-request-graph";
import {
  SCRAPE_TYPE_LABELS,
  getScheduledScrapeProgress,
  getScheduledScrapeStatus,
  type ScheduledScrapeStatus,
} from "@/lib/ig/scrape-requests";
import { cn } from "@/lib/utils";

interface ScrapeRequestGraphProps {
  scrapes: ScheduledScrape[];
  /** When the scrape was created; shown on the start node. */
  startedAt: string;
  selectedId: string | null;
  onSelect: (scrapeId: string) => void;
}

const ARROW_SIZE = 8;
const EDGE_STROKE_WIDTH = 1.5;

const NODE_STATUS_CLASSES: Record<ScheduledScrapeStatus, string> = {
  queued: "border-muted-foreground/30",
  running: "border-info/60",
  done: "border-success/60",
  failed: "border-destructive/60",
};

/**
 * Pipeline view of a scrape's requests: start → listings / Meta → details batches.
 * Nodes are buttons so any request can be inspected.
 */
export function ScrapeRequestGraph({
  scrapes,
  startedAt,
  selectedId,
  onSelect,
}: ScrapeRequestGraphProps) {
  const markerId = useId();
  const layout = useMemo(
    () => layoutScrapeRequestGraph(buildScrapeRequestGraph(scrapes)),
    [scrapes],
  );
  const { nodeWidth, nodeHeight } = SCRAPE_GRAPH_DEFAULT_LAYOUT;

  return (
    <div className="overflow-x-auto py-1" role="group" aria-label="Request pipeline">
      <div
        className="relative"
        style={{ width: layout.width, height: layout.height }}
      >
        <svg
          className="pointer-events-none absolute inset-0 size-full text-muted-foreground/50"
          width={layout.width}
          height={layout.height}
          aria-hidden
        >
          <defs>
            <marker
              id={markerId}
              markerWidth={ARROW_SIZE}
              markerHeight={ARROW_SIZE}
              refX={ARROW_SIZE}
              refY={ARROW_SIZE / 2}
              orient="auto"
            >
              <path
                d={`M0,0 L${ARROW_SIZE},${ARROW_SIZE / 2} L0,${ARROW_SIZE} z`}
                fill="currentColor"
              />
            </marker>
          </defs>
          {layout.edges.map((edge) => (
            <path
              key={`${edge.from}->${edge.to}`}
              d={edge.path}
              fill="none"
              stroke="currentColor"
              strokeWidth={EDGE_STROKE_WIDTH}
              markerEnd={`url(#${markerId})`}
            />
          ))}
        </svg>

        {layout.nodes.map(({ node, x, y }) =>
          node.kind === "start" ? (
            <StartNode
              key={node.id}
              startedAt={startedAt}
              style={{ left: x, top: y, width: nodeWidth, height: nodeHeight }}
            />
          ) : (
            <RequestNode
              key={node.id}
              scrape={node.scrape}
              selected={node.id === selectedId}
              onSelect={() => onSelect(node.id)}
              style={{ left: x, top: y, width: nodeWidth, height: nodeHeight }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function StartNode({
  startedAt,
  style,
}: {
  startedAt: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="absolute flex flex-col justify-center gap-0.5 rounded-md border bg-muted/50 px-3 text-sm"
      style={style}
    >
      <span className="font-medium">Start</span>
      <span className="text-xs text-muted-foreground">
        {formatIgDateTime(startedAt)}
      </span>
    </div>
  );
}

function RequestNode({
  scrape,
  selected,
  onSelect,
  style,
}: {
  scrape: ScheduledScrape;
  selected: boolean;
  onSelect: () => void;
  style: React.CSSProperties;
}) {
  const status = getScheduledScrapeStatus(scrape);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onSelect}
      aria-pressed={selected}
      style={style}
      className={cn(
        "absolute h-auto flex-col items-start justify-center gap-1 whitespace-normal px-3 text-left",
        NODE_STATUS_CLASSES[status],
        selected && "bg-accent ring-[3px] ring-ring/50",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate font-medium">
          {SCRAPE_TYPE_LABELS[scrape.scrape_type]}
        </span>
        <RequestStatusBadge status={status} />
      </span>
      <span className="w-full truncate text-xs font-normal text-muted-foreground">
        {describeNode(scrape, status)}
      </span>
    </Button>
  );
}

function describeNode(scrape: ScheduledScrape, status: ScheduledScrapeStatus): string {
  const progress = getScheduledScrapeProgress(scrape);
  if (progress && (status === "running" || status === "queued")) {
    return progress.label;
  }

  if (status === "done" || status === "failed") {
    return `Finished ${formatIgDateTime(scrape.finished_at)}`;
  }
  if (status === "running") {
    return `Started ${formatIgDateTime(scrape.apify_called_at ?? scrape.created_at)}`;
  }
  return "Waiting to start";
}

export type { PositionedScrapeGraphNode };
