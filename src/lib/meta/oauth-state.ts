import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { MetaOauthProvider } from "@/lib/meta/types";

const STATE_VERSION = "v1";
const STATE_PART_COUNT = 3;

export interface MetaOauthState {
  nonce: string;
  provider: MetaOauthProvider;
  returnTo: string;
  username: string;
}

export function encodeMetaOauthState(state: MetaOauthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = sign(`${STATE_VERSION}.${payload}`);
  return `${STATE_VERSION}.${payload}.${signature}`;
}

export function decodeMetaOauthState(value: string): MetaOauthState | null {
  const parts = value.split(".");
  if (parts.length !== STATE_PART_COUNT || parts[0] !== STATE_VERSION) {
    return null;
  }

  const [version, payload, signature] = parts;
  const expected = sign(`${version}.${payload}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const raw: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!isMetaOauthState(raw)) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function sign(value: string): string {
  const secret = process.env.META_OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error("META_OAUTH_STATE_SECRET is not configured");
  }
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function isMetaOauthState(value: unknown): value is MetaOauthState {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.nonce === "string" &&
    (value.provider === "facebook" || value.provider === "instagram") &&
    typeof value.returnTo === "string" &&
    value.returnTo.startsWith("/") &&
    !value.returnTo.startsWith("//") &&
    typeof value.username === "string" &&
    (/^[a-z0-9._]{1,30}$/.test(value.username) || value.username === "__workspace__")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
