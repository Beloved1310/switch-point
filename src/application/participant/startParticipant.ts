import { activeExperiment } from "@/config/experiments";
import { baselineScreen, createPlan } from "@/domain/experiment/plan";
import type { StartParticipantResponse } from "@/contracts/responses";
import { ensureRegistered } from "../experiments";
import type { Deps } from "../ports";

/** Consent given: enrol an anonymous participant with a server-side plan (FR1, NFR1, NFR4). */
export async function startParticipant(deps: Deps): Promise<StartParticipantResponse> {
  const config = activeExperiment();
  await ensureRegistered(deps, config);

  const id = deps.runtime.newId();
  const plan = createPlan(config, () => deps.runtime.randomUnit());
  await deps.participants.create({ id, experimentVersion: config.version, plan });

  return {
    participantId: id,
    sayFirst: plan.sayFirst,
    totalChoices: plan.order.length + 1,
    baseline: baselineScreen(config, plan),
  };
}
