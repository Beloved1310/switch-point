import { describe, expect, it } from "vitest";
import { coffeeV1 as EXPERIMENT } from "@/config/experiments/coffee-v1";
import { analyze, type ChoiceRecord, type StatedRecord } from "@/domain/analysis/analyze";
import { buildEvidencePacket } from "./evidence";
import { ungroundedNumbers } from "./grounding";

/** Baseline A; switches to B in the listed scenarios. */
function participant(id: string, switchesIn: string[]): ChoiceRecord[] {
  return [
    { participantId: id, scenarioId: "baseline", chosenProduct: "A", chosenSide: "left", baselineProduct: null },
    ...EXPERIMENT.scenarios.map((s) => ({
      participantId: id,
      scenarioId: s.id,
      chosenProduct: switchesIn.includes(s.id) ? ("B" as const) : ("A" as const),
      chosenSide: "right" as const,
      baselineProduct: "A" as const,
    })),
  ];
}

const choices = [
  ...participant("p1", ["price_100", "price_150", "promo_extra"]),
  ...participant("p2", ["price_150"]),
  ...participant("p3", []),
];
const stated: StatedRecord[] = [
  { participantId: "p1", phase: "before", statedPriceThreshold: 1, category: "price" },
  { participantId: "p2", phase: "after", statedPriceThreshold: 0.5, category: "price" },
  { participantId: "p3", phase: "before", statedPriceThreshold: null, category: "habit" },
];
const evidence = buildEvidencePacket(EXPERIMENT, analyze(EXPERIMENT, choices, stated));

describe("buildEvidencePacket", () => {
  it("identifies the experiment and sample", () => {
    expect(evidence.experiment_version).toBe("v1");
    expect(evidence.product_category).toBe(EXPERIMENT.category);
    expect(evidence.participants).toBe(3);
    expect(evidence.evidence_strength).toMatch(/^directional/);
  });

  it("reports every tested condition with whole-number percentages", () => {
    expect(evidence.tested_conditions.map((c) => c.condition).sort()).toEqual(
      EXPERIMENT.scenarios.map((s) => s.label).sort(),
    );
    for (const c of evidence.tested_conditions) {
      expect(c.participants).toBe(3);
      expect(Number.isInteger(c.switch_rate_pct)).toBe(true);
    }
    const promo = evidence.tested_conditions.find((c) => c.condition === "Promotion: 20% extra free")!;
    expect(promo.switch_rate_pct).toBe(33);
    const biggest = evidence.tested_conditions.find((c) => c.condition === "£1.50 cheaper")!;
    expect(biggest.switch_rate_pct).toBe(67);
    expect(biggest.price_discount_gbp).toBe(1.5);
  });

  it("summarises switch points and stated reasons", () => {
    expect(evidence.participants_never_switching_on_price).toBe(1);
    expect(evidence.median_stated_price_threshold_gbp).toBe(0.75);
    const shares = Object.fromEntries(evidence.stated_reason_shares_pct.map((s) => [s.category, s.share_pct]));
    expect(shares.price).toBe(67);
    expect(shares.habit).toBe(33);
  });

  it("grounds a narrative that quotes its own numbers", () => {
    expect(ungroundedNumbers(["67% switched at £1.50 across 3 shoppers"], evidence)).toEqual([]);
    expect(ungroundedNumbers(["80% switched"], evidence)).toEqual([80]);
  });
});
