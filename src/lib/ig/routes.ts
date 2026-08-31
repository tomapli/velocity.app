export const IG_SCRAPES_PATH = "/settings/scrapes";

/** Page of one scrape (group) with its request pipeline. */
export function igScrapePath(groupId: string): string {
  return `${IG_SCRAPES_PATH}/${groupId}`;
}

export function igProfilePath(username: string): string {
  return `/ig/${username}`;
}
