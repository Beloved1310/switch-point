import type { Analysis } from "@/domain/analysis/analyze";
import type { ExperimentConfig } from "@/domain/experiment/types";

const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));
const money = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);

/**
 * The only data the insight model sees (NFR13). Every number the model may
 * quote must appear here; percentages are whole numbers, prices in pounds.
 */
export function buildEvidencePacket(config: ExperimentConfig, a: Analysis) {
  return {
    experiment_version: config.version,
    product_category: config.category,
    participants: a.participants,
    evidence_strength: a.baseline.directional ? "directional (small sample)" : "moderate",
    interval_level_pct: 95,
    tested_conditions: a.conditions.map((c) => ({
      condition: c.label,
      levers: c.levers,
      price_discount_gbp: money(c.priceDiscount),
      participants: c.n,
      switch_rate_pct: pct(c.rate),
      interval_95_pct: c.interval ? [pct(c.interval[0]), pct(c.interval[1])] : null,
    })),
    median_observed_switch_point_gbp: money(a.switchPoints.median),
    participants_never_switching_on_price:
      a.switchPoints.distribution.find((d) => d.discount === null)?.count ?? 0,
    median_stated_price_threshold_gbp: money(a.stated.medianThreshold),
    stated_reason_shares_pct: a.stated.categoryShares.map((s) => ({
      category: s.category,
      share_pct: pct(s.share),
    })),
    say_do_by_lever: a.sayDo.leverRows.map((r) => ({
      lever: r.lever,
      stated_share_pct: pct(r.statedShare),
      observed_switch_rate_pct: pct(r.observedSwitchRate),
    })),
    acted_on_stated_lever_pct: pct(a.sayDo.actedOnStatedLeverRate),
  };
}

export type EvidencePacket = ReturnType<typeof buildEvidencePacket>;
