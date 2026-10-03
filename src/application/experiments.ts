import { activeExperiment, getExperiment } from "@/config/experiments";
import type { ExperimentConfig } from "@/domain/experiment/types";
import { notFound, unavailable } from "./errors";
import type { Deps, ParticipantRecord } from "./ports";

const verified = new WeakMap<object, Set<string>>();

/**
 * Register a config version on first use, or confirm the stored copy matches.
 * A changed config under an existing version is refused (NFR6).
 */
export async function ensureRegistered(deps: Deps, config: ExperimentConfig): Promise<void> {
  const seen = verified.get(deps.experiments) ?? new Set<string>();
  verified.set(deps.experiments, seen);
  if (seen.has(config.version)) return;

  const fingerprint = deps.runtime.fingerprint(JSON.stringify(config));
  const stored = await deps.experiments.findFingerprint(config.version);
  if (stored === null) await deps.experiments.register(config, fingerprint);
  else if (stored !== fingerprint) {
    throw unavailable(
      `Experiment ${config.version} changed after data collection began. Publish it as a new version.`,
    );
  }
  seen.add(config.version);
}

export function resolveExperiment(version?: string): ExperimentConfig {
  if (!version) return activeExperiment();
  const config = getExperiment(version);
  if (!config) throw notFound(`Unknown experiment version ${version}`);
  return config;
}

/** Load a participant together with the experiment version they were enrolled in. */
export async function requireParticipant(
  deps: Deps,
  participantId: string,
): Promise<{ participant: ParticipantRecord; config: ExperimentConfig }> {
  const participant = await deps.participants.findById(participantId);
  const config = participant && getExperiment(participant.experimentVersion);
  if (!participant || !config) throw notFound("Unknown participant");
  return { participant, config };
}
