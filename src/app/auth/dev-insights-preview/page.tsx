// Temporary fixture page for visually verifying IgAccountInsightsPanel.
import { IgAccountInsightsPanel } from "@/components/ig/ig-account-insights";
import { PageShell } from "@/components/ui/page-shell";
import type { IgAccountInsights } from "@/lib/ig/queries";
import type { Json } from "@/lib/supabase/database.types";

function makeRow(periodDays: number, metrics: Json): IgAccountInsights {
  return {
    id: `insights-${periodDays}`,
    ig_profile_id: "profile-1",
    group_id: "group-1",
    period_days: periodDays,
    period_start: "2026-02-27T00:00:00Z",
    period_end: "2026-08-26T00:00:00Z",
    metrics,
    captured_at: "2026-08-26T00:00:00Z",
  };
}

function daySeries(days: number, base: number): Json {
  return [
    {
      name: "series",
      values: Array.from({ length: days }, (_, index) => ({
        end_time: new Date(
          Date.UTC(2026, 7, 26) - (days - index) * 86_400_000,
        ).toISOString(),
        value: Math.round(base + Math.sin(index / 3) * base * 0.4 + index * 2),
      })),
    },
  ];
}

function total(value: number): Json {
  return [{ total_value: { value } }];
}

function followBreakdown(follows: number, unfollows: number): Json {
  return [
    {
      total_value: {
        breakdowns: [
          {
            dimension_keys: ["follow_type"],
            results: [
              { dimension_values: ["FOLLOWER"], value: follows },
              { dimension_values: ["NON_FOLLOWER"], value: unfollows },
            ],
          },
        ],
      },
    },
  ];
}

function onlineFollowers(): Json {
  const values = Array.from({ length: 28 }, (_, day) => {
    const hourly: Record<string, number> = {};
    for (let hour = 0; hour < 24; hour += 1) {
      const evening = Math.exp(-((hour - 19) ** 2) / 18);
      const noon = 0.6 * Math.exp(-((hour - 12) ** 2) / 10);
      const weekendBoost = day % 7 >= 5 ? 1.3 : 1;
      hourly[String(hour)] = Math.round(4_000 * (evening + noon) * weekendBoost);
    }
    return {
      end_time: new Date(Date.UTC(2026, 7, 26) - (28 - day) * 86_400_000).toISOString(),
      value: hourly,
    };
  });
  return { time_series: [{ name: "online_followers", values }] };
}

const VIEWS_WINDOWS = [180_000, 240_000, 310_000, 260_000, 350_000, 412_000];
const INTERACTION_WINDOWS = [1_400, 1_900, 2_400, 2_100, 2_700, 3_100];
const GROWTH_WINDOWS: Array<[number, number]> = [
  [900, 300],
  [1_100, 350],
  [1_400, 420],
  [1_250, 510],
  [1_700, 460],
  [1_890, 650],
];

const METRICS_180: Json = {
  views: Object.fromEntries([
    ...VIEWS_WINDOWS.map((value, index) => [`total_${index}`, total(value)]),
  ]),
  total_interactions: Object.fromEntries(
    INTERACTION_WINDOWS.map((value, index) => [`total_${index}`, total(value)]),
  ),
  follows_and_unfollows: Object.fromEntries(
    GROWTH_WINDOWS.flatMap(([follows, unfollows], index) => [
      [`total_${index}`, [{ name: "follows_and_unfollows" }]],
      [`breakdown_follow_type_${index}`, followBreakdown(follows, unfollows)],
    ]),
  ),
  reach: {
    ...Object.fromEntries(
      VIEWS_WINDOWS.map((value, index) => [`total_${index}`, total(value / 2)]),
    ),
    time_series_0: daySeries(180, 520),
  },
  accounts_engaged: { total: total(8_912) },
  likes: { total: total(9_204) },
  comments: { total: total(1_112) },
  shares: { total: total(842) },
  saves: { total: total(1_322) },
  replies: { total: total(210) },
  reposts: { total: total(96) },
  profile_links_taps: { total: total(402) },
  follower_count: 25_600,
  online_followers: onlineFollowers(),
  follower_demographics: {},
  engaged_audience_demographics: {},
};

const METRICS_15: Json = {
  views: { total: total(16_400) },
  reach: { total: total(9_100), time_series: daySeries(15, 610) },
  follower_count: { time_series: daySeries(15, 25_400) },
  follows_and_unfollows: {
    total: [{ name: "follows_and_unfollows" }],
    breakdown_follow_type: followBreakdown(1_460, 185),
  },
  total_interactions: { total: total(1_140) },
};

export default function DevInsightsPreviewPage() {
  return (
    <PageShell size="full">
      <IgAccountInsightsPanel
        insights={[makeRow(15, METRICS_15), makeRow(180, METRICS_180)]}
      />
    </PageShell>
  );
}
