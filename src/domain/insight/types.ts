import type { Lever, ReasonCategory } from "@/domain/experiment/types";

export type Confidence = "low" | "medium" | "high";

export interface Classification {
  category: ReasonCategory;
  confidence: Confidence;
}

export interface ProposedCondition {
  label: string;
  price_discount_gbp: number;
  promotion: string | null;
  trust_badge: string | null;
}

/** An AI-proposed next experiment. Interpretation only, never a measured result. */
export interface Suggestion {
  title: string;
  hypothesis: string;
  rationale: string;
  lever: Lever;
  proposed_conditions: ProposedCondition[];
}

/** The text fields a suggestion makes claims in; these must be grounded (FR21). */
export const suggestionClaims = (s: Suggestion) => [s.title, s.hypothesis, s.rationale];
