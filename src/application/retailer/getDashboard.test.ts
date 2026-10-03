import { describe, expect, it } from "vitest";
import { experimentVersions } from "@/config/experiments";
import { claimCode } from "@/domain/experiment/fulfilment";
import { startParticipant } from "../participant/startParticipant";
import { createTestDeps } from "../testing/inMemory";
import { runParticipant } from "../testing/participants";
import { markFulfilled, overrideReasonCategory } from "./adminActions";
import { getDashboard } from "./getDashboard";

describe("getDashboard", () => {
  it("shows an empty experiment before anyone takes part", async () => {
    const { deps } = createTestDeps();
    const data = await getDashboard(deps);

    expect(data.experiment).toMatchObject({ version: "v1", category: "Ground coffee, 227g" });
    expect(data.experiment.products.map((p) => p.name)).toEqual(["Hearth Roast", "Ridgeline"]);
    expect(data.versions).toEqual(experimentVersions());
    expect(data).toMatchObject({ started: 0, completed: 0, reasons: [], insight: null });
    expect(data.analysis.participants).toBe(0);
    expect(data.fulfilment).toMatchObject({ enabled: true, fulfilled: 0, pending: [] });
  });

  it("counts started and completed participants separately", async () => {
    const { deps } = createTestDeps();
    await runParticipant(deps);
    await runParticipant(deps, { complete: false });
    await startParticipant(deps);

    const data = await getDashboard(deps);
    expect(data.started).toBe(3);
    expect(data.completed).toBe(1);
    expect(data.analysis.participants).toBe(2);
    expect(data.reasons).toHaveLength(2);
  });

  it("lists rewards waiting to be handed over by claim code", async () => {
    const { deps } = createTestDeps();
    const first = await runParticipant(deps);
    const second = await runParticipant(deps);

    let data = await getDashboard(deps);
    expect(data.fulfilment.pending.map((p) => p.participantId).sort()).toEqual(
      [first.participantId, second.participantId].sort(),
    );
    const pending = data.fulfilment.pending.find((p) => p.participantId === first.participantId)!;
    expect(pending.code).toBe(claimCode(first.participantId));
    expect(pending.productName).toBe(first.completion!.reward!.productName);

    await markFulfilled(deps, { participantId: first.participantId });
    data = await getDashboard(deps);
    expect(data.fulfilment.fulfilled).toBe(1);
    expect(data.fulfilment.pending.map((p) => p.participantId)).toEqual([second.participantId]);
  });

  it("uses an admin override in place of the AI category", async () => {
    const { deps, flushDeferred } = createTestDeps({ classify: async () => ({ category: "price", confidence: "low" }) });
    const { participantId } = await runParticipant(deps, { reasonText: "My friend recommended it" });
    await flushDeferred();

    let data = await getDashboard(deps);
    expect(data.analysis.stated.categoryShares.find((s) => s.category === "price")?.share).toBe(1);

    await overrideReasonCategory(deps, { participantId, category: "trust" });
    data = await getDashboard(deps);
    const reason = data.reasons.find((r) => r.participantId === participantId)!;
    expect(reason).toMatchObject({ aiCategory: "price", overrideCategory: "trust" });
    expect(data.analysis.stated.categoryShares.find((s) => s.category === "trust")?.share).toBe(1);

    await overrideReasonCategory(deps, { participantId, category: null });
    data = await getDashboard(deps);
    expect(data.analysis.stated.categoryShares.find((s) => s.category === "price")?.share).toBe(1);
  });

  it("keeps each experiment version's data separate", async () => {
    const { deps } = createTestDeps();
    await runParticipant(deps);

    const demo = await getDashboard(deps, "v1-synthetic-demo");
    expect(demo.experiment.version).toBe("v1-synthetic-demo");
    expect(demo.started).toBe(0);
    expect(demo.analysis.participants).toBe(0);
  });

  it("includes the latest saved insight", async () => {
    const { deps, store } = createTestDeps();
    store.insights.push({
      experimentVersion: "v1",
      status: "failed",
      suggestion: null,
      detail: "Unavailable",
      createdAt: new Date().toISOString(),
    });
    expect((await getDashboard(deps)).insight).toMatchObject({ status: "failed", detail: "Unavailable" });
  });
});

describe("admin actions", () => {
  it("notify dashboards after an override, after the response", async () => {
    const { deps, store, flushDeferred } = createTestDeps();
    const { participantId } = await runParticipant(deps);
    await flushDeferred();
    store.notifications.length = 0;

    await overrideReasonCategory(deps, { participantId, category: "quality" });
    expect(store.notifications).toEqual([]);
    await flushDeferred();
    expect(store.notifications).toEqual(["override"]);
  });
});
