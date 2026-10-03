import "server-only";
import { AppError } from "@/application/errors";

/**
 * Best-effort fixed-window limiter per IP (NFR12). State lives in the
 * serverless instance, so it limits bursts rather than guaranteeing a quota;
 * duplicate submissions are also blocked by database unique constraints.
 * For multi-region scale, back this with a shared store such as Redis.
 */
const windows = new Map<string, { start: number; count: number }>();

export function rateLimited(req: Request, bucket: string, limit: number, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) windows.clear();
    return false;
  }
  w.count++;
  return w.count > limit;
}

export function enforceRateLimit(req: Request, bucket: string, limit: number): void {
  if (rateLimited(req, bucket, limit)) throw new AppError("rate_limited", "Too many requests");
}
