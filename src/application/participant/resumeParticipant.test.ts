import { describe, expect, it } from "vitest";
import { BASELINE_SCENARIO_ID } from "@/domain/experiment/types";
import { createTestDeps } from "../testing/inMemory";
import { runParticipant } from "../testing/participants";
import { recordChoice } from "./recordChoice";
import { resumeParticipant } from "./resumeParticipant";
import { startParticipant } from "./startParticipant";
import { submitStatedReason } from "./submitStatedReason";

describe("resumeParticipant", () => {
  it("restores a participant who has only consented", async () => {
    const { deps } = createTestDeps();
    const started = await startParticipant(deps);
    const resumed = await resumeParticipant(deps, started.participantId);

    expect(resumed).toMatchObject({
      participantId: started.participantId,
      sayFirst: started.sayFirst,
      totalChoices: started.totalChoices,
      baseline: started.baseline,
      baselineProduct: null,
      screens: [],
      completedScenarioIds: [],
      hasStated: false,
      completed: false,
      reward: null,
    });
  });

  it("restores the same screens and progress after some choices", async () => {
    const { deps } = createTestDeps();
    const started = await startParticipant(deps);
    const baseline = await recordChoice(deps, {
      participantId: started.participantId,
      scenarioId: BASELINE_SCENARIO_ID,
      side: "right",
    });
    const [first, second] = baseline.screens!;
    await recordChoice(deps, { participantId: started.participantId, scenarioId: first.scenarioId, side: "left" });
    await recordChoice(deps, { participantId: started.participantId, scenarioId: second.scenarioId, side: "left" });

    const resumed = await resumeParticipant(deps, started.participantId);
    expect(resumed.baselineProduct).toBe(started.baseline.right.productId);
    expect(resumed.screens).toEqual(baseline.screens);
    expect(resumed.completedScenarioIds.sort()).toEqual([first.scenarioId, second.scenarioId].sort());
    expect(resumed.completed).toBe(false);
  });

  it("returns the stored reward for a completed participant without drawing again", async () => {
    const { deps, store } = createTestDeps();
    const { participantId, completion } = await runParticipant(deps);
    const resumed = await resumeParticipant(deps, participantId);

    expect(resumed.completed).toBe(true);
    expect(resumed.hasStated).toBe(true);
    expect(resumed.reward).toEqual(completion!.reward);
    expect(store.fulfilments.size).toBe(1);
  });

  it("finishes a participant whose completion request was lost", async () => {
    const { deps, store } = createTestDeps();
    const { participantId } = await runParticipant(deps, { complete: false });
    expect(store.participants.get(participantId)!.completedAt).toBeNull();

    const resumed = await resumeParticipant(deps, participantId);
    expect(resumed.completed).toBe(true);
    expect(resumed.reward).not.toBeNull();
    expect(store.participants.get(participantId)!.completedAt).not.toBeNull();
  });

  it("draws the reward for a participant completed before a fulfilment error", async () => {
    const { deps, store } = createTestDeps();
    const { participantId } = await runParticipant(deps);
    store.fulfilments.delete(participantId);

    const resumed = await resumeParticipant(deps, participantId);
    expect(resumed.reward).not.toBeNull();
    expect(store.fulfilments.has(participantId)).toBe(true);
  });

  it("does not complete while the stated reason is missing", async () => {
    const { deps } = createTestDeps();
    const started = await startParticipant(deps);
    const baseline = await recordChoice(deps, {
      participantId: started.participantId,
      scenarioId: BASELINE_SCENARIO_ID,
      side: "left",
    });
    for (const s of baseline.screens!) {
      await recordChoice(deps, { participantId: started.participantId, scenarioId: s.scenarioId, side: "left" });
    }

    const resumed = await resumeParticipant(deps, started.participantId);
    expect(resumed.completed).toBe(false);
    expect(resumed.hasStated).toBe(false);

    await submitStatedReason(deps, { participantId: started.participantId, reasonText: "Cheaper", statedPriceThreshold: 1 });
    expect((await resumeParticipant(deps, started.participantId)).completed).toBe(true);
  });

  it("rejects an unknown participant", async () => {
    const { deps } = createTestDeps();
    await expect(resumeParticipant(deps, "00000000-0000-4000-8000-999999999999")).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});
