import { describe, expect, it } from "vitest";
import { activeExperiment } from "@/config/experiments";
import { createTestDeps } from "../testing/inMemory";
import { classifyStatedReason } from "../participant/submitStatedReason";
import { MAX_CONSECUTIVE_FAILURES, reclassifyReasons, STALLED_AFTER_MS } from "./reclassifyReasons";

const version = activeExperiment().version;

async function addReason(deps: ReturnType<typeof createTestDeps>["deps"], id: string) {
  await deps.statedReasons.insert({
    participantId: id,
    experimentVersion: version,
    phase: "before",
    reasonText: `reason ${id}`,
    statedPriceThreshold: null,
  });
}

describe("classification failures", () => {
  it("records failed and reports the cause", async () => {
    const t = createTestDeps({ classify: async () => Promise.reject(new Error("429 rate limited")) });
    await addReason(t.deps, "p1");
    await classifyStatedReason(t.deps, "p1", "cheaper");

    expect(t.store.reasons.get("p1")!.aiStatus).toBe("failed");
    expect(t.store.errors).toHaveLength(1);
    expect(String(t.store.errors[0].error)).toContain("429");
  });
});

describe("reclassifyReasons", () => {
  it("retries failed, skipped and stalled reasons, but not fresh pending ones", async () => {
    const t = createTestDeps();
    for (const id of ["failed", "skipped", "stalled", "fresh", "done"]) await addReason(t.deps, id);
    t.store.reasons.get("failed")!.aiStatus = "failed";
    t.store.reasons.get("skipped")!.aiStatus = "skipped";
    t.store.reasons.get("done")!.aiStatus = "done";
    t.store.reasons.get("stalled")!.createdAt = new Date(Date.UTC(2026, 0, 1)).toISOString();
    t.store.reasons.get("fresh")!.createdAt = new Date(t.deps.runtime.now().getTime() + STALLED_AFTER_MS).toISOString();

    const { queued } = await reclassifyReasons(t.deps);
    expect(queued).toBe(3);
    await t.flushDeferred();

    expect(t.store.reasons.get("failed")!.aiStatus).toBe("done");
    expect(t.store.reasons.get("skipped")!.aiStatus).toBe("done");
    expect(t.store.reasons.get("stalled")!.aiStatus).toBe("done");
    expect(t.store.reasons.get("fresh")!.aiStatus).toBe("pending");
    expect(t.store.notifications).toContain("stated");
  });

  it("stops early when the provider keeps failing", async () => {
    let calls = 0;
    const t = createTestDeps({
      classify: async () => {
        calls++;
        throw new Error("provider down");
      },
    });
    for (let i = 0; i < 10; i++) {
      await addReason(t.deps, `p${i}`);
      t.store.reasons.get(`p${i}`)!.aiStatus = "failed";
    }

    await reclassifyReasons(t.deps);
    await t.flushDeferred();

    expect(calls).toBe(MAX_CONSECUTIVE_FAILURES);
    expect(t.store.errors.at(-1)!.context).toBe("reclassify");
  });

  it("refuses when AI is not configured", async () => {
    const t = createTestDeps({ aiConfigured: false });
    await expect(reclassifyReasons(t.deps)).rejects.toThrow("AI is not configured");
  });
});
