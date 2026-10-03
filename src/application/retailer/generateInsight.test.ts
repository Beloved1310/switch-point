import { describe, expect, it } from "vitest";
import type { EvidencePacket } from "@/domain/insight/evidence";
import type { Suggestion } from "@/domain/insight/types";
import { createTestDeps } from "../testing/inMemory";
import { runParticipant } from "../testing/participants";
import { generateInsight } from "./generateInsight";

const suggestion = (text: string): Suggestion => ({
  title: "Test a bigger promotion",
  hypothesis: text,
  rationale: "Promotions look stronger than trust badges.",
  lever: "promotion",
  // Design values for the next test may use new numbers; they are not claims.
  proposed_conditions: [{ label: "35% extra free", price_discount_gbp: 0.35, promotion: "35% extra free", trust_badge: null }],
});

describe("generateInsight", () => {
  it("accepts a suggestion whose numbers all come from the evidence", async () => {
    let seen: EvidencePacket | null = null;
    const t = createTestDeps({
      suggest: async (evidence) => {
        seen = evidence;
        return suggestion(`All ${evidence.participants} shoppers saw the promotion.`);
      },
    });
    await runParticipant(t.deps);
    await runParticipant(t.deps);

    const view = await generateInsight(t.deps);
    expect(seen!.participants).toBe(2);
    expect(view.status).toBe("accepted");
    expect(view.suggestion?.hypothesis).toBe("All 2 shoppers saw the promotion.");
    expect(t.store.insights).toHaveLength(1);
    expect(t.store.insights[0].experimentVersion).toBe("v1");
  });

  it("suppresses a suggestion that quotes an invented number", async () => {
    const t = createTestDeps({ suggest: async () => suggestion("Switching jumps to 73% with a bigger offer.") });
    await runParticipant(t.deps);

    const view = await generateInsight(t.deps);
    expect(view).toMatchObject({ status: "rejected", suggestion: null });
    expect(view.detail).toContain("73");
  });

  it("records a failure instead of throwing when the provider errors", async () => {
    const t = createTestDeps({ suggest: async () => Promise.reject(new Error("503 from provider")) });
    await runParticipant(t.deps);

    const view = await generateInsight(t.deps);
    expect(view).toMatchObject({ status: "failed", suggestion: null });
    expect(t.store.insights.at(-1)!.status).toBe("failed");
    expect(t.store.errors[0].context).toBe("generate insight");
  });

  it("refuses when there are no results yet", async () => {
    const t = createTestDeps({ suggest: async () => suggestion("No numbers.") });
    await expect(generateInsight(t.deps)).rejects.toMatchObject({ kind: "conflict", message: "No results yet" });
    expect(t.store.insights).toHaveLength(0);
  });

  it("refuses when AI is not configured", async () => {
    const t = createTestDeps({ aiConfigured: false });
    await runParticipant(t.deps);
    await expect(generateInsight(t.deps)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("rejects an unknown experiment version", async () => {
    const t = createTestDeps({ suggest: async () => suggestion("No numbers.") });
    await expect(generateInsight(t.deps, "v999")).rejects.toMatchObject({ kind: "not_found" });
  });
});
