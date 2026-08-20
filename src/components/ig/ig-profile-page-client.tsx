"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Instagram, LoaderCircle } from "lucide-react";

import { IgPostsTable } from "@/components/ig/ig-posts-table";
import { IgPostsToolbar } from "@/components/ig/ig-posts-toolbar";
import { ScrapeParamsDialog } from "@/components/ig/scrape-params-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import {
  filterIgPostsByMediaType,
  postsToCsv,
  sortIgPosts,
  type IgMediaType,
  type IgPostSortKey,
} from "@/lib/ig/metrics";
import {
  getIgScrapeJobStatus,
  getJobErrorMessage,
  groupScheduledScrapes,
  isIgScrapeJobStale,
  upsertScheduledScrape,
  type IgScrapeJob,
  type IgScrapeStatus,
} from "@/lib/ig/groups";
import type { IgPost, IgProfile, ScheduledScrape } from "@/lib/ig/queries";
import { listIgPostsForProfile } from "@/lib/ig/queries";
import { scheduleIgScrape } from "@/lib/ig/schedule-scrape";
import { useIgScrapesRealtime } from "@/lib/ig/use-ig-scrapes-realtime";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface IgProfilePageClientProps {
  username: string;
  initialJob: IgScrapeJob | null;
  initialPosts: IgPost[];
}

type PromptMode = "generate" | "regenerate" | null;

const STATUS_LABELS: Record<IgScrapeStatus, string> = {
  waiting: "Waiting",
  scraping: "Scraping",
  ready: "Ready",
  error: "Error",
};

/**
 * Instagram profile results: live scrape status, filters, and the posts table.
 */
export function IgProfilePageClient({
  username,
  initialJob,
  initialPosts,
}: IgProfilePageClientProps) {
  const [profile, setProfile] = useState<IgProfile | null>(initialJob?.profile ?? null);
  const [scrapes, setScrapes] = useState<ScheduledScrape[]>(initialJob?.scrapes ?? []);
  const [posts, setPosts] = useState<IgPost[]>(initialPosts);
  const [promptMode, setPromptMode] = useState<PromptMode>(() =>
    resolveInitialPrompt(initialJob),
  );
  const [paramsDialogOpen, setParamsDialogOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [mediaTypes, setMediaTypes] = useState<IgMediaType[]>([]);
  const [sortKey, setSortKey] = useState<IgPostSortKey>("uploaded_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const job = useMemo(() => {
    if (!profile) {
      return null;
    }

    return (
      groupScheduledScrapes(scrapes, new Map([[profile.id, profile]]))[0] ?? null
    );
  }, [profile, scrapes]);

  const upsertScrape = useCallback(
    (next: ScheduledScrape) => {
      if (profile && next.ig_profile_id !== profile.id) {
        return;
      }

      setScrapes((current) => upsertScheduledScrape(current, next));
    },
    [profile],
  );

  useIgScrapesRealtime({
    onScrapeInsert: upsertScrape,
    onScrapeUpdate: upsertScrape,
    onScrapeDelete: (scrape) => {
      setScrapes((current) => current.filter((row) => row.id !== scrape.id));
    },
    onProfileUpdate: (next) => {
      if (next.ig_username !== username) {
        return;
      }
      setProfile(next);
    },
    onProfileInsert: (next) => {
      if (next.ig_username === username) {
        setProfile(next);
      }
    },
  });

  useEffect(() => {
    if (!profile) {
      setPosts([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const load = async () => {
      try {
        const nextPosts = await listIgPostsForProfile(supabase, profile.id);
        if (!cancelled) {
          setPosts(nextPosts);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load posts");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [profile, job]);

  const status = job ? getIgScrapeJobStatus(job) : "waiting";
  const visiblePosts = useMemo(
    () => sortIgPosts(filterIgPostsByMediaType(posts, mediaTypes), sortKey, sortDirection),
    [mediaTypes, posts, sortDirection, sortKey],
  );

  const handlePromptConfirm = () => {
    setPromptMode(null);
    setParamsDialogOpen(true);
  };

  const handleSchedule = async (payload: {
    requestedPostCount: number | null;
    sinceWhen: string | null;
  }) => {
    setIsScheduling(true);
    try {
      const created = await scheduleIgScrape({
        igUsername: username,
        requestedPostCount: payload.requestedPostCount,
        sinceWhen: payload.sinceWhen,
      });

      setProfile(created.profile);
      setScrapes(created.scrapes);
      setPosts([]);
      setParamsDialogOpen(false);
      toast.success(`Scheduled @${username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule scrape");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleExport = () => {
    const csv = postsToCsv(visiblePosts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${username}-ig-posts.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isBusy = status === "waiting" || status === "scraping";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`@${username}`}
        description={profile?.ig_name ?? profile?.description ?? "Instagram profile results"}
        count={{ value: visiblePosts.length, label: visiblePosts.length === 1 ? "post" : "posts" }}
        action={
          <Badge variant="outline" className={cn(STATUS_BADGE_CLASSES[status])}>
            {isBusy ? <LoaderCircle className="size-3 animate-spin" /> : null}
            {STATUS_LABELS[status]}
          </Badge>
        }
      />

      <section className="flex items-center gap-4">
        <Avatar size="xl" className="rounded-2xl">
          {profile?.profile_picture_url ? (
            <AvatarImage src={profile.profile_picture_url} alt="" />
          ) : null}
          <AvatarFallback className="rounded-2xl">
            {username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          {profile?.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{profile.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Color-coded against Instagram engagement targets (ER ≥ 5%, weighted ER ≥ 10%).
            </p>
          )}
        </div>
      </section>

      <IgPostsToolbar
        mediaTypes={mediaTypes}
        onMediaTypesChange={setMediaTypes}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortKeyChange={setSortKey}
        onSortDirectionChange={setSortDirection}
        onRescan={() => setParamsDialogOpen(true)}
        onExport={handleExport}
        canExport={visiblePosts.length > 0}
        isRescanning={isScheduling}
      />

      {posts.length === 0 && isBusy ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LoaderCircle className="animate-spin" />
            </EmptyMedia>
            <EmptyTitle>
              {status === "waiting" ? "Scrape is queued" : "Scraping posts"}
            </EmptyTitle>
            <EmptyDescription>
              Results appear here as soon as the run finishes. You can already set a new rescan.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : posts.length === 0 && status === "error" ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Instagram />
            </EmptyMedia>
            <EmptyTitle>This scrape failed</EmptyTitle>
            <EmptyDescription>{getJobErrorMessage(job!) ?? "Try a rescan."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : posts.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Instagram />
            </EmptyMedia>
            <EmptyTitle>No posts yet</EmptyTitle>
            <EmptyDescription>
              Generate a scrape to load this profile&apos;s posts into the table.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <IgPostsTable username={username} posts={visiblePosts} />
      )}

      <Dialog open={promptMode != null} onOpenChange={(open) => !open && setPromptMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {promptMode === "regenerate" ? "Regenerate data?" : "Generate data?"}
            </DialogTitle>
            <DialogDescription>
              {promptMode === "regenerate"
                ? `The latest data for @${username} is older than 3 days.`
                : `No scrape data exists yet for @${username}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPromptMode(null)}>
              Not now
            </Button>
            <Button type="button" onClick={handlePromptConfirm}>
              {promptMode === "regenerate" ? "Regenerate" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrapeParamsDialog
        open={paramsDialogOpen}
        onOpenChange={setParamsDialogOpen}
        username={username}
        isUrlInput={false}
        isSubmitting={isScheduling}
        onConfirm={handleSchedule}
      />
    </div>
  );
}

function resolveInitialPrompt(job: IgScrapeJob | null): PromptMode {
  if (!job) {
    return "generate";
  }

  const status = getIgScrapeJobStatus(job);
  if (status === "ready" && isIgScrapeJobStale(job)) {
    return "regenerate";
  }

  return null;
}

const STATUS_BADGE_CLASSES: Record<IgScrapeStatus, string> = {
  waiting: "border-muted-foreground/30 text-muted-foreground",
  scraping: "border-info/40 bg-info/10 text-info-foreground",
  ready: "border-success/40 bg-success/10 text-success-strong",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};
