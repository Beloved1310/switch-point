import "server-only";
import { createHash } from "node:crypto";
import { EXPERIMENT } from "../experiment/config";
import type { ParticipantPlan } from "../experiment/types";
import { serviceDb } from "./supabase";

let verifiedVersion: string | null = null;

/**
 * Register the current config version, or confirm the stored copy is
 * identical. A changed config under the same version is refused (NFR6).
 */
export async function ensureExperiment(): Promise<void> {
  if (verifiedVersion === EXPERIMENT.version) return;
  const hash = createHash("sha256").update(JSON.stringify(EXPERIMENT)).digest("hex");
  const db = serviceDb();
  const { data, error } = await db
    .from("experiments")
    .select("config_hash")
    .eq("version", EXPERIMENT.version)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insertError } = await db
      .from("experiments")
      .insert({ version: EXPERIMENT.version, config: EXPERIMENT, config_hash: hash });
    if (insertError && insertError.code !== "23505") throw insertError;
  } else if (data.config_hash !== hash) {
    throw new Error(
      `Experiment config for ${EXPERIMENT.version} changed after data collection began. Bump the version.`,
    );
  }
  verifiedVersion = EXPERIMENT.version;
}

export interface ParticipantRow {
  id: string;
  experiment_version: string;
  say_first: boolean;
  plan: ParticipantPlan;
  completed_at: string | null;
}

export async function loadParticipant(id: string): Promise<ParticipantRow | null> {
  const { data, error } = await serviceDb()
    .from("participants")
    .select("id, experiment_version, say_first, plan, completed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ParticipantRow | null;
}
