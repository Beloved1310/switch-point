import { experimentVersions } from "@/config/experiments";
import { claimCode } from "@/domain/experiment/fulfilment";
import type { DashboardData } from "@/contracts/responses";
import { resolveExperiment } from "../experiments";
import type { Deps } from "../ports";
import { loadAnalysis } from "./loadAnalysis";

/** Everything the retailer dashboard shows for one experiment version (FR15–FR19). */
export async function getDashboard(deps: Deps, version?: string): Promise<DashboardData> {
  const config = resolveExperiment(version);
  const [{ analysis, reasons }, counts, fulfilments, insight] = await Promise.all([
    loadAnalysis(deps, config),
    deps.participants.counts(config.version),
    config.fulfilment.enabled ? deps.fulfilments.list(config.version) : Promise.resolve([]),
    deps.insights.latest(config.version),
  ]);
  const productName = (id: string) => config.products.find((p) => p.id === id)?.name ?? id;

  return {
    experiment: {
      version: config.version,
      category: config.category,
      products: config.products.map((p) => ({ id: p.id, name: p.name })),
    },
    versions: experimentVersions(),
    analysis,
    reasons,
    started: counts.started,
    completed: counts.completed,
    fulfilment: {
      enabled: config.fulfilment.enabled,
      rule: config.fulfilment.rule,
      fulfilled: fulfilments.filter((f) => f.status === "fulfilled").length,
      pending: fulfilments
        .filter((f) => f.status === "pending")
        .map((f) => ({
          code: claimCode(f.participantId),
          participantId: f.participantId,
          productName: productName(f.product),
        })),
    },
    insight,
    generatedAt: deps.runtime.now().toISOString(),
  };
}
