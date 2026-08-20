import Link from "next/link";
import { ArrowLeft, ExternalLink, Layers } from "lucide-react";

import { IgMetricBadge, IgToneSurface } from "@/components/ig/ig-metric-badge";
import { IgRemoteImage } from "@/components/ig/ig-remote-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  formatCount,
  formatUploadedAt,
  getIgPostMetrics,
  MEDIA_TYPE_LABELS,
  type ScoredValue,
} from "@/lib/ig/metrics";
import type { IgPost, IgProfile } from "@/lib/ig/queries";

interface IgPostDetailProps {
  username: string;
  profile: IgProfile | null;
  post: IgPost;
}

/**
 * Full metric breakdown for a single Instagram post, including media previews.
 */
export function IgPostDetail({ username, profile, post }: IgPostDetailProps) {
  const metrics = getIgPostMetrics(post);
  const mediaAspectClass = post.media_type === "short" ? "aspect-[9/16]" : "aspect-square";
  const scored = [
    { label: "Video length", value: metrics.videoLength, hint: "Entertainment 5–40s · educational 25–60s" },
    { label: "Description length", value: metrics.descriptionLengthScore, hint: "≈ 300–700 characters" },
    { label: "ER", value: metrics.unweightedEr, hint: "Unweighted IG target ≥ 5%" },
    { label: "Weighted ER", value: metrics.weightedEr, hint: "(saves×4 + shares×3 + comments×2 + likes) ÷ views" },
    { label: "Save rate", value: metrics.saveRate, hint: "IG + TikTok target ≥ 2%" },
    { label: "Share rate", value: metrics.shareRate, hint: "Target ≥ 2%" },
    { label: "Comment rate", value: metrics.commentRate, hint: null },
    { label: "Like rate", value: metrics.likeRate, hint: null },
  ].filter((item): item is { label: string; value: ScoredValue; hint: string | null } => item.value != null);

  const counts = [
    { label: "Views", value: formatCount(post.view_count) },
    { label: "Likes", value: formatCount(post.like_count) },
    { label: "Comments", value: formatCount(post.comment_count) },
    { label: "Saves", value: formatCount(post.save_count) },
    { label: "Shares", value: formatCount(post.share_count) },
  ].filter((item) => item.value != null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/ig/${username}`}>
            <ArrowLeft />
            Back to @{username}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={post.post_url} target="_blank" rel="noreferrer">
            <ExternalLink />
            Open on Instagram
          </a>
        </Button>
      </div>

      <PageHeader
        title={formatUploadedAt(post.uploaded_at)}
        description={profile?.ig_name ? `${profile.ig_name} · @${username}` : `@${username}`}
        action={
          <Badge variant="outline">
            {post.media_type === "carousel" ? <Layers className="size-3" /> : null}
            {post.media_type ? MEDIA_TYPE_LABELS[post.media_type] : "Unknown"}
          </Badge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {post.video_embed_url ? (
          <MediaTile
            label="Video"
            aspectClass={mediaAspectClass}
            videoSrc={post.video_embed_url}
            poster={post.thumbnail_url ?? post.first_frame_url ?? undefined}
          />
        ) : (
          <MediaTile
            label="Preview"
            src={post.thumbnail_url ?? post.first_frame_url}
            aspectClass={post.media_type === "short" ? "aspect-[9/16]" : "aspect-[4/5]"}
          />
        )}
        {post.thumbnail_url ? (
          <MediaTile label="Thumbnail" src={post.thumbnail_url} aspectClass={mediaAspectClass} />
        ) : null}
        {post.first_frame_url ? (
          <MediaTile label="First frame" src={post.first_frame_url} aspectClass={mediaAspectClass} />
        ) : null}
        {post.carousel_image_urls?.map((url, index) => (
          <MediaTile
            key={url}
            label={`Slide ${index + 1}`}
            src={url}
            aspectClass={mediaAspectClass}
          />
        ))}
      </div>

      {counts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {counts.map((item) => (
            <Card key={item.label} className="rounded-2xl shadow-sm">
              <CardHeader className="px-4 py-0">
                <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <p className="font-heading text-2xl tabular-nums">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {scored.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {scored.map((item) => (
            <IgToneSurface key={item.label} tone={item.value.tone} className="space-y-1">
              <p className="text-xs font-medium tracking-wide uppercase opacity-80">{item.label}</p>
              <p className="font-heading text-2xl tabular-nums">{item.value.formatted}</p>
              {item.hint ? <p className="text-xs opacity-80">{item.hint}</p> : null}
              {item.value.targetLabel ? (
                <p className="text-xs opacity-80">Target {item.value.targetLabel}</p>
              ) : null}
            </IgToneSurface>
          ))}
        </div>
      ) : null}

      {post.description != null ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              Description
              <IgMetricBadge value={metrics.descriptionLengthScore} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.description}</p>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Predictive hook/body scores and comment quality are omitted until those fields exist
        in the scrape.
      </p>
    </div>
  );
}

function MediaTile({
  label,
  src,
  aspectClass,
  videoSrc,
  poster,
}: {
  label: string;
  aspectClass: string;
  src?: string | null;
  videoSrc?: string;
  poster?: string;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {videoSrc ? (
        <video
          src={videoSrc}
          controls
          playsInline
          poster={poster}
          className={`${aspectClass} w-full object-cover`}
        >
          <track kind="captions" />
        </video>
      ) : (
        <IgRemoteImage src={src ?? null} alt="" className={`${aspectClass} w-full`} />
      )}
      <figcaption className="px-3 py-2 text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
