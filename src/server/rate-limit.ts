/**
 * Fixed-window, in-memory rate limiter. Per server instance, so on serverless
 * it's a best-effort guard against casual abuse of paid API calls; use a shared
 * store (e.g. Upstash Redis) if you need a hard global limit.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    // Drop expired windows so the map can't grow without bound.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (entry.count >= limit) return { allowed: false, retryAfterMs: entry.resetAt - now };
    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
  };
}
