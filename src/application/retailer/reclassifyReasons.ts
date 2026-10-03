import { classifyAndSave } from "../participant/submitStatedReason";
import { unavailable } from "../errors";
import { resolveExperiment } from "../experiments";
import type { Deps } from "../ports";

/** Most reasons one retry request will classify (bounds AI cost, NFR17). */
export const RECLASSIFY_BATCH = 50;

/** A `pending` reason older than this is assumed to have lost its deferred task. */
export const STALLED_AFTER_MS = 2 * 60_000;

/** Consecutive failures after which the provider is treated as down and the batch stops. */
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Retry AI classification for reasons that failed, were skipped while AI was
 * not configured, or stalled in `pending`. The work runs after the response
 * is sent; dashboards update through the usual notification.
 */
export async function reclassifyReasons(deps: Deps, version?: string): Promise<{ queued: number }> {
  if (!deps.classifier.isConfigured()) throw unavailable("AI is not configured");
  const config = resolveExperiment(version);
  const stalledBefore = new Date(deps.runtime.now().getTime() - STALLED_AFTER_MS);
  const reasons = await deps.statedReasons.listUnclassified(config.version, stalledBefore, RECLASSIFY_BATCH);
  if (reasons.length === 0) return { queued: 0 };

  deps.runtime.defer(async () => {
    let consecutiveFailures = 0;
    for (const r of reasons) {
      const status = await classifyAndSave(deps, r.participantId, r.reasonText);
      consecutiveFailures = status === "failed" ? consecutiveFailures + 1 : 0;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        deps.runtime.reportError("reclassify", new Error("Stopped early: AI provider keeps failing"));
        break;
      }
    }
    await deps.notifier.resultsChanged("stated");
  });
  return { queued: reasons.length };
}
