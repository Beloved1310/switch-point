import "server-only";
import { serviceDb } from "./clients";

/** Shared rate-limit counters in Postgres (see 0002_rate_limits.sql). */
export const rateLimitStore = {
  /** Count one hit for `key` and return the total in the current window. */
  async hit(key: string, windowSeconds: number): Promise<number> {
    const { data, error } = await serviceDb().rpc("hit_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
    });
    if (error) throw new Error(error.message);
    return Number(data);
  },
};
