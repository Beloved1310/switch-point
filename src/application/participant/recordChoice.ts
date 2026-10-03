import {
  baselineScreen,
  findScenario,
  productOnSide,
  scenarioScreen,
  screensForPlan,
} from "@/domain/experiment/plan";
import { BASELINE_SCENARIO_ID, type ProductId, type Screen } from "@/domain/experiment/types";
import type { RecordChoiceRequest } from "@/contracts/requests";
import type { RecordChoiceResponse } from "@/contracts/responses";
import { conflict, invalid } from "../errors";
import { requireParticipant } from "../experiments";
import type { Deps } from "../ports";

/**
 * Record one choice. The client sends only the side it picked; products,
 * prices and positions come from the stored plan (FR10, NFR4, NFR7).
 * Repeated submissions are idempotent (NFR12).
 */
export async function recordChoice(
  deps: Deps,
  input: RecordChoiceRequest,
): Promise<RecordChoiceResponse> {
  const { participant, config } = await requireParticipant(deps, input.participantId);
  if (participant.completedAt) throw conflict("Experiment already completed");
  const { plan } = participant;
  const isBaseline = input.scenarioId === BASELINE_SCENARIO_ID;

  let screen: Screen;
  let baselineProduct: ProductId | null = null;
  if (isBaseline) {
    screen = baselineScreen(config, plan);
  } else {
    if (!plan.order.some((o) => o.scenarioId === input.scenarioId)) {
      throw invalid("Scenario not in plan");
    }
    baselineProduct = await deps.choices.findBaselineProduct(participant.id);
    if (!baselineProduct) throw conflict("Baseline choice required first");
    screen = scenarioScreen(config, plan, input.scenarioId, baselineProduct);
  }

  const chosenProduct = productOnSide(screen, input.side);
  const scenario = findScenario(config, input.scenarioId);
  const result = await deps.choices.insert({
    participantId: participant.id,
    experimentVersion: config.version,
    scenarioId: input.scenarioId,
    levers: scenario?.levers ?? [],
    condition: scenario?.condition ?? null,
    screen,
    chosenSide: input.side,
    chosenProduct,
    baselineProduct,
    switched: baselineProduct === null ? null : chosenProduct !== baselineProduct,
  });
  if (result === "created") deps.runtime.defer(() => deps.notifier.resultsChanged("choice"));

  if (!isBaseline) return { ok: true };

  // The baseline decides which product is the alternative, so controlled
  // screens are built now, from the stored answer in case this was a retry.
  const storedBaseline = (await deps.choices.findBaselineProduct(participant.id)) ?? chosenProduct;
  return { ok: true, screens: screensForPlan(config, plan, storedBaseline) };
}
