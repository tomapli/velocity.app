import { normalizeIgUsername, parseIgSearchInput } from "@/lib/ig/parse-input";

export interface IgSearchProfileOption {
  ig_username: string;
  ig_name: string | null;
}

export type IgSearchOption =
  | {
      id: string;
      kind: "new";
      username: string;
      isUrlInput: boolean;
    }
  | {
      id: string;
      kind: "existing";
      username: string;
      displayName: string | null;
      exact: boolean;
    };

/**
 * Builds typeahead options for Instagram search input.
 * The first option is either an exact existing profile or a "new" search target.
 */
export function buildIgSearchOptions(
  query: string,
  profiles: IgSearchProfileOption[],
): IgSearchOption[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return uniqueByUsername(profiles).map((profile) => ({
      id: `existing:${profile.ig_username}`,
      kind: "existing",
      username: profile.ig_username,
      displayName: profile.ig_name,
      exact: false,
    }));
  }

  const parsed = parseIgSearchInput(trimmed);
  const needle = parsed?.username ?? normalizeIgUsername(trimmed);
  const uniqueProfiles = uniqueByUsername(profiles);

  const exact = parsed
    ? uniqueProfiles.find((profile) => profile.ig_username === parsed.username)
    : undefined;

  const partialMatches = uniqueProfiles.filter((profile) => {
    if (exact && profile.ig_username === exact.ig_username) {
      return false;
    }

    return profileMatchesNeedle(profile, needle);
  });

  const options: IgSearchOption[] = [];

  if (parsed) {
    if (exact) {
      options.push({
        id: `existing:${exact.ig_username}`,
        kind: "existing",
        username: exact.ig_username,
        displayName: exact.ig_name,
        exact: true,
      });
    } else {
      options.push({
        id: `new:${parsed.username}`,
        kind: "new",
        username: parsed.username,
        isUrlInput: parsed.isUrlInput,
      });
    }
  }

  for (const profile of partialMatches) {
    options.push({
      id: `existing:${profile.ig_username}`,
      kind: "existing",
      username: profile.ig_username,
      displayName: profile.ig_name,
      exact: false,
    });
  }

  return options;
}

function uniqueByUsername(
  profiles: IgSearchProfileOption[],
): IgSearchProfileOption[] {
  const seen = new Set<string>();
  const unique: IgSearchProfileOption[] = [];

  for (const profile of profiles) {
    if (seen.has(profile.ig_username)) {
      continue;
    }

    seen.add(profile.ig_username);
    unique.push(profile);
  }

  return unique;
}

function profileMatchesNeedle(
  profile: IgSearchProfileOption,
  needle: string,
): boolean {
  if (!needle) {
    return false;
  }

  if (profile.ig_username.includes(needle)) {
    return true;
  }

  const name = profile.ig_name?.toLowerCase() ?? "";
  return name.includes(needle);
}
