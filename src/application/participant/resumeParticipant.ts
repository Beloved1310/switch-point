import { claimCode } from "@/domain/experiment/fulfilment";
import { baselineScreen, screensForPlan } from "@/domain/experiment/plan";
import { BASELINE_SCENARIO_ID } from "@/domain/experiment/types";
import type { ResumeParticipantResponse } from "@/contracts/responses";
import { completeParticipant } from "./completeParticipant";
import { requireParticipant } from "../experiments";
import type { Deps } from "../ports";

/** Rebuild a participant's current experiment from their server-side records. */
export async function resumeParticipant(
  deps: Deps,
  participantId: string,
): Promise<ResumeParticipantResponse> {
  const { participant, config } = await requireParticipant(deps, participantId);
  const [choices, hasStated] = await Promise.all([
    deps.choices.listForParticipant(participant.id),
    deps.statedReasons.exists(participant.id),
  ]);
  const baselineProduct = choices.find((c) => c.scenarioId === BASELINE_SCENARIO_ID)?.chosenProduct ?? null;
  const completedScenarioIds = choices
    .filter((c) => c.scenarioId !== BASELINE_SCENARIO_ID)
    .map((c) => c.scenarioId);
  const completedScenarios = new Set(completedScenarioIds);
  const allChoicesMade = config.scenarios.every((scenario) => completedScenarios.has(scenario.id));

  let completed = participant.completedAt !== null;
  let reward: ResumeParticipantResponse["reward"] = null;
  if (participant.completedAt) {
    const product = config.fulfilment.enabled ? await deps.fulfilments.findProduct(participant.id) : null;
    if (product) {
      reward = {
        productName: config.products.find((p) => p.id === product)?.name ?? product,
        code: claimCode(participant.id),
      };
    } else if (config.fulfilment.enabled) {
      // Recover a draw if completion was saved before a transient fulfilment error.
      reward = (await completeParticipant(deps, { participantId: participant.id })).reward;
    }
  } else if (allChoicesMade && hasStated) {
    const result = await completeParticipant(deps, { participantId: participant.id });
    completed = true;
    reward = result.reward;
  }

  return {
    participantId: participant.id,
    sayFirst: participant.sayFirst,
    totalChoices: participant.plan.order.length + 1,
    baseline: baselineScreen(config, participant.plan),
    baselineProduct,
    screens: baselineProduct ? screensForPlan(config, participant.plan, baselineProduct) : [],
    completedScenarioIds,
    hasStated,
    completed,
    reward,
  };
}
