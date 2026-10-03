import { describe, expect, it } from "vitest";
import { EXPERIMENT } from "../experiment/config";
import type { ProductId } from "../experiment/types";
import {
  analyze,
  classifyPriceGap,
  priceSwitchPoint,
  type ChoiceRecord,
  type StatedRecord,
} from "./analyze";
import { bootstrapInterval, mean, median } from "./stats";

const TESTED = [0.2, 0.5, 1.0, 1.5];

/** Build a participant's choices: baseline A, switching in the listed scenarios. */
function participant(id: string, switchesIn: string[], baseline: ProductId = "A"): ChoiceRecord[] {
  const alt: ProductId = baseline === "A" ? "B" : "A";
  return [
    { participantId: id, scenarioId: "baseline", chosenProduct: baseline, chosenSide: "left", baselineProduct: null },
    ...EXPERIMENT.scenarios.map((s) => ({
      participantId: id,
      scenarioId: s.id,
      chosenProduct: switchesIn.includes(s.id) ? alt : baseline,
      chosenSide: "right" as const,
      baselineProduct: baseline,
    })),
  ];
}

describe("priceSwitchPoint", () => {
  it("returns the smallest discount that produced a switch", () => {
    expect(
      priceSwitchPoint([
        { discount: 1.5, switched: true },
        { discount: 0.2, switched: false },
        { discount: 0.5, switched: true },
      ]),
    ).toBe(0.5);
  });

  it("returns null when the participant never switched", () => {
    expect(priceSwitchPoint([{ discount: 1, switched: false }])).toBeNull();
  });
});

describe("classifyPriceGap", () => {
  it("matches when the switch happens at the first tested discount meeting the stated threshold", () => {
    expect(classifyPriceGap(0.4, 0.5, TESTED)).toBe("matched");
  });
  it("detects switching sooner and later than stated", () => {
    expect(classifyPriceGap(1.0, 0.2, TESTED)).toBe("switched_sooner");
    expect(classifyPriceGap(0.2, 1.5, TESTED)).toBe("switched_later");
  });
  it("detects never switching despite a stated threshold in range", () => {
    expect(classifyPriceGap(0.5, null, TESTED)).toBe("never_switched");
  });
  it("handles stated thresholds above every tested discount", () => {
    expect(classifyPriceGap(3, null, TESTED)).toBe("no_price_switch_expected");
    expect(classifyPriceGap(3, 1.0, TESTED)).toBe("switched_sooner");
  });
});

describe("analyze", () => {
  const choices = [
    ...participant("p1", ["price_050", "price_100", "price_150", "promo_extra"]),
    ...participant("p2", ["price_150"], "B"),
    ...participant("p3", []),
  ];
  const stated: StatedRecord[] = [
    { participantId: "p1", phase: "before", statedPriceThreshold: 1.0, category: "price" },
    { participantId: "p2", phase: "after", statedPriceThreshold: 0.5, category: "trust" },
    { participantId: "p3", phase: "after", statedPriceThreshold: null, category: "habit" },
  ];
  const a = analyze(EXPERIMENT, choices, stated);

  it("counts participants and baseline shares", () => {
    expect(a.participants).toBe(3);
    expect(a.baseline.shares).toEqual({ A: 2, B: 1 });
  });

  it("computes switch rates per condition with sample size", () => {
    const p150 = a.conditions.find((c) => c.scenarioId === "price_150")!;
    expect(p150.n).toBe(3);
    expect(p150.switches).toBe(2);
    expect(p150.rate).toBeCloseTo(2 / 3);
    expect(p150.directional).toBe(true);
    const trust = a.conditions.find((c) => c.scenarioId === "trust_rating")!;
    expect(trust.rate).toBe(0);
  });

  it("computes switch points and their distribution", () => {
    const points = Object.fromEntries(a.byParticipant.map((p) => [p.participantId, p.observedSwitchPoint]));
    expect(points).toEqual({ p1: 0.5, p2: 1.5, p3: null });
    expect(a.switchPoints.median).toBe(1.0);
    expect(a.switchPoints.distribution.find((d) => d.discount === null)!.count).toBe(1);
  });

  it("compares stated and observed behaviour", () => {
    const p1 = a.byParticipant.find((p) => p.participantId === "p1")!;
    expect(p1.priceGap).toBe("switched_sooner");
    expect(p1.actedOnStatedLever).toBe(true);
    const p2 = a.byParticipant.find((p) => p.participantId === "p2")!;
    expect(p2.priceGap).toBe("switched_later");
    expect(p2.actedOnStatedLever).toBe(false);
    expect(a.sayDo.actedOnStatedLeverRate).toBe(0.5);
    expect(a.sayDo.meanPriceGap).toBeCloseTo(((0.5 - 1.0) + (1.5 - 0.5)) / 2);
    const trustRow = a.sayDo.leverRows.find((r) => r.lever === "trust")!;
    expect(trustRow.statedShare).toBeCloseTo(1 / 3);
    expect(trustRow.observedSwitchRate).toBe(0);
  });

  it("ignores choices from participants without a baseline", () => {
    const orphan = participant("p4", ["price_020"]).slice(1);
    expect(analyze(EXPERIMENT, [...choices, ...orphan], stated).participants).toBe(3);
  });
});

describe("stats", () => {
  it("computes the median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("gives a reproducible bootstrap interval containing the estimate", () => {
    const sample = [1, 0, 1, 1, 0, 1, 0, 1, 1, 1];
    const a = bootstrapInterval(sample, mean, { seed: 3 })!;
    const b = bootstrapInterval(sample, mean, { seed: 3 })!;
    expect(a).toEqual(b);
    expect(a[0]).toBeLessThanOrEqual(0.7);
    expect(a[1]).toBeGreaterThanOrEqual(0.7);
  });

  it("returns a degenerate interval when there is no variation", () => {
    expect(bootstrapInterval([1, 1, 1], mean)).toEqual([1, 1]);
    expect(bootstrapInterval([], mean)).toBeNull();
  });
});
