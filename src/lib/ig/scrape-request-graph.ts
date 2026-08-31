import type { ScheduledScrape } from "@/lib/ig/queries";

export const SCRAPE_GRAPH_START_NODE_ID = "start";

export type ScrapeGraphNode =
  | { id: typeof SCRAPE_GRAPH_START_NODE_ID; kind: "start" }
  | { id: string; kind: "request"; scrape: ScheduledScrape };

export interface ScrapeGraphEdge {
  from: string;
  to: string;
}

/** Requests arranged in pipeline stages: start → first requests → details batches. */
export interface ScrapeRequestGraph {
  columns: ScrapeGraphNode[][];
  edges: ScrapeGraphEdge[];
}

export interface ScrapeGraphLayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  columnGap: number;
  rowGap: number;
}

export interface PositionedScrapeGraphNode {
  node: ScrapeGraphNode;
  x: number;
  y: number;
}

export interface PositionedScrapeGraphEdge extends ScrapeGraphEdge {
  /** SVG path from the source node's right edge to the target node's left edge. */
  path: string;
}

export interface ScrapeGraphLayout {
  width: number;
  height: number;
  nodes: PositionedScrapeGraphNode[];
  edges: PositionedScrapeGraphEdge[];
}

export const SCRAPE_GRAPH_DEFAULT_LAYOUT: ScrapeGraphLayoutOptions = {
  nodeWidth: 208,
  nodeHeight: 76,
  columnGap: 64,
  rowGap: 16,
};

const START_NODE: ScrapeGraphNode = { id: SCRAPE_GRAPH_START_NODE_ID, kind: "start" };

/** Requests started directly from the scrape, in display order. */
const FIRST_STAGE_ORDER: Record<ScheduledScrape["scrape_type"], number> = {
  posts: 0,
  profile_posts: 0,
  reels: 1,
  meta: 2,
  post_details: 3,
};

/**
 * Builds the request pipeline as stages. Listing and Meta requests fan out from
 * the start; post-details batches chain one after another behind the listings.
 */
export function buildScrapeRequestGraph(
  scrapes: ScheduledScrape[],
): ScrapeRequestGraph {
  const sorted = [...scrapes].sort(compareByCreatedAt);
  const firstStage = sorted
    .filter((scrape) => scrape.scrape_type !== "post_details")
    .sort(
      (left, right) =>
        FIRST_STAGE_ORDER[left.scrape_type] - FIRST_STAGE_ORDER[right.scrape_type] ||
        compareByCreatedAt(left, right),
    );
  const detailBatches = sorted.filter((scrape) => scrape.scrape_type === "post_details");

  const columns: ScrapeGraphNode[][] = [[START_NODE]];
  const edges: ScrapeGraphEdge[] = [];

  if (firstStage.length > 0) {
    columns.push(firstStage.map(toRequestNode));
    edges.push(
      ...firstStage.map((scrape) => ({ from: SCRAPE_GRAPH_START_NODE_ID, to: scrape.id })),
    );
  }

  let previousStage = firstStage
    .filter((scrape) => scrape.scrape_type !== "meta")
    .map((scrape) => scrape.id);
  if (previousStage.length === 0) {
    previousStage = [SCRAPE_GRAPH_START_NODE_ID];
  }

  for (const batch of detailBatches) {
    columns.push([toRequestNode(batch)]);
    edges.push(...previousStage.map((from) => ({ from, to: batch.id })));
    previousStage = [batch.id];
  }

  return { columns, edges };
}

/**
 * Positions each stage in its own column, vertically centred, and draws
 * smooth connectors between stages.
 */
export function layoutScrapeRequestGraph(
  graph: ScrapeRequestGraph,
  options: ScrapeGraphLayoutOptions = SCRAPE_GRAPH_DEFAULT_LAYOUT,
): ScrapeGraphLayout {
  const { nodeWidth, nodeHeight, columnGap, rowGap } = options;
  const columnHeights = graph.columns.map(
    (column) => column.length * nodeHeight + Math.max(0, column.length - 1) * rowGap,
  );
  const height = Math.max(0, ...columnHeights);
  const width =
    graph.columns.length * nodeWidth + Math.max(0, graph.columns.length - 1) * columnGap;

  const nodes: PositionedScrapeGraphNode[] = [];
  const positionsById = new Map<string, { x: number; y: number }>();

  graph.columns.forEach((column, columnIndex) => {
    const x = columnIndex * (nodeWidth + columnGap);
    const offsetY = (height - (columnHeights[columnIndex] ?? 0)) / 2;

    column.forEach((node, rowIndex) => {
      const y = offsetY + rowIndex * (nodeHeight + rowGap);
      nodes.push({ node, x, y });
      positionsById.set(node.id, { x, y });
    });
  });

  const edges = graph.edges.flatMap<PositionedScrapeGraphEdge>((edge) => {
    const from = positionsById.get(edge.from);
    const to = positionsById.get(edge.to);
    if (!from || !to) {
      return [];
    }

    const startX = from.x + nodeWidth;
    const startY = from.y + nodeHeight / 2;
    const endX = to.x;
    const endY = to.y + nodeHeight / 2;
    const bend = columnGap / 2;

    return [
      {
        ...edge,
        path: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
      },
    ];
  });

  return { width, height, nodes, edges };
}

function toRequestNode(scrape: ScheduledScrape): ScrapeGraphNode {
  return { id: scrape.id, kind: "request", scrape };
}

function compareByCreatedAt(left: ScheduledScrape, right: ScheduledScrape): number {
  return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
}
