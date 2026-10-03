import type { ExperimentConfig } from "@/domain/experiment/types";
import { coffeeV1 } from "./coffee-v1";

/**
 * Every experiment version the app knows about. Old versions stay registered
 * so in-flight participants can finish and past results stay viewable.
 * Add a new config here and point ACTIVE_EXPERIMENT_VERSION at it to launch.
 */
const registry: Record<string, ExperimentConfig> = {
  [coffeeV1.version]: coffeeV1,
};

export const ACTIVE_EXPERIMENT_VERSION = coffeeV1.version;

export function getExperiment(version: string): ExperimentConfig | null {
  return registry[version] ?? null;
}

export function activeExperiment(): ExperimentConfig {
  return registry[ACTIVE_EXPERIMENT_VERSION];
}

export function experimentVersions(): string[] {
  return Object.keys(registry);
}
