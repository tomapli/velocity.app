import { buildIgScrapeJobs, type IgScrapeJob } from "@/lib/ig/groups";
import type { Group, IgProfile, ScheduledScrape } from "@/lib/ig/queries";

/** A profile with its most recent scrape, used by the home profile list. */
export interface IgProfileOverview {
  profile: IgProfile;
  latestJob: IgScrapeJob | null;
  scrapeCount: number;
}

/**
 * Groups scrapes under their profile and orders profiles by latest activity.
 */
export function buildIgProfileOverviews(
  profiles: IgProfile[],
  groups: Group[],
  scrapes: ScheduledScrape[],
): IgProfileOverview[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const jobsByProfile = new Map<string, IgScrapeJob[]>();

  // Jobs arrive newest first, so the first job per profile is the latest one.
  for (const job of buildIgScrapeJobs(groups, scrapes, profilesById)) {
    const current = jobsByProfile.get(job.profile.id) ?? [];
    current.push(job);
    jobsByProfile.set(job.profile.id, current);
  }

  return profiles
    .map((profile) => {
      const jobs = jobsByProfile.get(profile.id) ?? [];
      return {
        profile,
        latestJob: jobs[0] ?? null,
        scrapeCount: jobs.length,
      };
    })
    .sort((left, right) =>
      getOverviewActivityAt(right).localeCompare(getOverviewActivityAt(left)),
    );
}

export function getOverviewActivityAt(overview: IgProfileOverview): string {
  return overview.latestJob?.group.created_at ?? overview.profile.created_at;
}
