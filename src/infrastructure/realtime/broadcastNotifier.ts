import "server-only";

export const RESULTS_CHANNEL = "switchpoint-results";

/**
 * Tell live dashboards that new data exists (FR18). The message carries no
 * response data; dashboards refetch through the authenticated results API.
 */
export async function notifyDashboards(event: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ topic: RESULTS_CHANNEL, event, payload: { at: Date.now() } }],
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Dashboards also poll, so a missed broadcast only delays an update.
  }
}
