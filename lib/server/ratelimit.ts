// Small in-memory fixed-window rate limiter keyed by caller + bucket.
//
// Trade-off: on Vercel each warm serverless instance has its own memory, so
// this is a per-instance limit (a determined attacker spread across instances
// gets more headroom). It still blunts naive floods and runaway clients with
// zero extra infrastructure; a shared store (Redis/Upstash) would make it exact.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
let lastSweep = 0;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow without bound.
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  w.count += 1;
  if (w.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

// Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip).
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
