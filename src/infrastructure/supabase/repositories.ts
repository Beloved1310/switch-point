import "server-only";
import type { ChoiceRecord } from "@/domain/analysis/analyze";
import { BASELINE_SCENARIO_ID, REASON_CATEGORIES, type ProductId, type ReasonCategory } from "@/domain/experiment/types";
import type { InsightView, ReasonView } from "@/contracts/responses";
import type {
  ChoiceRepository,
  ExperimentRepository,
  FulfilmentRepository,
  InsertResult,
  InsightRepository,
  ParticipantRepository,
  StatedReasonRepository,
} from "@/application/ports";
import { unavailable } from "@/application/errors";
import { isNetworkFailure, isUniqueViolation, publicDb, serviceDb } from "./clients";

/**
 * Supabase implementations of the repository ports.
 * Participant-originated inserts use the anon client, which RLS limits to
 * INSERT only (NFR3); reads and admin writes use the service role (NFR2).
 */

const ROW_LIMIT = 10_000;
const EXPORT_LIMIT = 50_000;

function check(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (isNetworkFailure(error)) throw unavailable("The database is not responding. Please try again.");
  throw new Error(error.message);
}

function insertResult(error: { code?: string; message: string } | null): InsertResult {
  if (isUniqueViolation(error)) return "duplicate";
  check(error);
  return "created";
}

const asCategory = (v: unknown): ReasonCategory | null =>
  REASON_CATEGORIES.includes(v as ReasonCategory) ? (v as ReasonCategory) : null;

export const participantRepository: ParticipantRepository = {
  async create({ id, experimentVersion, plan }) {
    const { error } = await publicDb()
      .from("participants")
      .insert({ id, experiment_version: experimentVersion, say_first: plan.sayFirst, plan });
    check(error);
  },

  async findById(id) {
    const { data, error } = await serviceDb()
      .from("participants")
      .select("id, experiment_version, say_first, plan, completed_at")
      .eq("id", id)
      .maybeSingle();
    check(error);
    return data
      ? {
          id: data.id,
          experimentVersion: data.experiment_version,
          sayFirst: data.say_first,
          plan: data.plan,
          completedAt: data.completed_at,
        }
      : null;
  },

  async markCompleted(id, at) {
    const { error } = await serviceDb()
      .from("participants")
      .update({ completed_at: at.toISOString() })
      .eq("id", id)
      .is("completed_at", null);
    check(error);
  },

  async counts(version) {
    const db = serviceDb();
    const [started, completed] = await Promise.all([
      db.from("participants").select("id", { count: "exact", head: true }).eq("experiment_version", version),
      db
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("experiment_version", version)
        .not("completed_at", "is", null),
    ]);
    check(started.error);
    check(completed.error);
    return { started: started.count ?? 0, completed: completed.count ?? 0 };
  },
};

export const choiceRepository: ChoiceRepository = {
  async insert(c) {
    const { error } = await publicDb().from("choices").insert({
      participant_id: c.participantId,
      experiment_version: c.experimentVersion,
      scenario_id: c.scenarioId,
      levers: c.levers,
      condition: c.condition,
      left_product: c.screen.left.productId,
      right_product: c.screen.right.productId,
      left_view: c.screen.left,
      right_view: c.screen.right,
      chosen_side: c.chosenSide,
      chosen_product: c.chosenProduct,
      baseline_product: c.baselineProduct,
      switched: c.switched,
    });
    return insertResult(error);
  },

  async findBaselineProduct(participantId) {
    const { data, error } = await serviceDb()
      .from("choices")
      .select("chosen_product")
      .eq("participant_id", participantId)
      .eq("scenario_id", BASELINE_SCENARIO_ID)
      .maybeSingle();
    check(error);
    return (data?.chosen_product as ProductId | undefined) ?? null;
  },

  async listForParticipant(participantId) {
    const { data, error } = await serviceDb()
      .from("choices")
      .select("id, scenario_id, chosen_product")
      .eq("participant_id", participantId);
    check(error);
    return (data ?? []).map((c) => ({ id: c.id, scenarioId: c.scenario_id, chosenProduct: c.chosen_product }));
  },

  async listRecords(version): Promise<ChoiceRecord[]> {
    const { data, error } = await serviceDb()
      .from("choices")
      .select("participant_id, scenario_id, chosen_product, chosen_side, baseline_product")
      .eq("experiment_version", version)
      .limit(ROW_LIMIT);
    check(error);
    return (data ?? []).map((c) => ({
      participantId: c.participant_id,
      scenarioId: c.scenario_id,
      chosenProduct: c.chosen_product,
      chosenSide: c.chosen_side,
      baselineProduct: c.baseline_product,
    }));
  },

  async exportRows(version, columns) {
    const { data, error } = await serviceDb()
      .from("choices")
      .select(columns.join(", "))
      .eq("experiment_version", version)
      .order("created_at")
      .limit(EXPORT_LIMIT);
    check(error);
    return (data ?? []) as unknown as Record<string, unknown>[];
  },
};

export const statedReasonRepository: StatedReasonRepository = {
  async insert(r) {
    const { error } = await publicDb().from("stated_reasons").insert({
      participant_id: r.participantId,
      experiment_version: r.experimentVersion,
      phase: r.phase,
      reason_text: r.reasonText,
      stated_price_threshold: r.statedPriceThreshold,
    });
    return insertResult(error);
  },

  async exists(participantId) {
    const { data, error } = await serviceDb()
      .from("stated_reasons")
      .select("participant_id")
      .eq("participant_id", participantId)
      .maybeSingle();
    check(error);
    return data !== null;
  },

  async saveClassification(participantId, outcome) {
    const update =
      outcome.status === "done"
        ? {
            ai_status: "done",
            ai_category: outcome.classification.category,
            ai_confidence: outcome.classification.confidence,
            ai_model: outcome.model,
          }
        : { ai_status: outcome.status };
    const { error } = await serviceDb().from("stated_reasons").update(update).eq("participant_id", participantId);
    check(error);
  },

  async listUnclassified(version, stalledBefore, limit) {
    const { data, error } = await serviceDb()
      .from("stated_reasons")
      .select("participant_id, reason_text")
      .eq("experiment_version", version)
      .or(`ai_status.in.(failed,skipped),and(ai_status.eq.pending,created_at.lt.${stalledBefore.toISOString()})`)
      .order("created_at")
      .limit(limit);
    check(error);
    return (data ?? []).map((s) => ({ participantId: s.participant_id, reasonText: s.reason_text }));
  },

  async setOverride(participantId, category, at) {
    const { error } = await serviceDb()
      .from("stated_reasons")
      .update({ override_category: category, override_at: category ? at.toISOString() : null })
      .eq("participant_id", participantId);
    check(error);
  },

  async list(version): Promise<ReasonView[]> {
    const { data, error } = await serviceDb()
      .from("stated_reasons")
      .select(
        "participant_id, phase, reason_text, stated_price_threshold, ai_status, ai_category, ai_confidence, override_category, created_at",
      )
      .eq("experiment_version", version)
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT);
    check(error);
    return (data ?? []).map((s) => ({
      participantId: s.participant_id,
      phase: s.phase,
      reasonText: s.reason_text,
      statedPriceThreshold: s.stated_price_threshold === null ? null : Number(s.stated_price_threshold),
      aiStatus: s.ai_status,
      aiCategory: asCategory(s.ai_category),
      aiConfidence: s.ai_confidence,
      overrideCategory: asCategory(s.override_category),
      createdAt: s.created_at,
    }));
  },

  async exportRows(version, columns) {
    const { data, error } = await serviceDb()
      .from("stated_reasons")
      .select(columns.join(", "))
      .eq("experiment_version", version)
      .order("created_at")
      .limit(EXPORT_LIMIT);
    check(error);
    return (data ?? []) as unknown as Record<string, unknown>[];
  },
};

export const fulfilmentRepository: FulfilmentRepository = {
  async findProduct(participantId) {
    const { data, error } = await serviceDb()
      .from("fulfilments")
      .select("product")
      .eq("participant_id", participantId)
      .maybeSingle();
    check(error);
    return (data?.product as ProductId | undefined) ?? null;
  },

  async insert(f) {
    const { error } = await serviceDb()
      .from("fulfilments")
      .insert({ participant_id: f.participantId, choice_id: f.choiceId, product: f.product });
    return insertResult(error);
  },

  async markFulfilled(participantId, at) {
    const { error } = await serviceDb()
      .from("fulfilments")
      .update({ status: "fulfilled", fulfilled_at: at.toISOString() })
      .eq("participant_id", participantId);
    check(error);
  },

  async list(version) {
    const { data, error } = await serviceDb()
      .from("fulfilments")
      .select("participant_id, product, status, created_at, participants!inner(experiment_version)")
      .eq("participants.experiment_version", version)
      .order("created_at", { ascending: true })
      .limit(ROW_LIMIT);
    check(error);
    return (data ?? []).map((f) => ({ participantId: f.participant_id, product: f.product, status: f.status }));
  },
};

export const insightRepository: InsightRepository = {
  async save({ experimentVersion, evidence, model, view }) {
    const { error } = await serviceDb().from("insights").insert({
      experiment_version: experimentVersion,
      evidence,
      model,
      status: view.status,
      suggestion: view.suggestion,
      detail: view.detail,
    });
    check(error);
  },

  async latest(version): Promise<InsightView | null> {
    const { data, error } = await serviceDb()
      .from("insights")
      .select("status, suggestion, detail, created_at")
      .eq("experiment_version", version)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    check(error);
    return data
      ? { status: data.status, suggestion: data.suggestion, detail: data.detail, createdAt: data.created_at }
      : null;
  },
};

export const experimentRepository: ExperimentRepository = {
  async findFingerprint(version) {
    const { data, error } = await serviceDb()
      .from("experiments")
      .select("config_hash")
      .eq("version", version)
      .maybeSingle();
    check(error);
    return data?.config_hash ?? null;
  },

  async register(config, fingerprint) {
    const { error } = await serviceDb()
      .from("experiments")
      .insert({ version: config.version, config, config_hash: fingerprint });
    // Another instance may have registered it concurrently; the next
    // findFingerprint call still verifies the content.
    if (!isUniqueViolation(error)) check(error);
  },
};
