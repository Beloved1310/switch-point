import { DIRECTIONAL_THRESHOLD } from "@/domain/analysis/analyze";
import type { Lever } from "@/domain/experiment/types";
import type { DashboardData } from "@/contracts/responses";
import { gbp, pct } from "./format";

/**
 * Plain-language summaries of the measured results, so a retailer can see
 * what was learned and what needs action without reading every chart.
 * Every sentence is built from numbers the analysis module already calculated.
 */

export type DashboardTab = "summary" | "behaviour" | "saydo" | "reasons" | "rewards";

export interface AttentionItem {
  tone: "warn" | "info";
  title: string;
  detail: string;
  action?: { label: string; tab: DashboardTab };
}

export interface Finding {
  label: string;
  headline: string;
  detail: string;
  tab: DashboardTab;
}

const LEVER_NOUN: Record<Lever, string> = {
  price: "price",
  promotion: "promotions",
  trust: "trust badges",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Problems and to-dos, most important first. Empty when nothing needs action. */
export function attentionItems(data: DashboardData): AttentionItem[] {
  const a = data.analysis;
  const items: AttentionItem[] = [];

  if (data.started === 0) {
    items.push({
      tone: "info",
      title: "No responses yet",
      detail: "Share the QR code or the study link to start collecting answers.",
    });
  } else if (a.participants < DIRECTIONAL_THRESHOLD) {
    items.push({
      tone: "warn",
      title: `Only ${a.participants} of the ${DIRECTIONAL_THRESHOLD} people needed so far`,
      detail: `Treat these results as early signals. Wait for at least ${DIRECTIONAL_THRESHOLD} people before acting on them.`,
    });
  }

  const unfinished = data.started - data.completed;
  if (data.started >= 5 && unfinished / data.started > 0.3) {
    items.push({
      tone: "warn",
      title: `${unfinished} of ${data.started} people have not finished`,
      detail: "Some may still be taking part. If this stays high, the study may be too long or confusing.",
    });
  }

  const left = a.leftChoiceRate;
  if (left.rate !== null && left.n >= 20 && Math.abs(left.rate - 0.5) > 0.15) {
    const side = left.rate > 0.5 ? "left" : "right";
    items.push({
      tone: "warn",
      title: `People picked the ${side}-hand product ${pct(Math.max(left.rate, 1 - left.rate))} of the time`,
      detail: "Screen position may be swaying choices more than the offers are.",
      action: { label: "See behaviour", tab: "behaviour" },
    });
  }

  const unsorted = data.reasons.filter((r) => r.aiStatus === "failed" || r.aiStatus === "skipped").length;
  if (unsorted > 0) {
    items.push({
      tone: "warn",
      title: `${plural(unsorted, "reason")} not sorted by AI`,
      detail: "Retry the AI, or choose the category yourself.",
      action: { label: "Review reasons", tab: "reasons" },
    });
  }

  if (data.fulfilment.enabled && data.fulfilment.pending.length > 0) {
    items.push({
      tone: "info",
      title: `${plural(data.fulfilment.pending.length, "reward")} waiting to be handed over`,
      detail: "Check the shopper's claim code, then mark the product as handed over.",
      action: { label: "Open rewards", tab: "rewards" },
    });
  }

  const mixed = a.switchPoints.nonMonotonicCount;
  if (mixed > 0) {
    items.push({
      tone: "info",
      title: `${plural(mixed, "shopper")} gave mixed price answers`,
      detail: "They switched at a small discount but not at a bigger one. Their answers are kept as given.",
      action: { label: "See price answers", tab: "behaviour" },
    });
  }

  return items;
}

/** The main lessons so far, written as sentences. */
export function keyFindings(data: DashboardData): Finding[] {
  const a = data.analysis;
  const findings: Finding[] = [];

  const measured = a.conditions.filter((c) => c.rate !== null && c.n > 0);
  if (measured.length > 0) {
    const sorted = [...measured].sort((x, y) => (y.rate ?? 0) - (x.rate ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    findings.push({
      label: "Strongest offer",
      headline: `${best.label} made ${pct(best.rate)} of shoppers switch`,
      detail:
        worst.scenarioId === best.scenarioId
          ? `${best.switches} of ${best.n} people switched.`
          : `The weakest offer was "${worst.label}", at ${pct(worst.rate)}.`,
      tab: "behaviour",
    });
  }

  const levers = a.sayDo.leverRows.filter((r) => r.statedShare !== null && r.observedSwitchRate !== null);
  if (levers.length > 0) {
    const mostNamed = levers.reduce((x, y) => ((y.statedShare ?? 0) > (x.statedShare ?? 0) ? y : x));
    const mostEffective = levers.reduce((x, y) =>
      (y.observedSwitchRate ?? 0) > (x.observedSwitchRate ?? 0) ? y : x,
    );
    findings.push(
      mostNamed.lever === mostEffective.lever
        ? {
            label: "Say vs do",
            headline: `Shoppers were right: ${LEVER_NOUN[mostNamed.lever]} moved them most`,
            detail: `${pct(mostNamed.statedShare)} named ${LEVER_NOUN[mostNamed.lever]} as their reason, and ${pct(mostNamed.observedSwitchRate)} switched for them.`,
            tab: "saydo",
          }
        : {
            label: "Say vs do",
            headline: `Shoppers say they care most about ${LEVER_NOUN[mostNamed.lever]}, but ${LEVER_NOUN[mostEffective.lever]} moved more of them`,
            detail: `${pct(mostEffective.observedSwitchRate)} switched for ${LEVER_NOUN[mostEffective.lever]}, compared with ${pct(mostNamed.observedSwitchRate)} for ${LEVER_NOUN[mostNamed.lever]}.`,
            tab: "saydo",
          },
    );
  }

  const stated = a.stated.medianThreshold;
  const observed = a.switchPoints.median;
  if (stated !== null && observed !== null) {
    const diff = observed - stated;
    findings.push({
      label: "Price",
      headline:
        Math.abs(diff) < 0.005
          ? `Shoppers switch at the discount they say they need: ${gbp(observed)} off`
          : diff < 0
            ? `Shoppers switch for less than they think: ${gbp(observed)} off, not ${gbp(stated)}`
            : `Shoppers need more than they think: ${gbp(observed)} off, not ${gbp(stated)}`,
      detail: "The typical discount people said they would need, compared with the smallest discount at which they actually switched.",
      tab: "behaviour",
    });
  }

  if (a.sayDo.actedOnStatedLeverRate !== null) {
    findings.push({
      label: "Honesty check",
      headline: `${pct(a.sayDo.actedOnStatedLeverRate)} switched for the reason they gave`,
      detail: `Based on ${a.sayDo.actedOnStatedLeverN === 1 ? "1 person" : `${a.sayDo.actedOnStatedLeverN} people`} who named price, a promotion or trust as their reason.`,
      tab: "saydo",
    });
  }

  return findings;
}
