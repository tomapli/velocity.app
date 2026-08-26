/**
 * Next.js memoizes identical GET fetches for the lifetime of a render pass
 * (including `after()` callbacks), so a mutate-then-reread flow through
 * supabase-js would keep seeing the first response. Passing an AbortSignal is
 * Next's documented opt-out from that memoization; database reads must always
 * hit PostgREST.
 */
export function unmemoizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init?.signal ?? new AbortController().signal,
  });
}
