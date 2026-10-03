import { claimCode, drawFulfilmentChoice } from "@/domain/experiment/fulfilment";
import { BASELINE_SCENARIO_ID, type ProductId } from "@/domain/experiment/types";
import type { ParticipantRequest } from "@/contracts/requests";
import type { CompleteResponse } from "@/contracts/responses";
import { conflict } from "../errors";
import { requireParticipant } from "../experiments";
import type { Deps } from "../ports";

/** Mark completion and, if enabled, draw the choice that will be honoured (FR23). */
export async function completeParticipant(
  deps: Deps,
  input: ParticipantRequest,
): Promise<CompleteResponse> {
  const { participant, config } = await requireParticipant(deps, input.participantId);

  const [choices, hasStated] = await Promise.all([
    deps.choices.listForParticipant(participant.id),
    deps.statedReasons.exists(participant.id),
  ]);
  const controlled = choices.filter((c) => c.scenarioId !== BASELINE_SCENARIO_ID);
  if (controlled.length < participant.plan.order.length || !hasStated) {
    throw conflict("Experiment not finished");
  }

  if (!participant.completedAt) await deps.participants.markCompleted(participant.id, deps.runtime.now());

  let product: ProductId | null = null;
  if (config.fulfilment.enabled) {
    product = await deps.fulfilments.findProduct(participant.id);
    if (!product) {
      const drawn = drawFulfilmentChoice(controlled, (n) => deps.runtime.randomInt(n));
      const result = await deps.fulfilments.insert({
        participantId: participant.id,
        choiceId: drawn.id,
        product: drawn.chosenProduct,
      });
      // A concurrent request may have drawn first; the stored draw wins.
      product =
        result === "created" ? drawn.chosenProduct : await deps.fulfilments.findProduct(participant.id);
    }
  }

  deps.runtime.defer(() => deps.notifier.resultsChanged("complete"));
  return {
    ok: true,
    reward: product
      ? {
          productName: config.products.find((p) => p.id === product)?.name ?? product,
          code: claimCode(participant.id),
        }
      : null,
  };
}
