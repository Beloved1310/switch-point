import type { ExperimentConfig, Lever, ProductId, ReasonCategory, Side } from "@/domain/experiment/types";
import { bootstrapInterval, mean, median, type Interval } from "./stats";

/** Below this many participants a result is labelled directional (FR19, NFR16). */
export const DIRECTIONAL_THRESHOLD = 30;

export interface ChoiceRecord {
  participantId: string;
  scenarioId: string;
  chosenProduct: ProductId;
  chosenSide: Side;
  /** Null for the baseline choice itself. */
  baselineProduct: ProductId | null;
}

export interface StatedRecord {
  participantId: string;
  phase: "before" | "after";
  statedPriceThreshold: number | null;
  /** Override if an admin set one, otherwise the AI category, otherwise null. */
  category: ReasonCategory | null;
}

export interface Measured {
  n: number;
  directional: boolean;
}

export interface ConditionResult extends Measured {
  scenarioId: string;
  label: string;
  levers: Lever[];
  priceDiscount: number;
  switches: number;
  rate: number | null;
  interval: Interval | null;
}

export interface ParticipantSayDo {
  participantId: string;
  statedThreshold: number | null;
  observedSwitchPoint: number | null;
  priceGap: PriceGap | null;
  statedCategory: ReasonCategory | null;
  /** Levers the participant actually switched on in single-lever scenarios. */
  switchedOn: Lever[];
  actedOnStatedLever: boolean | null;
}

export type PriceGap =
  | "matched"
  | "switched_sooner"
  | "switched_later"
  | "never_switched"
  | "no_price_switch_expected";

export interface Analysis {
  experimentVersion: string;
  participants: number;
  baseline: Measured & { shares: Record<ProductId, number> };
  leftChoiceRate: Measured & { rate: number | null };
  conditions: ConditionResult[];
  switchPoints: Measured & {
    distribution: { discount: number | null; count: number }[];
    median: number | null;
    medianInterval: Interval | null;
  };
  stated: Measured & {
    categoryShares: { category: ReasonCategory; count: number; share: number }[];
    medianThreshold: number | null;
    medianThresholdInterval: Interval | null;
  };
  sayDo: Measured & {
    priceGaps: { gap: PriceGap; count: number }[];
    meanPriceGap: number | null;
    meanPriceGapInterval: Interval | null;
    leverRows: {
      lever: Lever;
      statedShare: number | null;
      observedSwitchRate: number | null;
      n: number;
    }[];
    actedOnStatedLeverRate: number | null;
    actedOnStatedLeverN: number;
  };
  byParticipant: ParticipantSayDo[];
}

const LEVERS: Lever[] = ["price", "promotion", "trust"];

const measured = (n: number): Measured => ({ n, directional: n < DIRECTIONAL_THRESHOLD });

/**
 * Observed price switch point: the smallest tested discount at which the
 * participant chose the alternative, or null if they never did (FR13).
 */
export function priceSwitchPoint(
  priceOutcomes: { discount: number; switched: boolean }[],
): number | null {
  const switched = priceOutcomes.filter((o) => o.switched).map((o) => o.discount);
  return switched.length ? Math.min(...switched) : null;
}

/**
 * Compare a stated price threshold with observed behaviour. The stated
 * threshold predicts a switch at the first tested discount that meets it.
 */
export function classifyPriceGap(
  stated: number,
  observed: number | null,
  testedDiscounts: number[],
): PriceGap {
  const predicted = [...testedDiscounts].sort((a, b) => a - b).find((d) => d >= stated);
  if (predicted === undefined) return observed === null ? "no_price_switch_expected" : "switched_sooner";
  if (observed === null) return "never_switched";
  if (observed === predicted) return "matched";
  return observed < predicted ? "switched_sooner" : "switched_later";
}

export function analyze(
  config: ExperimentConfig,
  choices: ChoiceRecord[],
  stated: StatedRecord[],
): Analysis {
  const baselineByP = new Map<string, ProductId>();
  for (const c of choices) {
    if (c.baselineProduct === null) baselineByP.set(c.participantId, c.chosenProduct);
  }
  const participantIds = [...baselineByP.keys()];

  const controlled = choices.filter(
    (c) => c.baselineProduct !== null && baselineByP.has(c.participantId),
  );
  const switchedOf = (c: ChoiceRecord) => c.chosenProduct !== c.baselineProduct;

  // Baseline preference
  const shares: Record<ProductId, number> = { A: 0, B: 0 };
  for (const p of baselineByP.values()) shares[p]++;

  // Position bias check
  const sides = choices.map((c) => (c.chosenSide === "left" ? 1 : 0));

  // Switch rate per condition (FR14, FR15)
  const conditions: ConditionResult[] = config.scenarios.map((s, i) => {
    const outcomes = controlled
      .filter((c) => c.scenarioId === s.id)
      .map((c) => (switchedOf(c) ? 1 : 0));
    const switches = outcomes.reduce<number>((a, b) => a + b, 0);
    return {
      scenarioId: s.id,
      label: s.label,
      levers: s.levers,
      priceDiscount: s.condition.priceDiscount,
      switches,
      rate: outcomes.length ? switches / outcomes.length : null,
      interval: bootstrapInterval(outcomes, mean, { seed: 100 + i }),
      ...measured(outcomes.length),
    };
  });

  const priceScenarios = config.scenarios.filter(
    (s) => s.levers.length === 1 && s.levers[0] === "price",
  );
  const testedDiscounts = priceScenarios.map((s) => s.condition.priceDiscount);
  const singleLeverScenario = new Map(
    config.scenarios.filter((s) => s.levers.length === 1).map((s) => [s.id, s.levers[0]]),
  );

  const statedByP = new Map(stated.map((s) => [s.participantId, s]));

  // Per-participant say vs do (FR16)
  const byParticipant: ParticipantSayDo[] = participantIds.map((pid) => {
    const mine = controlled.filter((c) => c.participantId === pid);
    const priceOutcomes = mine.flatMap((c) => {
      const s = priceScenarios.find((p) => p.id === c.scenarioId);
      return s ? [{ discount: s.condition.priceDiscount, switched: switchedOf(c) }] : [];
    });
    const answeredAllPrice = priceOutcomes.length === priceScenarios.length;
    const observed = answeredAllPrice ? priceSwitchPoint(priceOutcomes) : null;

    const switchedOn = new Set<Lever>();
    for (const c of mine) {
      const lever = singleLeverScenario.get(c.scenarioId);
      if (lever && switchedOf(c)) switchedOn.add(lever);
    }

    const st = statedByP.get(pid);
    const statedThreshold = st?.statedPriceThreshold ?? null;
    const statedCategory = st?.category ?? null;
    const statedLever = LEVERS.find((l) => l === statedCategory);

    return {
      participantId: pid,
      statedThreshold,
      observedSwitchPoint: observed,
      priceGap:
        statedThreshold !== null && answeredAllPrice
          ? classifyPriceGap(statedThreshold, observed, testedDiscounts)
          : null,
      statedCategory,
      switchedOn: [...switchedOn],
      actedOnStatedLever: statedLever ? switchedOn.has(statedLever) : null,
    };
  });

  // Switch point distribution
  const withPoints = byParticipant.filter((p) =>
    priceScenarios.every((s) =>
      controlled.some((c) => c.participantId === p.participantId && c.scenarioId === s.id),
    ),
  );
  const observedPoints = withPoints
    .map((p) => p.observedSwitchPoint)
    .filter((x): x is number => x !== null);
  const distribution = [
    ...[...testedDiscounts]
      .sort((a, b) => a - b)
      .map((d) => ({
        discount: d as number | null,
        count: observedPoints.filter((x) => x === d).length,
      })),
    { discount: null, count: withPoints.length - observedPoints.length },
  ];

  // Stated drivers
  const categorised = stated.filter((s) => s.category !== null);
  const categoryCounts = new Map<ReasonCategory, number>();
  for (const s of categorised) categoryCounts.set(s.category!, (categoryCounts.get(s.category!) ?? 0) + 1);
  const categoryShares = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count, share: count / categorised.length }))
    .sort((a, b) => b.count - a.count);
  const thresholds = stated
    .map((s) => s.statedPriceThreshold)
    .filter((x): x is number => x !== null);

  // Say-do aggregates
  const gapped = byParticipant.filter((p) => p.priceGap !== null);
  const gapOrder: PriceGap[] = [
    "matched",
    "switched_sooner",
    "switched_later",
    "never_switched",
    "no_price_switch_expected",
  ];
  const numericGaps = byParticipant
    .filter((p) => p.statedThreshold !== null && p.observedSwitchPoint !== null)
    .map((p) => p.observedSwitchPoint! - p.statedThreshold!);

  const leverRows = LEVERS.map((lever) => {
    const statedShare = categorised.length
      ? categorised.filter((s) => s.category === lever).length / categorised.length
      : null;
    const leverScenarioIds = [...singleLeverScenario.entries()]
      .filter(([, l]) => l === lever)
      .map(([id]) => id);
    // A participant "switches on" a lever if they switched in any of its scenarios.
    const exposed = participantIds.filter((pid) =>
      controlled.some((c) => c.participantId === pid && leverScenarioIds.includes(c.scenarioId)),
    );
    const switched = exposed.filter((pid) =>
      byParticipant.find((p) => p.participantId === pid)!.switchedOn.includes(lever),
    );
    return {
      lever,
      statedShare,
      observedSwitchRate: exposed.length ? switched.length / exposed.length : null,
      n: exposed.length,
    };
  });

  const acted = byParticipant.filter((p) => p.actedOnStatedLever !== null);

  return {
    experimentVersion: config.version,
    participants: participantIds.length,
    baseline: { shares, ...measured(participantIds.length) },
    leftChoiceRate: { rate: sides.length ? mean(sides) : null, ...measured(sides.length) },
    conditions,
    switchPoints: {
      distribution,
      median: median(observedPoints),
      medianInterval: bootstrapInterval(observedPoints, median, { seed: 7 }),
      ...measured(withPoints.length),
    },
    stated: {
      categoryShares,
      medianThreshold: median(thresholds),
      medianThresholdInterval: bootstrapInterval(thresholds, median, { seed: 11 }),
      ...measured(stated.length),
    },
    sayDo: {
      priceGaps: gapOrder.map((gap) => ({
        gap,
        count: gapped.filter((p) => p.priceGap === gap).length,
      })),
      meanPriceGap: numericGaps.length ? mean(numericGaps) : null,
      meanPriceGapInterval: bootstrapInterval(numericGaps, mean, { seed: 13 }),
      leverRows,
      actedOnStatedLeverRate: acted.length
        ? acted.filter((p) => p.actedOnStatedLever).length / acted.length
        : null,
      actedOnStatedLeverN: acted.length,
      ...measured(gapped.length),
    },
    byParticipant,
  };
}
