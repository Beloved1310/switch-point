import { describe, expect, it } from "vitest";
import { BASELINE_SCENARIO_ID } from "@/domain/experiment/types";
import { createTestDeps } from "../testing/inMemory";
import { runParticipant } from "../testing/participants";
import { recordChoice } from "./recordChoice";
import { startParticipant } from "./startParticipant";

describe("recordChoice", () => {
  it("derives the product from the stored baseline screen, not the client", async () => {
    const { deps, store } = createTestDeps();
    const started = await startParticipant(deps);
    await recordChoice(deps, { participantId: started.participantId, scenarioId: BASELINE_SCENARIO_ID, side: "right" });

    const [stored] = store.choices;
    expect(stored.chosenProduct).toBe(started.baseline.right.productId);
    expect(stored.baselineProduct).toBeNull();
    expect(stored.switched).toBeNull();
    expect(stored.levers).toEqual([]);
    expect(stored.condition).toBeNull();
  });

  it("returns controlled screens built around the baseline product", async () => {
    const { deps } = createTestDeps();
    const started = await startParticipant(deps);
    const result = await recordChoice(deps, {
      participantId: started.participantId,
      scenarioId: BASELINE_SCENARIO_ID,
      side: "left",
    });

    const preferred = started.baseline.left.productId;
    expect(result.screens).toHaveLength(started.totalChoices - 1);
    for (const screen of result.screens!) {
      const ids = [screen.left.productId, screen.right.productId];
      expect(ids).toContain(preferred);
      const baseline = screen.left.productId === preferred ? screen.left : screen.right;
      expect(baseline.promotion).toBeNull();
      expect(baseline.trustBadge).toBeNull();
    }
  });

  it("requires the baseline before any controlled choice", async () => {
    const { deps, store } = createTestDeps();
    const started = await startParticipant(deps);
    await expect(
      recordChoice(deps, { participantId: started.participantId, scenarioId: "price_050", side: "left" }),
    ).rejects.toMatchObject({ kind: "conflict", message: "Baseline choice required first" });
    expect(store.choices).toHaveLength(0);
  });

  it("records whether each controlled choice switched away from the baseline", async () => {
    const { deps, store } = createTestDeps();
    const { participantId, screens } = await runParticipant(deps, {
      complete: false,
      // Switch only when the alternative is £1.50 cheaper.
      choose: (screen, baselineProduct) => {
        const base = screen.left.productId === baselineProduct ? "left" : "right";
        const alt = base === "left" ? "right" : "left";
        return screen.scenarioId === "price_150" ? alt : base;
      },
    });

    const controlled = store.choices.filter((c) => c.participantId === participantId && c.scenarioId !== BASELINE_SCENARIO_ID);
    expect(controlled).toHaveLength(screens.length);
    for (const c of controlled) {
      expect(c.switched).toBe(c.scenarioId === "price_150");
      expect(c.baselineProduct).not.toBeNull();
    }
    const price150 = controlled.find((c) => c.scenarioId === "price_150")!;
    expect(price150.levers).toEqual(["price"]);
    expect(price150.condition).toMatchObject({ priceDiscount: 1.5 });
  });

  it("refuses new choices after completion", async () => {
    const { deps } = createTestDeps();
    const { participantId, screens } = await runParticipant(deps);
    await expect(
      recordChoice(deps, { participantId, scenarioId: screens[0].scenarioId, side: "left" }),
    ).rejects.toMatchObject({ kind: "conflict", message: "Experiment already completed" });
  });

  it("rejects an unknown participant", async () => {
    const { deps } = createTestDeps();
    await expect(
      recordChoice(deps, {
        participantId: "00000000-0000-4000-8000-999999999999",
        scenarioId: BASELINE_SCENARIO_ID,
        side: "left",
      }),
    ).rejects.toMatchObject({ kind: "not_found" });
  });

  it("notifies dashboards once per stored choice, after the response", async () => {
    const { deps, store, flushDeferred } = createTestDeps();
    const { participantId, screens } = await runParticipant(deps, { complete: false });
    await recordChoice(deps, { participantId, scenarioId: screens[0].scenarioId, side: "left" });

    expect(store.notifications).toEqual([]);
    await flushDeferred();
    expect(store.notifications.filter((n) => n === "choice")).toHaveLength(screens.length + 1);
  });
});
