"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Globe, Lock, Settings } from "lucide-react";

import { ScrapeGroupList } from "@/components/ig/scrape-group-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  buildIgScrapeJobs,
  upsertGroup,
  upsertScheduledScrape,
} from "@/lib/ig/groups";
import type {
  Group,
  IgProfile,
  IgScrapeSnapshot,
  ScheduledScrape,
} from "@/lib/ig/queries";
import { useIgScrapesRealtime } from "@/lib/ig/use-ig-scrapes-realtime";

interface ScrapesManagerProps {
  initialSnapshot: IgScrapeSnapshot;
}

/**
 * Live overview of every scrape (group) and the requests each one sends.
 */
export function ScrapesManager({ initialSnapshot }: ScrapesManagerProps) {
  const [groups, setGroups] = useState<Group[]>(initialSnapshot.groups);
  const [scrapes, setScrapes] = useState<ScheduledScrape[]>(initialSnapshot.scrapes);
  const [profiles, setProfiles] = useState<IgProfile[]>(initialSnapshot.profiles);

  const jobs = useMemo(
    () =>
      buildIgScrapeJobs(
        groups,
        scrapes,
        new Map(profiles.map((profile) => [profile.id, profile])),
      ),
    [groups, profiles, scrapes],
  );

  const upsertScrape = useCallback((scrape: ScheduledScrape) => {
    setScrapes((current) => upsertScheduledScrape(current, scrape));
  }, []);
  const upsertNextGroup = useCallback((group: Group) => {
    setGroups((current) => upsertGroup(current, group));
  }, []);
  const upsertProfile = useCallback((profile: IgProfile) => {
    setProfiles((current) => [profile, ...current.filter((row) => row.id !== profile.id)]);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scrapes"
        description="Every scheduled scrape and the requests it sends to Apify and the Meta API, updated live."
        count={{ value: jobs.length, label: jobs.length === 1 ? "scrape" : "scrapes" }}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings/meta">
              <Settings />
              Meta connections
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4 text-muted-foreground" />
              Public data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              Two Apify listing requests (posts and reels) collect the profile
              overview first.
            </p>
            <p>
              Once both settle, post-details requests enrich the listed posts in
              batches until the requested count or date is reached.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-muted-foreground" />
              Private data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              Meta + public scrapes add one Meta insights request that runs as
              small queued steps: media, then profile, then account insights.
            </p>
            <p>
              Failed steps retry automatically; opening a profile refreshes its
              insights when they are older than an hour.
            </p>
          </CardContent>
        </Card>
      </div>

      <ScrapeGroupList jobs={jobs} />
    </div>
  );
}
