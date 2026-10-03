import type { ChoiceRecord } from "@/domain/analysis/analyze";
import { mulberry32 } from "@/domain/analysis/stats";
import { BASELINE_SCENARIO_ID } from "@/domain/experiment/types";
import type { Classification, Suggestion } from "@/domain/insight/types";
import type { InsightView, ReasonView } from "@/contracts/responses";
import type { Deps, FulfilmentRecord, NewChoice, ParticipantRecord } from "../ports";

/**
 * In-memory adapters for every port, so use cases can be tested without
 * Supabase, Groq or Next.js. Deferred tasks are collected and run on demand.
 */
export function createTestDeps(overrides: {
  classify?: (text: string) => Promise<Classification>;
  suggest?: () => Promise<Suggestion>;
  aiConfigured?: boolean;
  seed?: number;
} = {}) {
  const participants = new Map<string, ParticipantRecord>();
  const choices: (NewChoice & { id: number })[] = [];
  const reasons = new Map<string, ReasonView & { experimentVersion: string }>();
  const fulfilments = new Map<string, FulfilmentRecord & { version: string }>();
  const insights: (InsightView & { experimentVersion: string })[] = [];
  const fingerprints = new Map<string, string>();
  const notifications: string[] = [];
  const deferred: (() => Promise<void>)[] = [];
  const random = mulberry32(overrides.seed ?? 42);
  let nextId = 1;
  let clock = Date.UTC(2026, 9, 3);

  const deps: Deps = {
    participants: {
      async create({ id, experimentVersion, plan }) {
        participants.set(id, { id, experimentVersion, sayFirst: plan.sayFirst, plan, completedAt: null });
      },
      async findById(id) {
        return participants.get(id) ?? null;
      },
      async markCompleted(id, at) {
        const p = participants.get(id);
        if (p && !p.completedAt) p.completedAt = at.toISOString();
      },
      async counts(version) {
        const all = [...participants.values()].filter((p) => p.experimentVersion === version);
        return { started: all.length, completed: all.filter((p) => p.completedAt).length };
      },
    },
    choices: {
      async insert(c) {
        if (choices.some((x) => x.participantId === c.participantId && x.scenarioId === c.scenarioId)) {
          return "duplicate";
        }
        choices.push({ ...c, id: nextId++ });
        return "created";
      },
      async findBaselineProduct(pid) {
        return choices.find((c) => c.participantId === pid && c.scenarioId === BASELINE_SCENARIO_ID)?.chosenProduct ?? null;
      },
      async listForParticipant(pid) {
        return choices
          .filter((c) => c.participantId === pid)
          .map((c) => ({ id: c.id, scenarioId: c.scenarioId, chosenProduct: c.chosenProduct }));
      },
      async listRecords(version): Promise<ChoiceRecord[]> {
        return choices
          .filter((c) => c.experimentVersion === version)
          .map((c) => ({
            participantId: c.participantId,
            scenarioId: c.scenarioId,
            chosenProduct: c.chosenProduct,
            chosenSide: c.chosenSide,
            baselineProduct: c.baselineProduct,
          }));
      },
      async exportRows(version) {
        return choices.filter((c) => c.experimentVersion === version).map((c) => ({ ...c }));
      },
    },
    statedReasons: {
      async insert(r) {
        if (reasons.has(r.participantId)) return "duplicate";
        reasons.set(r.participantId, {
          participantId: r.participantId,
          experimentVersion: r.experimentVersion,
          phase: r.phase,
          reasonText: r.reasonText,
          statedPriceThreshold: r.statedPriceThreshold,
          aiStatus: "pending",
          aiCategory: null,
          aiConfidence: null,
          overrideCategory: null,
          createdAt: new Date(clock).toISOString(),
        });
        return "created";
      },
      async exists(pid) {
        return reasons.has(pid);
      },
      async saveClassification(pid, outcome) {
        const r = reasons.get(pid)!;
        r.aiStatus = outcome.status;
        if (outcome.status === "done") {
          r.aiCategory = outcome.classification.category;
          r.aiConfidence = outcome.classification.confidence;
        }
      },
      async setOverride(pid, category) {
        const r = reasons.get(pid);
        if (r) r.overrideCategory = category;
      },
      async list(version) {
        return [...reasons.values()].filter((r) => r.experimentVersion === version);
      },
      async exportRows(version) {
        return [...reasons.values()].filter((r) => r.experimentVersion === version).map((r) => ({ ...r }));
      },
    },
    fulfilments: {
      async findProduct(pid) {
        return fulfilments.get(pid)?.product ?? null;
      },
      async insert(f) {
        if (fulfilments.has(f.participantId)) return "duplicate";
        const version = participants.get(f.participantId)!.experimentVersion;
        fulfilments.set(f.participantId, { participantId: f.participantId, product: f.product, status: "pending", version });
        return "created";
      },
      async markFulfilled(pid) {
        const f = fulfilments.get(pid);
        if (f) f.status = "fulfilled";
      },
      async list(version) {
        return [...fulfilments.values()].filter((f) => f.version === version);
      },
    },
    insights: {
      async save({ experimentVersion, view }) {
        insights.push({ ...view, experimentVersion, createdAt: new Date(clock).toISOString() });
      },
      async latest(version) {
        return insights.filter((i) => i.experimentVersion === version).at(-1) ?? null;
      },
    },
    experiments: {
      async findFingerprint(version) {
        return fingerprints.get(version) ?? null;
      },
      async register(config, fingerprint) {
        fingerprints.set(config.version, fingerprint);
      },
    },
    classifier: {
      model: "test-model",
      isConfigured: () => overrides.aiConfigured ?? true,
      classify: overrides.classify ?? (async () => ({ category: "price", confidence: "high" })),
    },
    advisor: {
      model: "test-model",
      isConfigured: () => overrides.aiConfigured ?? true,
      suggest: overrides.suggest ?? (async () => { throw new Error("no advisor"); }),
    },
    notifier: {
      async resultsChanged(kind) {
        notifications.push(kind);
      },
    },
    runtime: {
      randomUnit: () => random(),
      randomInt: (n) => Math.floor(random() * n),
      newId: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      now: () => new Date((clock += 1000)),
      fingerprint: (text) => `fp:${text.length}:${text.slice(0, 64)}`,
      defer: (task) => {
        deferred.push(task);
      },
    },
  };

  return {
    deps,
    store: { participants, choices, reasons, fulfilments, insights, fingerprints, notifications },
    /** Run deferred work, as Next.js `after()` would once the response is sent. */
    async flushDeferred() {
      while (deferred.length) await deferred.shift()!();
    },
  };
}
