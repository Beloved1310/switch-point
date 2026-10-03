import { describe, expect, it } from "vitest";
import { coffeeV1 as EXPERIMENT } from "@/config/experiments/coffee-v1";
import { mulberry32 } from "@/domain/analysis/stats";
import { baselineScreen, createPlan, scenarioScreen, screensForPlan } from "./plan";

describe("createPlan", () => {
  it("includes every scenario exactly once", () => {
    const plan = createPlan(EXPERIMENT, mulberry32(1));
    expect(plan.order.map((o) => o.scenarioId).sort()).toEqual(
      EXPERIMENT.scenarios.map((s) => s.id).sort(),
    );
  });

  it("varies order and sides across participants", () => {
    const random = mulberry32(2);
    const plans = Array.from({ length: 50 }, () => createPlan(EXPERIMENT, random));
    expect(new Set(plans.map((p) => p.order[0].scenarioId)).size).toBeGreaterThan(1);
    expect(new Set(plans.map((p) => p.sayFirst)).size).toBe(2);
    expect(new Set(plans.map((p) => p.baselineLeft)).size).toBe(2);
  });
});

describe("screens", () => {
  const plan = createPlan(EXPERIMENT, mulberry32(4));

  it("presents identical products at baseline", () => {
    const s = baselineScreen(EXPERIMENT, plan);
    expect(s.left.price).toBe(s.right.price);
    expect(s.left.productId).not.toBe(s.right.productId);
  });

  it("applies the condition only to the alternative product", () => {
    const s = scenarioScreen(EXPERIMENT, plan, "price_050", "A");
    const alt = s.left.productId === "B" ? s.left : s.right;
    const base = s.left.productId === "A" ? s.left : s.right;
    expect(base.price).toBe(4);
    expect(alt.price).toBe(3.5);
    expect(base.promotion).toBeNull();
    expect(alt.trustBadge).toBeNull();
  });

  it("respects the planned side of the baseline product", () => {
    for (const s of screensForPlan(EXPERIMENT, plan, "B")) {
      const item = plan.order.find((o) => o.scenarioId === s.scenarioId)!;
      expect(s[item.baselineOnLeft ? "left" : "right"].productId).toBe("B");
    }
  });
});
