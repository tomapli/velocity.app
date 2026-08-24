import type { NextRequest } from "next/server";

import type { MetaOauthProvider } from "@/lib/meta/types";

const FORWARDED_HEADER_SEPARATOR = ",";
const HTTP_PROTOCOL = "http";
const HTTPS_PROTOCOL = "https";

export function getMetaOauthOrigin(request: NextRequest): string {
  const forwardedHost = getFirstForwardedValue(
    request.headers.get("x-forwarded-host"),
  );
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProtocol = getFirstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  );
  const protocol =
    forwardedProtocol === HTTP_PROTOCOL || forwardedProtocol === HTTPS_PROTOCOL
      ? forwardedProtocol
      : request.nextUrl.protocol.replace(":", "");

  if (!host) {
    return request.nextUrl.origin;
  }

  return new URL(`${protocol}://${host}`).origin;
}

export function getMetaOauthRedirectUri(
  request: NextRequest,
  provider: MetaOauthProvider,
): string {
  return new URL(
    `/api/meta/oauth/${provider}/callback`,
    getMetaOauthOrigin(request),
  ).toString();
}

function getFirstForwardedValue(value: string | null): string | null {
  const firstValue = value?.split(FORWARDED_HEADER_SEPARATOR)[0]?.trim();
  return firstValue === undefined || firstValue === "" ? null : firstValue;
}
