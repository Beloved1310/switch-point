import { analyze, type Analysis, type StatedRecord } from "@/domain/analysis/analyze";
import type { ExperimentConfig } from "@/domain/experiment/types";
import type { ReasonView } from "@/contracts/responses";
import type { Deps } from "../ports";

/** The category used in analysis: an admin override wins over the AI label (FR12). */
export const effectiveCategory = (r: ReasonView) => r.overrideCategory ?? r.aiCategory;

/** Load raw responses for a version and run the deterministic analysis. */
export async function loadAnalysis(
  deps: Deps,
  config: ExperimentConfig,
): Promise<{ analysis: Analysis; reasons: ReasonView[] }> {
  const [choices, reasons] = await Promise.all([
    deps.choices.listRecords(config.version),
    deps.statedReasons.list(config.version),
  ]);
  const stated: StatedRecord[] = reasons.map((r) => ({
    participantId: r.participantId,
    phase: r.phase,
    statedPriceThreshold: r.statedPriceThreshold,
    category: effectiveCategory(r),
  }));
  return { analysis: analyze(config, choices, stated), reasons };
}
