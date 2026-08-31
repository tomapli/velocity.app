"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, Settings } from "lucide-react";
import { toast } from "sonner";

import { CopilotSearchBar } from "@/components/ig/copilot-search-bar";
import { Button } from "@/components/ui/button";
import {
  ScrapeParamsDialog,
  type ScrapeParamsConfirmPayload,
} from "@/components/ig/scrape-params-dialog";
import { IgProfileList } from "@/components/ig/ig-profile-list";
import {
  dequeuePendingIgScrape,
  enqueuePendingIgScrape,
  readPendingIgScrapes,
  type PendingIgScrape,
} from "@/lib/ig/pending-scrapes";
import { upsertGroup, upsertScheduledScrape } from "@/lib/ig/groups";
import { instagramProfileUrl } from "@/lib/ig/parse-input";
import { buildIgProfileOverviews } from "@/lib/ig/profile-overviews";
import {
  getIgProfileByUsername,
  type Group,
  type IgProfile,
  type IgScrapeSnapshot,
  type ScheduledScrape,
} from "@/lib/ig/queries";
import { scheduleIgScrape } from "@/lib/ig/schedule-scrape";
import type { IgSearchOption } from "@/lib/ig/search-options";
import { useIgScrapesRealtime } from "@/lib/ig/use-ig-scrapes-realtime";
import { createClient } from "@/lib/supabase/client";

interface IgSearchHomeProps {
  initialSnapshot: IgScrapeSnapshot;
}

/**
 * Home screen for searching Instagram profiles and scheduling scrapes.
 */
export function IgSearchHome({ initialSnapshot }: IgSearchHomeProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(initialSnapshot.groups);
  const [profiles, setProfiles] = useState<IgProfile[]>(initialSnapshot.profiles);
  const [scrapes, setScrapes] = useState<ScheduledScrape[]>(initialSnapshot.scrapes);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeDialog, setActiveDialog] = useState<PendingIgScrape | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const overviews = useMemo(
    () => buildIgProfileOverviews(profiles, groups, scrapes),
    [groups, profiles, scrapes],
  );

  const upsertProfile = useCallback((profile: IgProfile) => {
    setProfiles((current) => [profile, ...current.filter((row) => row.id !== profile.id)]);
  }, []);

  const upsertScrape = useCallback((scrape: ScheduledScrape) => {
    setScrapes((current) => upsertScheduledScrape(current, scrape));
  }, []);

  const upsertNextGroup = useCallback((group: Group) => {
    setGroups((current) => upsertGroup(current, group));
  }, []);

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
    onProfileInsert: upsertProfile,
    onProfileUpdate: upsertProfile,
    onProfileDelete: (profile) => {
      setProfiles((current) => current.filter((row) => row.id !== profile.id));
    },
  });

  const openNextPendingDialog = useCallback(() => {
    const [next] = readPendingIgScrapes();
    if (next) {
      setActiveDialog(next);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        openNextPendingDialog();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [openNextPendingDialog]);

  const handleSelect = async (option: IgSearchOption) => {
    setIsSearching(true);

    try {
      if (option.kind === "existing") {
        router.push(`/ig/${option.username}`);
        setQuery("");
        return;
      }

      const supabase = createClient();
      const existing = await getIgProfileByUsername(supabase, option.username);

      if (existing) {
        router.push(`/ig/${existing.ig_username}`);
        setQuery("");
        return;
      }

      const pending = {
        username: option.username,
        isUrlInput: option.isUrlInput,
      };

      enqueuePendingIgScrape(pending);
      window.open(instagramProfileUrl(option.username), "_blank", "noopener,noreferrer");
      setQuery("");
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmScrape = async (payload: ScrapeParamsConfirmPayload) => {
    if (!activeDialog) {
      return;
    }

    setIsScheduling(true);
    try {
      const job = await scheduleIgScrape({
        igUsername: activeDialog.username,
        requestedPostCount: payload.requestedPostCount,
        sinceWhen: payload.sinceWhen,
        dataSource: payload.dataSource,
        metaInstagramAccountId: payload.metaInstagramAccountId,
      });

      upsertProfile(job.profile);
      upsertNextGroup(job.group);
      setScrapes((current) =>
        job.scrapes.reduce(upsertScheduledScrape, current),
      );
      dequeuePendingIgScrape(activeDialog.username);
      setActiveDialog(null);
      openNextPendingDialog();
      toast.success(`Scheduled @${activeDialog.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule scrape");
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-10 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-2xl space-y-3 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Instagram stats
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Search a profile, confirm how much to collect, and watch progress live.
        </p>
        <div className="pt-2">
          <CopilotSearchBar
            value={query}
            onChange={setQuery}
            onSelect={handleSelect}
            profiles={profiles}
            disabled={isSearching}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Profiles
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {overviews.length} {overviews.length === 1 ? "profile" : "profiles"}
            </span>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/scrapes"><ListChecks />Manage scrapes</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/meta"><Settings />Meta connections</Link>
            </Button>
          </div>
        </div>
        <IgProfileList overviews={overviews} />
      </section>

      <ScrapeParamsDialog
        open={activeDialog != null}
        onOpenChange={(open) => {
          if (!open) {
            if (activeDialog) {
              dequeuePendingIgScrape(activeDialog.username);
            }
            setActiveDialog(null);
            openNextPendingDialog();
          }
        }}
        username={activeDialog?.username ?? ""}
        isUrlInput={activeDialog?.isUrlInput ?? false}
        isSubmitting={isScheduling}
        onConfirm={handleConfirmScrape}
      />
    </div>
  );
}
