import { buildEvidencePacket } from "@/domain/insight/evidence";
import { ungroundedNumbers } from "@/domain/insight/grounding";
import { suggestionClaims } from "@/domain/insight/types";
import type { InsightView } from "@/contracts/responses";
import { conflict, unavailable } from "../errors";
import { resolveExperiment } from "../experiments";
import type { Deps } from "../ports";
import { loadAnalysis } from "./loadAnalysis";

/**
 * Propose one next experiment from the evidence packet only (FR20, NFR13).
 * Runs on request, never per response (NFR17). Any number in the narrative
 * that is not in the packet suppresses the suggestion (FR21).
 */
export async function generateInsight(deps: Deps, version?: string): Promise<InsightView> {
  if (!deps.advisor.isConfigured()) throw unavailable("AI is not configured");
  const config = resolveExperiment(version);
  const { analysis } = await loadAnalysis(deps, config);
  if (analysis.participants === 0) throw conflict("No results yet");

  const evidence = buildEvidencePacket(config, analysis);
  let view: Omit<InsightView, "createdAt">;
  try {
    const suggestion = await deps.advisor.suggest(evidence);
    const ungrounded = ungroundedNumbers(suggestionClaims(suggestion), evidence);
    view = ungrounded.length
      ? {
          status: "rejected",
          suggestion: null,
          detail: `Suppressed: the AI quoted numbers not in the evidence (${ungrounded.join(", ")}).`,
        }
      : { status: "accepted", suggestion, detail: null };
  } catch (error) {
    deps.runtime.reportError("generate insight", error);
    view = {
      status: "failed",
      suggestion: null,
      detail: "The AI service was unavailable or returned an invalid response.",
    };
  }

  await deps.insights.save({ experimentVersion: config.version, evidence, model: deps.advisor.model, view });
  return { ...view, createdAt: deps.runtime.now().toISOString() };
}
