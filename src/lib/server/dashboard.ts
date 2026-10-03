import "server-only";
import { analyze, type Analysis, type ChoiceRecord, type StatedRecord } from "../analysis/analyze";
import { EXPERIMENT } from "../experiment/config";
import { REASON_CATEGORIES, type ReasonCategory } from "../experiment/types";
import type { Suggestion } from "../ai/schemas";
import { serviceDb } from "./supabase";

/** Short code a participant shows to collect their product. */
export const claimCode = (participantId: string) => participantId.slice(0, 6).toUpperCase();

const ROW_LIMIT = 10_000;

export interface ReasonRow {
  participantId: string;
  phase: "before" | "after";
  reasonText: string;
  statedPriceThreshold: number | null;
  aiStatus: string;
  aiCategory: ReasonCategory | null;
  aiConfidence: string | null;
  overrideCategory: ReasonCategory | null;
  createdAt: string;
}

export interface InsightRow {
  id: number;
  status: "accepted" | "rejected" | "failed";
  suggestion: Suggestion | null;
  detail: string | null;
  createdAt: string;
}

export interface DashboardData {
  analysis: Analysis;
  reasons: ReasonRow[];
  completed: number;
  started: number;
  fulfilment: {
    enabled: boolean;
    rule: string;
    fulfilled: number;
    pending: { code: string; participantId: string; productName: string }[];
  };
  insight: InsightRow | null;
  generatedAt: string;
}

const asCategory = (v: unknown): ReasonCategory | null =>
  REASON_CATEGORIES.includes(v as ReasonCategory) ? (v as ReasonCategory) : null;

export async function loadDashboardData(): Promise<DashboardData> {
  const db = serviceDb();
  const v = EXPERIMENT.version;
  const [choicesRes, statedRes, startedRes, completedRes, fulfilRes, insightRes] = await Promise.all([
    db
      .from("choices")
      .select("participant_id, scenario_id, chosen_product, chosen_side, baseline_product")
      .eq("experiment_version", v)
      .limit(ROW_LIMIT),
    db
      .from("stated_reasons")
      .select(
        "participant_id, phase, reason_text, stated_price_threshold, ai_status, ai_category, ai_confidence, override_category, created_at",
      )
      .eq("experiment_version", v)
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT),
    db.from("participants").select("id", { count: "exact", head: true }).eq("experiment_version", v),
    db
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("experiment_version", v)
      .not("completed_at", "is", null),
    db
      .from("fulfilments")
      .select("participant_id, product, status, created_at")
      .order("created_at", { ascending: true })
      .limit(ROW_LIMIT),
    db
      .from("insights")
      .select("id, status, suggestion, detail, created_at")
      .eq("experiment_version", v)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const r of [choicesRes, statedRes, startedRes, completedRes, fulfilRes, insightRes]) {
    if (r.error) throw r.error;
  }

  const choices: ChoiceRecord[] = (choicesRes.data ?? []).map((c) => ({
    participantId: c.participant_id,
    scenarioId: c.scenario_id,
    chosenProduct: c.chosen_product,
    chosenSide: c.chosen_side,
    baselineProduct: c.baseline_product,
  }));

  const reasons: ReasonRow[] = (statedRes.data ?? []).map((s) => ({
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

  const stated: StatedRecord[] = reasons.map((r) => ({
    participantId: r.participantId,
    phase: r.phase,
    statedPriceThreshold: r.statedPriceThreshold,
    category: r.overrideCategory ?? r.aiCategory,
  }));

  const fulfil = fulfilRes.data ?? [];
  const insight = insightRes.data;

  return {
    analysis: analyze(EXPERIMENT, choices, stated),
    reasons,
    started: startedRes.count ?? 0,
    completed: completedRes.count ?? 0,
    fulfilment: {
      enabled: EXPERIMENT.fulfilment.enabled,
      rule: EXPERIMENT.fulfilment.rule,
      fulfilled: fulfil.filter((f) => f.status === "fulfilled").length,
      pending: fulfil
        .filter((f) => f.status === "pending")
        .map((f) => ({
          code: claimCode(f.participant_id),
          participantId: f.participant_id,
          productName: EXPERIMENT.products.find((p) => p.id === f.product)?.name ?? f.product,
        })),
    },
    insight: insight
      ? {
          id: insight.id,
          status: insight.status,
          suggestion: insight.suggestion,
          detail: insight.detail,
          createdAt: insight.created_at,
        }
      : null,
    generatedAt: new Date().toISOString(),
  };
}
