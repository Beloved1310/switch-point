import { BASELINE_SCENARIO_ID, type ProductId, type Screen, type Side } from "@/domain/experiment/types";
import { completeParticipant } from "../participant/completeParticipant";
import { recordChoice } from "../participant/recordChoice";
import { startParticipant } from "../participant/startParticipant";
import { submitStatedReason } from "../participant/submitStatedReason";
import type { Deps } from "../ports";

/**
 * Drive one participant through the use cases. By default they pick the left
 * product at baseline, choose the right product on every controlled screen,
 * state a price reason and complete.
 */
export async function runParticipant(
  deps: Deps,
  opts: {
    baselineSide?: Side;
    /** Side to pick on a controlled screen; `baselineProduct` is the one chosen at baseline. */
    choose?: (screen: Screen, baselineProduct: ProductId) => Side;
    reasonText?: string;
    statedPriceThreshold?: number | null;
    complete?: boolean;
  } = {},
) {
  const started = await startParticipant(deps);
  const { participantId } = started;
  const baselineSide = opts.baselineSide ?? "left";
  const baselineProduct = started.baseline[baselineSide].productId;
  const baseline = await recordChoice(deps, { participantId, scenarioId: BASELINE_SCENARIO_ID, side: baselineSide });
  const screens = baseline.screens ?? [];
  await submitStatedReason(deps, {
    participantId,
    reasonText: opts.reasonText ?? "I would switch for a lower price.",
    statedPriceThreshold: opts.statedPriceThreshold === undefined ? 0.5 : opts.statedPriceThreshold,
  });
  for (const screen of screens) {
    await recordChoice(deps, {
      participantId,
      scenarioId: screen.scenarioId,
      side: opts.choose?.(screen, baselineProduct) ?? "right",
    });
  }
  const completion = opts.complete === false ? null : await completeParticipant(deps, { participantId });
  return { participantId, started, screens, completion };
}
