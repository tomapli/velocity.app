"use client";

import Link from "next/link";
import { ExternalLink, Layers, Play } from "lucide-react";

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
} from "@/lib/ig/metrics";
import type { IgPost } from "@/lib/ig/queries";
import { cn } from "@/lib/utils";

interface IgPostsTableProps {
  username: string;
  posts: IgPost[];
}

const MEDIA_TYPE_BADGE_CLASS: Record<NonNullable<IgPost["media_type"]>, string> = {
  short: "border-chart-3/30 bg-chart-3/10 text-chart-3-strong",
  carousel: "border-chart-4/30 bg-chart-4/15 text-foreground",
  static: "border-chart-5/30 bg-chart-5/10 text-foreground",
};

/**
 * Elevated results table with previews and color-coded Instagram metrics.
 */
export function IgPostsTable({ username, posts }: IgPostsTableProps) {
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
            <TableHead>Uploaded</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Length</TableHead>
            <TableHead>Views</TableHead>
            <TableHead>Likes</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead>Saves</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>ER</TableHead>
            <TableHead>wER</TableHead>
            <TableHead>Save %</TableHead>
            <TableHead>Share %</TableHead>
            <TableHead>Cmt %</TableHead>
            <TableHead>Like %</TableHead>
            <TableHead className="min-w-52">Description</TableHead>
            <TableHead className="pr-4">Link</TableHead>
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

function IgPostRow({ username, post }: { username: string; post: IgPost }) {
  const metrics = getIgPostMetrics(post);
  const detailHref = `/ig/${username}/${post.id}`;

  return (
    <TableRow className="relative hover:bg-accent/60">
      <TableCell className="pl-4">
        <Link
          href={detailHref}
          className="absolute inset-0 z-0"
          aria-label="Open post details"
        />
        <div className="relative z-10">
          <PostPreview post={post} />
        </div>
      </TableCell>
      <TableCell>
        <span className="relative z-10 text-sm">{formatUploadedAt(post.uploaded_at)}</span>
      </TableCell>
      <TableCell>
        {post.media_type ? (
          <Badge variant="outline" className={MEDIA_TYPE_BADGE_CLASS[post.media_type]}>
            {MEDIA_TYPE_LABELS[post.media_type]}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Pending</span>
        )}
      </TableCell>
      <TableCell>
        <IgMetricBadge value={metrics.videoLength} />
      </TableCell>
      <TableCell>
        <IgPlainMetric value={formatCount(post.view_count)} />
      </TableCell>
      <TableCell>
        <IgPlainMetric value={formatCount(post.like_count)} />
      </TableCell>
      <TableCell>
        <IgPlainMetric value={formatCount(post.comment_count)} />
      </TableCell>
      <TableCell>
        <IgPlainMetric value={formatCount(post.save_count)} />
      </TableCell>
      <TableCell>
        <IgPlainMetric value={formatCount(post.share_count)} />
      </TableCell>
      <TableCell>
        <IgMetricBadge value={metrics.unweightedEr} />
      </TableCell>
      <TableCell>
        <IgMetricBadge value={metrics.weightedEr} />
      </TableCell>
      <TableCell>
        <IgMetricBadge value={metrics.saveRate} />
      </TableCell>
      <TableCell>
        <IgMetricBadge value={metrics.shareRate} />
      </TableCell>
      <TableCell>
        <IgMetricBadge value={metrics.commentRate} />
      </TableCell>
      <TableCell>
        <IgMetricBadge value={metrics.likeRate} />
      </TableCell>
      <TableCell className="max-w-56">
        {post.description == null ? (
          <IgPlainMetric value={null} />
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm">{post.description}</p>
            <IgMetricBadge value={metrics.descriptionLengthScore} />
          </div>
        )}
      </TableCell>
      <TableCell className="pr-4">
        <a
          href={post.post_url}
          target="_blank"
          rel="noreferrer"
          className="relative z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open on Instagram"
        >
          <ExternalLink className="size-4" />
        </a>
      </TableCell>
    </TableRow>
  );
}

function PostPreview({ post }: { post: IgPost }) {
  const isVideo = post.media_type === "short" || Boolean(post.video_embed_url);
  const isCarousel = post.media_type === "carousel";

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative size-16 overflow-hidden rounded-xl bg-muted shadow-xs">
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
            "size-12 overflow-hidden rounded-lg bg-muted ring-1 ring-border",
          )}
        >
          <IgRemoteImage src={post.first_frame_url} alt="" className="size-full" />
        </div>
      ) : null}
    </div>
  );
}
