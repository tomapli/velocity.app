export const SOCIALBLADE_ACTOR_LABEL = "dami_studio/socialblade-scraper";

export const IG_ACCOUNT_SOURCES = ["none", "meta", "socialblade"] as const;

export interface IgAccountSourceSelection {
  accountSource: (typeof IG_ACCOUNT_SOURCES)[number];
}

export const IG_ACCOUNT_SOURCE_LABELS = {
  none: "Skip account data",
  meta: "Meta",
  socialblade: "SocialBlade",
} as const;

export const IG_ACCOUNT_SOURCE_DESCRIPTIONS = {
  none: "Collect public posts only.",
  meta: "Account insights through the Meta account selected in step 1.",
  socialblade: "Public account statistics. Instagram growth and daily history are unavailable.",
} as const;
