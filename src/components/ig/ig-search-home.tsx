"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CopilotSearchBar } from "@/components/ig/copilot-search-bar";
import {
  ScrapeParamsDialog,
  type ScrapeParamsConfirmPayload,
} from "@/components/ig/scrape-params-dialog";
import { ScrapeHistory } from "@/components/ig/scrape-history";
import {
  dequeuePendingIgScrape,
  enqueuePendingIgScrape,
  readPendingIgScrapes,
  type PendingIgScrape,
} from "@/lib/ig/pending-scrapes";
import {
  groupScheduledScrapes,
  upsertScheduledScrape,
  type IgScrapeJob,
} from "@/lib/ig/groups";
import {
  instagramProfileUrl,
  parseIgSearchInput,
} from "@/lib/ig/parse-input";
import {
  getIgProfileByUsername,
  type IgProfile,
  type ScheduledScrape,
} from "@/lib/ig/queries";
import { scheduleIgScrape } from "@/lib/ig/schedule-scrape";
import { useIgScrapesRealtime } from "@/lib/ig/use-ig-scrapes-realtime";
import { createClient } from "@/lib/supabase/client";

interface IgSearchHomeProps {
  initialJobs: IgScrapeJob[];
}

/**
 * Home screen for searching Instagram profiles and scheduling scrapes.
 */
export function IgSearchHome({ initialJobs }: IgSearchHomeProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<IgProfile[]>(() =>
    initialJobs.map((job) => job.profile),
  );
  const [scrapes, setScrapes] = useState<ScheduledScrape[]>(() =>
    initialJobs.flatMap((job) => job.scrapes),
  );
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeDialog, setActiveDialog] = useState<PendingIgScrape | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const jobs = useMemo(
    () =>
      groupScheduledScrapes(
        scrapes,
        new Map(profiles.map((profile) => [profile.id, profile])),
      ),
    [profiles, scrapes],
  );

  const upsertProfile = useCallback((profile: IgProfile) => {
    setProfiles((current) => [profile, ...current.filter((row) => row.id !== profile.id)]);
  }, []);

  const upsertScrape = useCallback((scrape: ScheduledScrape) => {
    setScrapes((current) => upsertScheduledScrape(current, scrape));
  }, []);

  useIgScrapesRealtime({
    onScrapeInsert: upsertScrape,
    onScrapeUpdate: upsertScrape,
    onScrapeDelete: (scrape) => {
      setScrapes((current) => current.filter((row) => row.id !== scrape.id));
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

  const handleSearch = async () => {
    const parsed = parseIgSearchInput(query);
    if (!parsed) {
      toast.error("Enter a valid Instagram username or profile URL");
      return;
    }

    setIsSearching(true);

    try {
      const supabase = createClient();
      const existing = await getIgProfileByUsername(supabase, parsed.username);

      if (existing) {
        router.push(`/ig/${existing.ig_username}`);
        setQuery("");
        return;
      }

      if (parsed.isUrlInput) {
        setActiveDialog(parsed);
        setQuery("");
        return;
      }

      enqueuePendingIgScrape(parsed);
      window.open(instagramProfileUrl(parsed.username), "_blank", "noopener,noreferrer");
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
      });

      upsertProfile(job.profile);
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
            onSubmit={handleSearch}
            disabled={isSearching}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Global history
          </h2>
          <span className="text-sm text-muted-foreground">
            {jobs.length} {jobs.length === 1 ? "search" : "searches"}
          </span>
        </div>
        <ScrapeHistory jobs={jobs} />
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
