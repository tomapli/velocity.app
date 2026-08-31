import { describe, expect, it } from "vitest";

import type { ScheduledScrape } from "@/lib/ig/queries";
import {
  SCRAPE_GRAPH_START_NODE_ID,
  buildScrapeRequestGraph,
  layoutScrapeRequestGraph,
} from "@/lib/ig/scrape-request-graph";

function scrape(
  id: string,
  scrapeType: ScheduledScrape["scrape_type"],
  createdAt: string,
): ScheduledScrape {
  return {
    apify_called_at: null,
    apify_run_id: null,
    created_at: createdAt,
    error_message: null,
    finished_at: null,
    group_id: "group-1",
    id,
    scrape_type: scrapeType,
    state: {},
    updated_at: createdAt,
  };
}

const REELS = scrape("reels", "reels", "2026-08-20T10:00:01.000Z");
const POSTS = scrape("posts", "posts", "2026-08-20T10:00:01.000Z");
const META = scrape("meta", "meta", "2026-08-20T10:00:01.000Z");
const DETAILS_1 = scrape("details-1", "post_details", "2026-08-20T10:05:00.000Z");
const DETAILS_2 = scrape("details-2", "post_details", "2026-08-20T10:09:00.000Z");

describe("buildScrapeRequestGraph", () => {
  it("fans out from start and chains details batches behind the listings", () => {
    const graph = buildScrapeRequestGraph([DETAILS_2, META, REELS, DETAILS_1, POSTS]);

    expect(graph.columns.map((column) => column.map((node) => node.id))).toEqual([
      [SCRAPE_GRAPH_START_NODE_ID],
      ["posts", "reels", "meta"],
      ["details-1"],
      ["details-2"],
    ]);
    expect(graph.edges).toEqual([
      { from: SCRAPE_GRAPH_START_NODE_ID, to: "posts" },
      { from: SCRAPE_GRAPH_START_NODE_ID, to: "reels" },
      { from: SCRAPE_GRAPH_START_NODE_ID, to: "meta" },
      { from: "posts", to: "details-1" },
      { from: "reels", to: "details-1" },
      { from: "details-1", to: "details-2" },
    ]);
  });

  it("only has a start node when no requests exist yet", () => {
    const graph = buildScrapeRequestGraph([]);

    expect(graph.columns).toEqual([[{ id: SCRAPE_GRAPH_START_NODE_ID, kind: "start" }]]);
    expect(graph.edges).toEqual([]);
  });
});

describe("layoutScrapeRequestGraph", () => {
  it("places stages in columns, centres shorter columns, and connects nodes", () => {
    const layout = layoutScrapeRequestGraph(buildScrapeRequestGraph([POSTS, REELS, DETAILS_1]), {
      nodeWidth: 100,
      nodeHeight: 40,
      columnGap: 20,
      rowGap: 10,
    });

    expect(layout.width).toBe(3 * 100 + 2 * 20);
    expect(layout.height).toBe(2 * 40 + 10);

    const positions = Object.fromEntries(
      layout.nodes.map(({ node, x, y }) => [node.id, { x, y }]),
    );
    expect(positions[SCRAPE_GRAPH_START_NODE_ID]).toEqual({ x: 0, y: 25 });
    expect(positions.posts).toEqual({ x: 120, y: 0 });
    expect(positions.reels).toEqual({ x: 120, y: 50 });
    expect(positions["details-1"]).toEqual({ x: 240, y: 25 });

    const edge = layout.edges.find((row) => row.from === "reels" && row.to === "details-1");
    expect(edge?.path).toBe("M 220 70 C 230 70, 230 45, 240 45");
  });
});
