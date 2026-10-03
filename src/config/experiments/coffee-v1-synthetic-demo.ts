import type { ExperimentConfig } from "@/domain/experiment/types";
import { coffeeV1 } from "./coffee-v1";

/** Separate, visibly labelled version reserved for generated demo data. */
export const coffeeV1SyntheticDemo: ExperimentConfig = {
  ...coffeeV1,
  version: "v1-synthetic-demo",
  category: "SYNTHETIC DEMO · Ground coffee, 227g",
  fulfilment: {
    enabled: false,
    rule: "Synthetic demo data only. No participant choices or rewards are real.",
  },
};
