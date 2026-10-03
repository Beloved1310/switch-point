import "server-only";
import { AppError } from "@/application/errors";
import { rateLimitStore } from "@/infrastructure/supabase/rateLimitStore";

/**
 * Fixed-window rate limiting per client IP and bucket (NFR12), in two layers:
 *
 * 1. An in-memory counter in this instance: free, and stops bursts before
 *    they reach the database.
 * 2. A shared counter in Postgres, so the limit holds across all serverless
 *    instances and regions.
 *
 * If the shared store is unreachable the request is allowed (fail open) and
 * the in-memory layer still applies, so a database blip never locks out
 * participants. Duplicate submissions are blocked separately by unique
 * constraints.
 */

const WINDOW_MS = 60_000;

/**
 * Clients with no IP header share one bucket. Its limit is multiplied so a
 * proxy that strips headers degrades to a global cap instead of blocking
 * every participant after a handful of requests.
 */
const UNKNOWN_CLIENT_MULTIPLIER = 20;

const windows = new Map<string, { start: number; count: number }>();
let warnedUnknownIp = false;

/**
 * The caller's IP. `x-real-ip` is set by Vercel and most proxies to the
 * connecting address; otherwise use the first `x-forwarded-for` entry.
 */
export function clientIp(req: Request): string | null {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}

function hitLocal(key: string, now: number): number {
  const w = windows.get(key);
  if (!w || now - w.start >= WINDOW_MS) {
    if (windows.size > 10_000) windows.clear();
    windows.set(key, { start: now, count: 1 });
    return 1;
  }
  return ++w.count;
}

const tooMany = () => new AppError("rate_limited", "Too many requests. Please wait a moment and try again.");

export async function enforceRateLimit(req: Request, bucket: string, limit: number): Promise<void> {
  const ip = clientIp(req);
  if (!ip && !warnedUnknownIp) {
    warnedUnknownIp = true;
    console.warn("[switchpoint] request has no client IP header; using the shared 'unknown' rate limit bucket");
  }
  const key = `${bucket}:${ip ?? "unknown"}`;
  const max = ip ? limit : limit * UNKNOWN_CLIENT_MULTIPLIER;

  if (hitLocal(key, Date.now()) > max) throw tooMany();

  let hits: number;
  try {
    hits = await rateLimitStore.hit(key, WINDOW_MS / 1000);
  } catch (error) {
    console.error("[switchpoint] shared rate limit unavailable; allowing request:", error);
    return;
  }
  if (hits > max) throw tooMany();
}
