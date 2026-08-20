import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import type { ApifyWebhookPayload } from "@/lib/apify/client";
import {
  advanceApifyGroupPipeline,
  markScrapeFailedAndAdvance,
  processSucceededApifyRun,
} from "@/lib/ig/process-apify-run";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const APIFY_SUCCESS_EVENT = "ACTOR.RUN.SUCCEEDED";
const APIFY_TEST_EVENT = "TEST";
const APIFY_FAILED_EVENTS = new Set([
  "ACTOR.RUN.ABORTED",
  "ACTOR.RUN.FAILED",
  "ACTOR.RUN.TIMED_OUT",
]);

/** Imports a completed Apify run. Configure Apify with an Authorization bearer secret. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as ApifyWebhookPayload | null;
  if (payload?.eventType === APIFY_TEST_EVENT) {
    return NextResponse.json({ received: true });
  }

  const run = getWebhookRun(payload);
  if (!run) {
    return NextResponse.json(
      { error: "Missing Apify run", eventType: payload?.eventType ?? null },
      { status: 400 },
    );
  }
  const runId = run.id ?? run.actorRunId;
  if (!runId) {
    return NextResponse.json(
      { error: "Missing Apify run ID", eventType: payload?.eventType ?? null },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: scrape, error: scrapeError } = await admin
    .from("scheduled_scrapes")
    .select("*")
    .eq("apify_run_id", runId)
    .maybeSingle();

  if (scrapeError) {
    throw scrapeError;
  }
  if (!scrape) {
    return NextResponse.json({ received: true });
  }

  if (payload?.eventType !== APIFY_SUCCESS_EVENT) {
    if (payload?.eventType && APIFY_FAILED_EVENTS.has(payload.eventType)) {
      await markScrapeFailedAndAdvance(
        admin,
        scrape,
        run.statusMessage ?? `Apify run ${run.status ?? "failed"}`,
      );
    }

    return NextResponse.json({ received: true });
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }

  const result = await processSucceededApifyRun(
    admin,
    scrape,
    token,
    run.defaultDatasetId,
  );
  const pipeline = await advanceApifyGroupPipeline(
    admin,
    token,
    scrape.group_id,
    scrape,
    result.batchHadOlderPost ?? false,
  );

  return NextResponse.json({
    received: true,
    ...result,
    ...pipeline,
  });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const expected = `Bearer ${secret}`;
  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

function getWebhookRun(
  payload: ApifyWebhookPayload | null,
): ApifyWebhookPayload["resource"] | null {
  const resource = payload?.resource;
  if (resource?.id || resource?.actorRunId) {
    return resource;
  }

  return payload?.eventData ?? null;
}
