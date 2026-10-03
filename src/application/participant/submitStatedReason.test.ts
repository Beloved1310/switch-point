import { describe, expect, it } from "vitest";
import { BASELINE_SCENARIO_ID } from "@/domain/experiment/types";
import { createTestDeps } from "../testing/inMemory";
import { runParticipant } from "../testing/participants";
import { recordChoice } from "./recordChoice";
import { startParticipant } from "./startParticipant";
import { classifyAndSave, submitStatedReason } from "./submitStatedReason";

/** Start participants until one has the requested say/do order. */
async function startWithOrder(deps: ReturnType<typeof createTestDeps>["deps"], sayFirst: boolean) {
  for (let i = 0; i < 50; i++) {
    const p = await startParticipant(deps);
    if (p.sayFirst === sayFirst) return p;
  }
  throw new Error("Could not draw the requested order");
}

describe("submitStatedReason", () => {
  it.each([
    [true, "before"],
    [false, "after"],
  ] as const)("stores the phase from the plan (sayFirst=%s → %s)", async (sayFirst, phase) => {
    const { deps, store } = createTestDeps();
    const p = await startWithOrder(deps, sayFirst);
    await submitStatedReason(deps, { participantId: p.participantId, reasonText: "Cheaper", statedPriceThreshold: 1 });
    expect(store.reasons.get(p.participantId)).toMatchObject({ phase, reasonText: "Cheaper", statedPriceThreshold: 1 });
  });

  it("keeps the first answer when the reason is submitted twice", async () => {
    const { deps, store, flushDeferred } = createTestDeps();
    const { participantId } = await startParticipant(deps);
    await submitStatedReason(deps, { participantId, reasonText: "First", statedPriceThreshold: 0.2 });
    await submitStatedReason(deps, { participantId, reasonText: "Second", statedPriceThreshold: 1.5 });

    expect(store.reasons.get(participantId)).toMatchObject({ reasonText: "First", statedPriceThreshold: 0.2 });
    await flushDeferred();
    expect(store.notifications.filter((n) => n === "stated")).toHaveLength(1);
  });

  it("classifies after the response is sent, never before", async () => {
    let calls = 0;
    const { deps, store, flushDeferred } = createTestDeps({
      classify: async () => {
        calls++;
        return { category: "trust", confidence: "medium" };
      },
    });
    const { participantId } = await startParticipant(deps);
    await submitStatedReason(deps, { participantId, reasonText: "Good reviews", statedPriceThreshold: null });

    expect(calls).toBe(0);
    expect(store.reasons.get(participantId)!.aiStatus).toBe("pending");
    await flushDeferred();
    expect(store.reasons.get(participantId)).toMatchObject({ aiStatus: "done", aiCategory: "trust", aiConfidence: "medium" });
    expect(store.reasons.get(participantId)!.reasonText).toBe("Good reviews");
  });

  it("refuses a reason after completion", async () => {
    const { deps } = createTestDeps();
    const { participantId } = await runParticipant(deps);
    await expect(
      submitStatedReason(deps, { participantId, reasonText: "Late", statedPriceThreshold: null }),
    ).rejects.toMatchObject({ kind: "conflict" });
  });

  it("does not need a baseline choice first", async () => {
    const { deps, store } = createTestDeps();
    const { participantId } = await startParticipant(deps);
    await submitStatedReason(deps, { participantId, reasonText: "Cheaper", statedPriceThreshold: 0.5 });
    expect(store.reasons.has(participantId)).toBe(true);
    await recordChoice(deps, { participantId, scenarioId: BASELINE_SCENARIO_ID, side: "left" });
    expect(store.choices).toHaveLength(1);
  });
});

describe("classifyAndSave", () => {
  it("records skipped without calling the provider when AI is not configured", async () => {
    let calls = 0;
    const { deps, store } = createTestDeps({
      aiConfigured: false,
      classify: async () => {
        calls++;
        return { category: "price", confidence: "high" };
      },
    });
    const { participantId } = await startParticipant(deps);
    await submitStatedReason(deps, { participantId, reasonText: "Cheaper", statedPriceThreshold: null });

    expect(await classifyAndSave(deps, participantId, "Cheaper")).toBe("skipped");
    expect(calls).toBe(0);
    expect(store.reasons.get(participantId)!.aiStatus).toBe("skipped");
  });

  it("records failed and keeps the original text when the provider errors", async () => {
    const { deps, store } = createTestDeps({ classify: async () => Promise.reject(new Error("timeout")) });
    const { participantId } = await startParticipant(deps);
    await submitStatedReason(deps, { participantId, reasonText: "Cheaper", statedPriceThreshold: null });

    expect(await classifyAndSave(deps, participantId, "Cheaper")).toBe("failed");
    expect(store.reasons.get(participantId)).toMatchObject({ aiStatus: "failed", aiCategory: null, reasonText: "Cheaper" });
    expect(store.errors[0].context).toContain(participantId);
  });
});
