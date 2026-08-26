"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Instagram, LoaderCircle } from "lucide-react";

import { IgPostsTable } from "@/components/ig/ig-posts-table";
import { IgPostsAutoLoader } from "@/components/ig/ig-posts-auto-loader";
import { IgPostsToolbar } from "@/components/ig/ig-posts-toolbar";
import { ScrapeParamsDialog } from "@/components/ig/scrape-params-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  filterIgPostsByMediaType,
  postsToCsv,
  sortIgPosts,
  type IgMediaType,
  type IgPostSortKey,
} from "@/lib/ig/metrics";
import {
  buildIgScrapeJobs,
  getIgScrapeJobStatus,
  getJobErrorMessage,
  isIgScrapeJobStale,
  upsertGroup,
  upsertScheduledScrape,
  type IgScrapeJob,
  type IgScrapeStatus,
} from "@/lib/ig/groups";
import type {
  Group,
  IgAccountInsights,
  IgPostsPage,
  IgProfile,
  ScheduledScrape,
} from "@/lib/ig/queries";
import {
  getIgAccountInsightsForGroupPeriod,
  listIgPostsForProfile,
  listIgPostsPageForProfile,
} from "@/lib/ig/queries";
import { deduplicateIgPostsByShortcode } from "@/lib/ig/post-identity";
import { META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS } from "@/lib/meta/constants";
import { scheduleIgScrape } from "@/lib/ig/schedule-scrape";
import { useIgScrapesRealtime } from "@/lib/ig/use-ig-scrapes-realtime";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface IgProfilePageClientProps {
  username: string;
  initialJob: IgScrapeJob | null;
  initialPostsPage: IgPostsPage;
}

type PromptMode = "generate" | "regenerate" | null;

const STATUS_LABELS: Record<IgScrapeStatus, string> = {
  waiting: "Waiting",
  scraping: "Scraping",
  ready: "Ready",
  error: "Error",
};

const IgAccountInsightsPanel = dynamic(() =>
  import("@/components/ig/ig-account-insights").then(
    (module) => module.IgAccountInsightsPanel,
  ),
  { loading: AccountInsightsSkeleton },
);

/**
 * Instagram profile results: live scrape status, filters, and the posts table.
 */
export function IgProfilePageClient({
  username,
  initialJob,
  initialPostsPage,
}: IgProfilePageClientProps) {
  const [profile, setProfile] = useState<IgProfile | null>(initialJob?.profile ?? null);
  const [groups, setGroups] = useState<Group[]>(initialJob ? [initialJob.group] : []);
  const [scrapes, setScrapes] = useState<ScheduledScrape[]>(initialJob?.scrapes ?? []);
  const [posts, setPosts] = useState(initialPostsPage.posts);
  const [hasMorePosts, setHasMorePosts] = useState(initialPostsPage.hasMore);
  const [nextPostsOffset, setNextPostsOffset] = useState(initialPostsPage.nextOffset);
  const [accountInsights, setAccountInsights] = useState<IgAccountInsights[]>([]);
  const [promptMode, setPromptMode] = useState<PromptMode>(() =>
    resolveInitialPrompt(initialJob),
  );
  const [paramsDialogOpen, setParamsDialogOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingInsightsRange, setLoadingInsightsRange] = useState<number | null>(
    initialJob?.group.data_source === "meta_hybrid"
      ? META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS
      : null,
  );
  const [mediaTypes, setMediaTypes] = useState<IgMediaType[]>([]);
  const [sortKey, setSortKey] = useState<IgPostSortKey>("uploaded_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const supabase = useMemo(() => createClient(), []);

  const job = useMemo(() => {
    if (!profile) {
      return null;
    }

    return (
      buildIgScrapeJobs(groups, scrapes, new Map([[profile.id, profile]]))[0] ?? null
    );
  }, [groups, profile, scrapes]);

  const postsDataVersion = getPostsDataVersion(profile?.id ?? null, job);
  const insightsDataVersion = getInsightsDataVersion(job);
  const insightsGroupId =
    job?.group.data_source === "meta_hybrid" ? job.group.id : null;
  const loadedPostsDataVersion = useRef(
    getPostsDataVersion(initialJob?.profile.id ?? null, initialJob),
  );
  const loadedInsightsDataVersion = useRef("unloaded");
  const loadMoreRequestPending = useRef(false);

  const upsertScrape = useCallback(
    (next: ScheduledScrape) => {
      if (!groups.some((group) => group.id === next.group_id)) {
        return;
      }

      setScrapes((current) => upsertScheduledScrape(current, next));
    },
    [groups],
  );

  const upsertNextGroup = useCallback(
    (next: Group) => {
      if (profile && next.ig_profile_id !== profile.id) {
        return;
      }

      setGroups((current) => upsertGroup(current, next));
    },
    [profile],
  );

  useIgScrapesRealtime({
    onScrapeInsert: upsertScrape,
    onScrapeUpdate: upsertScrape,
    onScrapeDelete: (scrape) => {
      setScrapes((current) => current.filter((row) => row.id !== scrape.id));
    },
    onGroupInsert: upsertNextGroup,
    onGroupUpdate: upsertNextGroup,
    onGroupDelete: (group) => {
      setGroups((current) => current.filter((row) => row.id !== group.id));
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
    const profileId = profile?.id;
    if (!profileId) {
      setPosts([]);
      setHasMorePosts(false);
      setNextPostsOffset(0);
      return;
    }
    if (loadedPostsDataVersion.current === postsDataVersion) {
      return;
    }

    loadedPostsDataVersion.current = postsDataVersion;

    let cancelled = false;

    const load = async () => {
      try {
        const page = await listIgPostsPageForProfile(supabase, profileId);
        if (!cancelled) {
          setPosts(page.posts);
          setHasMorePosts(page.hasMore);
          setNextPostsOffset(page.nextOffset);
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
  }, [postsDataVersion, profile?.id, supabase]);

  useEffect(() => {
    if (!insightsGroupId) {
      setAccountInsights([]);
      setLoadingInsightsRange(null);
      return;
    }
    if (loadedInsightsDataVersion.current === insightsDataVersion) {
      return;
    }

    loadedInsightsDataVersion.current = insightsDataVersion;
    let cancelled = false;

    const load = async () => {
      try {
        const nextAccountInsights = await getIgAccountInsightsForGroupPeriod(
          supabase,
          insightsGroupId,
          META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
        );
        if (!cancelled && nextAccountInsights) {
          setAccountInsights((current) =>
            upsertAccountInsights(current, nextAccountInsights),
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Could not load account insights",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingInsightsRange(null);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [insightsDataVersion, insightsGroupId, supabase]);

  const handleInsightsRangeRequest = async (periodDays: number) => {
    if (
      !insightsGroupId ||
      loadingInsightsRange != null ||
      accountInsights.some((row) => row.period_days === periodDays)
    ) {
      return;
    }

    setLoadingInsightsRange(periodDays);
    try {
      const nextInsights = await getIgAccountInsightsForGroupPeriod(
        supabase,
        insightsGroupId,
        periodDays,
      );
      if (nextInsights) {
        setAccountInsights((current) => upsertAccountInsights(current, nextInsights));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load account insights",
      );
    } finally {
      setLoadingInsightsRange(null);
    }
  };

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
    dataSource: "public" | "meta_hybrid";
    metaInstagramAccountId: string | null;
  }) => {
    setIsScheduling(true);
    try {
      const created = await scheduleIgScrape({
        igUsername: username,
        requestedPostCount: payload.requestedPostCount,
        sinceWhen: payload.sinceWhen,
        dataSource: payload.dataSource,
        metaInstagramAccountId: payload.metaInstagramAccountId,
      });

      setProfile(created.profile);
      setGroups([created.group]);
      setScrapes(created.scrapes);
      setPosts([]);
      setHasMorePosts(false);
      setNextPostsOffset(0);
      setAccountInsights([]);
      setLoadingInsightsRange(
        created.group.data_source === "meta_hybrid"
          ? META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS
          : null,
      );
      setParamsDialogOpen(false);
      toast.success(`Scheduled @${username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule scrape");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (
      !profile ||
      !hasMorePosts ||
      loadMoreRequestPending.current
    ) {
      return;
    }

    loadMoreRequestPending.current = true;
    setIsLoadingMore(true);
    try {
      const page = await listIgPostsPageForProfile(
        supabase,
        profile.id,
        nextPostsOffset,
      );
      setPosts((current) => mergePosts(current, page.posts));
      setHasMorePosts(page.hasMore);
      setNextPostsOffset(page.nextOffset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load more posts");
    } finally {
      loadMoreRequestPending.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMorePosts, nextPostsOffset, profile, supabase]);

  const handleExport = async () => {
    if (!profile || isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const exportPosts = hasMorePosts
        ? await listIgPostsForProfile(supabase, profile.id)
        : posts;
      const visibleExportPosts = sortIgPosts(
        filterIgPostsByMediaType(exportPosts, mediaTypes),
        sortKey,
        sortDirection,
      );
      const csv = postsToCsv(visibleExportPosts, {
        dataSource: job?.group.data_source,
        accountInsights:
          accountInsights.find(
            (row) => row.period_days === META_ACCOUNT_INSIGHTS_DEFAULT_RANGE_DAYS,
          ) ??
          accountInsights.at(-1) ??
          null,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${username}-ig-posts.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export posts");
    } finally {
      setIsExporting(false);
    }
  };

  const isBusy = status === "waiting" || status === "scraping";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`@${username}`}
        description={profile?.ig_name ?? profile?.description ?? "Instagram profile results"}
        count={{
          value: visiblePosts.length,
          label: hasMorePosts
            ? visiblePosts.length === 1
              ? "loaded post"
              : "loaded posts"
            : visiblePosts.length === 1
              ? "post"
              : "posts",
        }}
        action={
          <div className="flex items-center gap-2">
            {job ? (
              <Badge variant="outline">
                {job.group.data_source === "meta_hybrid"
                  ? "Meta + public data"
                  : "Public data"}
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn(STATUS_BADGE_CLASSES[status])}>
              {isBusy ? <LoaderCircle className="size-3 animate-spin" /> : null}
              {STATUS_LABELS[status]}
            </Badge>
          </div>
        }
      />

      <IgPostsToolbar
        mediaTypes={mediaTypes}
        onMediaTypesChange={setMediaTypes}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortKeyChange={setSortKey}
        onSortDirectionChange={setSortDirection}
        onRescan={() => setParamsDialogOpen(true)}
        onExport={() => void handleExport()}
        canExport={posts.length > 0}
        isExporting={isExporting}
        isRescanning={isScheduling}
      />

      {loadingInsightsRange != null && accountInsights.length === 0 ? (
        <AccountInsightsSkeleton />
      ) : accountInsights.length > 0 ? (
        <IgAccountInsightsPanel
          insights={accountInsights}
          loadingRangeDays={loadingInsightsRange}
          onRangeRequest={(periodDays) => void handleInsightsRangeRequest(periodDays)}
          isRefreshing={job?.scrapes.some(
            (scrape) => scrape.scrape_type === "meta" && !scrape.finished_at,
          )}
        />
      ) : null}

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
        <IgPostsTable
          username={username}
          posts={visiblePosts}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortKeyChange={setSortKey}
          onSortDirectionChange={setSortDirection}
        />
      )}

      {hasMorePosts && posts.length > 0 ? (
        <IgPostsAutoLoader
          hasMore={hasMorePosts}
          isLoading={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      ) : null}

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

function getPostsDataVersion(
  profileId: string | null,
  job: IgScrapeJob | null,
): string {
  const finishedRuns = job?.scrapes
    .filter((scrape) => scrape.scrape_type !== "meta")
    .map((scrape) => `${scrape.id}:${scrape.finished_at ?? "pending"}`)
    .sort()
    .join(",") ?? "";

  return `${profileId ?? "none"}:${job?.group.id ?? "none"}:${finishedRuns}`;
}

function getInsightsDataVersion(job: IgScrapeJob | null): string {
  const finishedRuns = job?.scrapes
    .filter((scrape) => scrape.scrape_type === "meta")
    .map((scrape) => `${scrape.id}:${scrape.finished_at ?? "pending"}`)
    .sort()
    .join(",") ?? "";

  return `${job?.group.id ?? "none"}:${finishedRuns}`;
}

function mergePosts(
  current: IgPostsPage["posts"],
  next: IgPostsPage["posts"],
): IgPostsPage["posts"] {
  return deduplicateIgPostsByShortcode([...current, ...next]);
}

function upsertAccountInsights(
  current: IgAccountInsights[],
  next: IgAccountInsights,
): IgAccountInsights[] {
  return [
    ...current.filter((row) => row.period_days !== next.period_days),
    next,
  ].sort((left, right) => left.period_days - right.period_days);
}

function AccountInsightsSkeleton() {
  return (
    <section className="space-y-4" aria-label="Loading account insights">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-lg" />
        ))}
      </div>
    </section>
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
