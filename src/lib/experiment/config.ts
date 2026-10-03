import type { ExperimentConfig } from "./types";

/**
 * The live experiment definition. Once data collection starts, any change to
 * products or scenarios must ship under a new `version` (NFR5, NFR6). The
 * server refuses to run if the stored config for this version differs.
 */
export const EXPERIMENT: ExperimentConfig = {
  version: "v1",
  category: "Ground coffee, 227g",
  currency: "GBP",
  products: [
    {
      id: "A",
      name: "Hearth Roast",
      description: "Medium roast ground coffee, 227g",
      basePrice: 4.0,
    },
    {
      id: "B",
      name: "Ridgeline",
      description: "Medium roast ground coffee, 227g",
      basePrice: 4.0,
    },
  ],
  scenarios: [
    {
      id: "price_020",
      levers: ["price"],
      label: "£0.20 cheaper",
      condition: { priceDiscount: 0.2, promotion: null, trustBadge: null },
    },
    {
      id: "price_050",
      levers: ["price"],
      label: "£0.50 cheaper",
      condition: { priceDiscount: 0.5, promotion: null, trustBadge: null },
    },
    {
      id: "price_100",
      levers: ["price"],
      label: "£1.00 cheaper",
      condition: { priceDiscount: 1.0, promotion: null, trustBadge: null },
    },
    {
      id: "price_150",
      levers: ["price"],
      label: "£1.50 cheaper",
      condition: { priceDiscount: 1.5, promotion: null, trustBadge: null },
    },
    {
      id: "promo_extra",
      levers: ["promotion"],
      label: "Promotion: 20% extra free",
      condition: { priceDiscount: 0, promotion: "20% extra free", trustBadge: null },
    },
    {
      id: "trust_rating",
      levers: ["trust"],
      label: "Trust: highly rated badge",
      condition: {
        priceDiscount: 0,
        promotion: null,
        trustBadge: "Rated 4.8/5 by shoppers",
      },
    },
    {
      id: "price_020_promo",
      levers: ["price", "promotion"],
      label: "£0.20 cheaper + 20% extra free",
      condition: { priceDiscount: 0.2, promotion: "20% extra free", trustBadge: null },
    },
  ],
  fulfilment: {
    enabled: true,
    rule: "One controlled choice per participant is drawn uniformly at random by the server; the chosen product in that round is the one honoured.",
  },
};

export const BASELINE_SCENARIO_ID = "baseline";
