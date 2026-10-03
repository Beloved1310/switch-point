import { BASELINE_SCENARIO_ID } from "./config";
import type {
  ExperimentConfig,
  ParticipantPlan,
  ProductId,
  ProductView,
  Scenario,
  Screen,
  Side,
} from "./types";

export type Random = () => number;

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Randomise scenario order, product sides and say-first/do-first (FR8, FR9). */
export function createPlan(config: ExperimentConfig, random: Random): ParticipantPlan {
  return {
    sayFirst: random() < 0.5,
    baselineLeft: random() < 0.5 ? "A" : "B",
    order: shuffle(config.scenarios, random).map((s) => ({
      scenarioId: s.id,
      baselineOnLeft: random() < 0.5,
    })),
  };
}

export function otherProduct(id: ProductId): ProductId {
  return id === "A" ? "B" : "A";
}

function plainView(config: ExperimentConfig, id: ProductId): ProductView {
  const p = config.products.find((x) => x.id === id)!;
  return {
    productId: p.id,
    name: p.name,
    description: p.description,
    price: p.basePrice,
    promotion: null,
    trustBadge: null,
  };
}

export function findScenario(config: ExperimentConfig, id: string): Scenario | undefined {
  return config.scenarios.find((s) => s.id === id);
}

export function baselineScreen(config: ExperimentConfig, plan: ParticipantPlan): Screen {
  return {
    scenarioId: BASELINE_SCENARIO_ID,
    left: plainView(config, plan.baselineLeft),
    right: plainView(config, otherProduct(plan.baselineLeft)),
  };
}

/**
 * Build the screen for a controlled scenario. Only the alternative product
 * (the one not chosen at baseline) receives the scenario's condition.
 */
export function scenarioScreen(
  config: ExperimentConfig,
  plan: ParticipantPlan,
  scenarioId: string,
  baselineProduct: ProductId,
): Screen {
  const scenario = findScenario(config, scenarioId);
  const item = plan.order.find((o) => o.scenarioId === scenarioId);
  if (!scenario || !item) throw new Error(`Scenario ${scenarioId} not in plan`);

  const base = plainView(config, baselineProduct);
  const altBase = plainView(config, otherProduct(baselineProduct));
  const alt: ProductView = {
    ...altBase,
    price: round2(altBase.price - scenario.condition.priceDiscount),
    promotion: scenario.condition.promotion,
    trustBadge: scenario.condition.trustBadge,
  };
  return item.baselineOnLeft
    ? { scenarioId, left: base, right: alt }
    : { scenarioId, left: alt, right: base };
}

export function screensForPlan(
  config: ExperimentConfig,
  plan: ParticipantPlan,
  baselineProduct: ProductId,
): Screen[] {
  return plan.order.map((o) => scenarioScreen(config, plan, o.scenarioId, baselineProduct));
}

export function productOnSide(screen: Screen, side: Side): ProductId {
  return screen[side].productId;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
