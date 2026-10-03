import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimitStore } from "@/infrastructure/supabase/rateLimitStore";
import { clientIp, enforceRateLimit } from "./rateLimit";

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/supabase/rateLimitStore", () => ({ rateLimitStore: { hit: vi.fn() } }));

const hit = vi.mocked(rateLimitStore.hit);
let bucketCounter = 0;
/** The local window map lives for the whole file, so each test uses its own bucket. */
const freshBucket = () => `test-${++bucketCounter}`;

const fromIp = (ip?: string) =>
  new Request("http://test.local/api/x", { headers: ip ? { "x-real-ip": ip } : {} });

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");
  hit.mockReset();
  hit.mockResolvedValue(1);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    const req = new Request("http://x", { headers: { "x-real-ip": " 1.1.1.1 ", "x-forwarded-for": "2.2.2.2" } });
    expect(clientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "3.3.3.3, 10.0.0.1" } });
    expect(clientIp(req)).toBe("3.3.3.3");
  });

  it("returns null when there is no IP header", () => {
    expect(clientIp(new Request("http://x"))).toBeNull();
  });
});

describe("enforceRateLimit", () => {
  it("allows requests up to the limit and blocks the next one locally", async () => {
    const bucket = freshBucket();
    for (let i = 0; i < 3; i++) await enforceRateLimit(fromIp("1.2.3.4"), bucket, 3);
    await expect(enforceRateLimit(fromIp("1.2.3.4"), bucket, 3)).rejects.toMatchObject({ kind: "rate_limited" });
    expect(hit).toHaveBeenCalledTimes(3);
  });

  it("counts each client separately", async () => {
    const bucket = freshBucket();
    await enforceRateLimit(fromIp("1.1.1.1"), bucket, 1);
    await expect(enforceRateLimit(fromIp("2.2.2.2"), bucket, 1)).resolves.toBeUndefined();
  });

  it("opens a new window after a minute", async () => {
    vi.useFakeTimers();
    const bucket = freshBucket();
    await enforceRateLimit(fromIp("1.2.3.4"), bucket, 1);
    await expect(enforceRateLimit(fromIp("1.2.3.4"), bucket, 1)).rejects.toMatchObject({ kind: "rate_limited" });
    vi.advanceTimersByTime(60_000);
    await expect(enforceRateLimit(fromIp("1.2.3.4"), bucket, 1)).resolves.toBeUndefined();
  });

  it("blocks when the shared count across instances is over the limit", async () => {
    hit.mockResolvedValue(11);
    await expect(enforceRateLimit(fromIp("1.2.3.4"), freshBucket(), 10)).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("fails open when the shared store is unreachable", async () => {
    hit.mockRejectedValue(new Error("database down"));
    await expect(enforceRateLimit(fromIp("1.2.3.4"), freshBucket(), 10)).resolves.toBeUndefined();
  });

  it("stores a keyed digest, never the raw IP", async () => {
    await enforceRateLimit(fromIp("203.0.113.9"), freshBucket(), 10);
    const [key, windowSeconds] = hit.mock.calls[0];
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.9");
    expect(windowSeconds).toBe(60);
  });

  it("gives clients without an IP a shared, larger allowance", async () => {
    const bucket = freshBucket();
    for (let i = 0; i < 20; i++) await enforceRateLimit(fromIp(), bucket, 1);
    await expect(enforceRateLimit(fromIp(), bucket, 1)).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("refuses to run without the key that hashes client identifiers", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(enforceRateLimit(fromIp("1.2.3.4"), freshBucket(), 10)).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});
