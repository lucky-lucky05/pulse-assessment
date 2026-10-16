import type { NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export function tooMany(retryAfterSec: number) {
  return json({ error: "too many requests" }, 429, {
    "Retry-After": String(retryAfterSec),
  });
}

// Read a JSON body with a hard size cap, so a huge payload can't tie up the
// function. Returns null on any parse/size failure.
export async function readJson(
  request: NextRequest,
  maxBytes: number,
): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

type Handler = (request: NextRequest) => Promise<Response>;

// Per-IP rate limit + generic error handling. Internal errors are logged
// server-side only; the client never sees stack traces or DB details.
export function guarded(
  bucket: string,
  limit: number,
  windowMs: number,
  handler: Handler,
): Handler {
  return async (request) => {
    const rl = rateLimit(
      `${bucket}:${clientIp(request.headers)}`,
      limit,
      windowMs,
    );
    if (!rl.ok) return tooMany(rl.retryAfterSec);
    try {
      return await handler(request);
    } catch (err) {
      console.error(`[api:${bucket}]`, err);
      return json({ error: "internal error" }, 500);
    }
  };
}
