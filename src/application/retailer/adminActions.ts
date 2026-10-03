import type { OverrideCategoryRequest, ParticipantRequest } from "@/contracts/requests";
import type { Deps } from "../ports";

/** Override the AI category; the participant's text and the AI label are kept (FR12). */
export async function overrideReasonCategory(deps: Deps, input: OverrideCategoryRequest): Promise<{ ok: true }> {
  await deps.statedReasons.setOverride(input.participantId, input.category, deps.runtime.now());
  deps.runtime.defer(() => deps.notifier.resultsChanged("override"));
  return { ok: true };
}

/** Record that the drawn product was handed over (FR23). */
export async function markFulfilled(deps: Deps, input: ParticipantRequest): Promise<{ ok: true }> {
  await deps.fulfilments.markFulfilled(input.participantId, deps.runtime.now());
  return { ok: true };
}
