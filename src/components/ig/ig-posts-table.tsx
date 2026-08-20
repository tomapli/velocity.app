"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Layers, Play } from "lucide-react";

import { IgMetricBadge, IgPlainMetric } from "@/components/ig/ig-metric-badge";
import { IgRemoteImage } from "@/components/ig/ig-remote-image";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCount,
  formatUploadedAt,
  getIgPostMetrics,
  MEDIA_TYPE_LABELS,
  type IgPostSortKey,
} from "@/lib/ig/metrics";
import type { IgPost } from "@/lib/ig/queries";
import { cn } from "@/lib/utils";

interface IgPostsTableProps {
  username: string;
  posts: IgPost[];
  sortKey: IgPostSortKey;
  sortDirection: "asc" | "desc";
  onSortKeyChange: (key: IgPostSortKey) => void;
  onSortDirectionChange: (direction: "asc" | "desc") => void;
}

const PREVIEW_PRIMARY_SIZE = "size-20";
const PREVIEW_SECONDARY_SIZE = "size-14";

const MEDIA_TYPE_BADGE_CLASS: Record<NonNullable<IgPost["media_type"]>, string> = {
  short: "border-chart-3/30 bg-chart-3/10 text-chart-3-strong",
  carousel: "border-chart-4/30 bg-chart-4/15 text-foreground",
  static: "border-chart-5/30 bg-chart-5/10 text-foreground",
};

/**
 * Elevated results table with previews and color-coded Instagram metrics.
 */
export function IgPostsTable({
  username,
  posts,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange,
}: IgPostsTableProps) {
  const handleSort = (key: IgPostSortKey) => {
    if (sortKey === key) {
      onSortDirectionChange(sortDirection === "desc" ? "asc" : "desc");
      return;
    }

    onSortKeyChange(key);
    onSortDirectionChange("desc");
  };

  if (posts.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers />
          </EmptyMedia>
          <EmptyTitle>No posts match these filters</EmptyTitle>
          <EmptyDescription>
            Try another media type, or rescan this profile for a wider date range.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-40 pl-4">Preview</TableHead>
            <SortableTableHead
              label="Uploaded"
              columnKey="uploaded_at"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <TableHead>Type</TableHead>
            <SortableTableHead
              label="Length"
              columnKey="video_length_secs"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Views"
              columnKey="view_count"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Likes"
              columnKey="like_count"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Comments"
              columnKey="comment_count"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Saves"
              columnKey="save_count"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Shares"
              columnKey="share_count"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="ER"
              columnKey="er"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="wER"
              columnKey="weighted_er"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Save %"
              columnKey="save_rate"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Share %"
              columnKey="share_rate"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Cmt %"
              columnKey="comment_rate"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Like %"
              columnKey="like_rate"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Description"
              columnKey="description_length"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              className="min-w-52 pr-4"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <IgPostRow key={post.id} username={username} post={post} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface SortableTableHeadProps {
  label: string;
  columnKey: IgPostSortKey;
  sortKey: IgPostSortKey;
  sortDirection: "asc" | "desc";
  onSort: (key: IgPostSortKey) => void;
  className?: string;
}

/**
 * Clickable table header that toggles sort direction or switches the active sort column.
 */
function SortableTableHead({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = sortKey === columnKey;

  return (
    <TableHead
      className={className}
      aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {isActive ? (
          sortDirection === "desc" ? (
            <ArrowDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-3.5" aria-hidden="true" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

function IgPostRow({ username, post }: { username: string; post: IgPost }) {
  const metrics = getIgPostMetrics(post);
  const detailHref = `/ig/${username}/${post.id}`;

  return (
    <TableRow className="relative cursor-pointer hover:bg-accent/60 [&_td]:py-3">
      <TableCell className="pl-4">
        <Link
          href={detailHref}
          className="absolute inset-0 z-0"
          aria-label="Open post details"
          tabIndex={-1}
        />
        <div className="relative flex items-center gap-4">
          <Link
            href={detailHref}
            className="relative z-[1] shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open post details"
          >
            <PostPreview post={post} />
          </Link>
          <a
            href={post.post_url}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open on Instagram"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </TableCell>
      <TableCell className="pointer-events-none">
        <span className="text-sm">{formatUploadedAt(post.uploaded_at)}</span>
      </TableCell>
      <TableCell className="pointer-events-none">
        {post.media_type ? (
          <Badge variant="outline" className={MEDIA_TYPE_BADGE_CLASS[post.media_type]}>
            {MEDIA_TYPE_LABELS[post.media_type]}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Pending</span>
        )}
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgMetricBadge value={metrics.videoLength} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgPlainMetric value={formatCount(post.view_count)} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgPlainMetric value={formatCount(post.like_count)} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgPlainMetric value={formatCount(post.comment_count)} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgPlainMetric value={formatCount(post.save_count)} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgPlainMetric value={formatCount(post.share_count)} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgMetricBadge value={metrics.unweightedEr} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgMetricBadge value={metrics.weightedEr} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgMetricBadge value={metrics.saveRate} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgMetricBadge value={metrics.shareRate} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgMetricBadge value={metrics.commentRate} />
      </TableCell>
      <TableCell className="pointer-events-none">
        <IgMetricBadge value={metrics.likeRate} />
      </TableCell>
      <TableCell className="pointer-events-none max-w-56 pr-4">
        {post.description == null ? (
          <IgPlainMetric value={null} />
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm">{post.description}</p>
            <IgMetricBadge value={metrics.descriptionLengthScore} />
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function PostPreview({ post }: { post: IgPost }) {
  const isVideo = post.media_type === "short" || Boolean(post.video_embed_url);
  const isCarousel = post.media_type === "carousel";

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("relative overflow-hidden rounded-xl bg-muted shadow-xs", PREVIEW_PRIMARY_SIZE)}>
        <IgRemoteImage
          src={post.thumbnail_url ?? post.first_frame_url}
          alt=""
          className="size-full"
        />
        {isVideo ? (
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/25">
            <Play className="size-4 fill-background text-background" />
          </span>
        ) : null}
        {isCarousel ? (
          <span className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5">
            <Layers className="size-3" />
          </span>
        ) : null}
      </div>
      {post.first_frame_url && post.first_frame_url !== post.thumbnail_url ? (
        <div
          className={cn(
            "overflow-hidden rounded-lg bg-muted ring-1 ring-border",
            PREVIEW_SECONDARY_SIZE,
          )}
        >
          <IgRemoteImage src={post.first_frame_url} alt="" className="size-full" />
        </div>
      ) : null}
    </div>
  );
}
