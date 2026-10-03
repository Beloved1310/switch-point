import "server-only";
import type { ResultsNotifier } from "@/application/ports";
import { RESULTS_CHANNEL } from "@/contracts/realtime";

/**
 * Tells live dashboards that new data exists (FR18) via Supabase Realtime
 * broadcast. The message carries no response data; dashboards refetch
 * through the authenticated results API.
 */
export const broadcastNotifier: ResultsNotifier = {
  async resultsChanged(kind) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    try {
      await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ topic: RESULTS_CHANNEL, event: kind, payload: { at: Date.now() } }],
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (error) {
      // Dashboards also poll, so a missed broadcast only delays an update.
      console.warn("[switchpoint] realtime broadcast failed:", error);
    }
  },
};
