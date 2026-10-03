import type { SubmitStatedRequest } from "@/contracts/requests";
import { conflict } from "../errors";
import { requireParticipant } from "../experiments";
import type { Deps } from "../ports";

/**
 * Store the participant's stated reason and price threshold (FR4, FR5).
 * Classification is deferred so AI can never block or lose a response (NFR8).
 */
export async function submitStatedReason(deps: Deps, input: SubmitStatedRequest): Promise<{ ok: true }> {
  const { participant, config } = await requireParticipant(deps, input.participantId);
  if (participant.completedAt) throw conflict("Experiment already completed");

  const result = await deps.statedReasons.insert({
    participantId: participant.id,
    experimentVersion: config.version,
    phase: participant.sayFirst ? "before" : "after",
    reasonText: input.reasonText,
    statedPriceThreshold: input.statedPriceThreshold,
  });
  if (result === "created") {
    deps.runtime.defer(() => classifyStatedReason(deps, participant.id, input.reasonText));
  }
  return { ok: true };
}

/**
 * Classify a stored reason at most once (FR11, NFR17). The original text is
 * never modified; failures are recorded rather than thrown (NFR20).
 */
export async function classifyStatedReason(
  deps: Deps,
  participantId: string,
  reasonText: string,
): Promise<void> {
  if (!deps.classifier.isConfigured()) {
    await deps.statedReasons.saveClassification(participantId, { status: "skipped" });
  } else {
    try {
      const classification = await deps.classifier.classify(reasonText);
      await deps.statedReasons.saveClassification(participantId, {
        status: "done",
        classification,
        model: deps.classifier.model,
      });
    } catch {
      await deps.statedReasons.saveClassification(participantId, { status: "failed" });
    }
  }
  await deps.notifier.resultsChanged("stated");
}
