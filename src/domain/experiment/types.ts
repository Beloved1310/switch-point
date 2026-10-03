export type ProductId = "A" | "B";
export type Side = "left" | "right";

/** Scenario id of the first, unmanipulated choice. */
export const BASELINE_SCENARIO_ID = "baseline";
/** Behavioural levers that scenarios can manipulate. */
export type Lever = "price" | "promotion" | "trust";

/** Categories a free-text switching reason can be classified into. */
export const REASON_CATEGORIES = [
  "price",
  "promotion",
  "trust",
  "quality",
  "habit",
  "other",
] as const;
export type ReasonCategory = (typeof REASON_CATEGORIES)[number];

export interface Product {
  id: ProductId;
  name: string;
  description: string;
  basePrice: number;
}

/**
 * What the scenario changes on the alternative (non-baseline) product.
 * Everything not listed here stays identical between the two products (FR7).
 */
export interface Condition {
  priceDiscount: number;
  promotion: string | null;
  trustBadge: string | null;
}

export interface Scenario {
  id: string;
  /** Levers this scenario manipulates; more than one means a combination. */
  levers: Lever[];
  label: string;
  condition: Condition;
}

export interface ExperimentConfig {
  version: string;
  category: string;
  currency: string;
  products: [Product, Product];
  scenarios: Scenario[];
  fulfilment: { enabled: boolean; rule: string };
}

export interface PlanItem {
  scenarioId: string;
  /** Whether the participant's baseline product appears on the left. */
  baselineOnLeft: boolean;
}

/** Server-generated randomisation for one participant (FR8, FR9, NFR4). */
export interface ParticipantPlan {
  sayFirst: boolean;
  baselineLeft: ProductId;
  order: PlanItem[];
}

export interface ProductView {
  productId: ProductId;
  name: string;
  description: string;
  price: number;
  promotion: string | null;
  trustBadge: string | null;
}

export interface Screen {
  scenarioId: string;
  left: ProductView;
  right: ProductView;
}
