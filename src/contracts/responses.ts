import type { Analysis } from "@/domain/analysis/analyze";
import type { ProductId, ReasonCategory, Screen } from "@/domain/experiment/types";
import type { Suggestion } from "@/domain/insight/types";

/** Response shapes returned by the API and consumed by the UI. */

export interface StartParticipantResponse {
  participantId: string;
  sayFirst: boolean;
  totalChoices: number;
  baseline: Screen;
}

export interface RecordChoiceResponse {
  ok: true;
  /** Present after the baseline choice: the controlled screens in plan order. */
  screens?: Screen[];
}

export interface Reward {
  productName: string;
  code: string;
}

export interface CompleteResponse {
  ok: true;
  reward: Reward | null;
}

export interface ReasonView {
  participantId: string;
  phase: "before" | "after";
  reasonText: string;
  statedPriceThreshold: number | null;
  aiStatus: "pending" | "done" | "failed" | "skipped";
  aiCategory: ReasonCategory | null;
  aiConfidence: string | null;
  overrideCategory: ReasonCategory | null;
  createdAt: string;
}

export type InsightStatus = "accepted" | "rejected" | "failed";

export interface InsightView {
  status: InsightStatus;
  suggestion: Suggestion | null;
  detail: string | null;
  createdAt: string;
}

export interface FulfilmentView {
  enabled: boolean;
  rule: string;
  fulfilled: number;
  pending: { code: string; participantId: string; productName: string }[];
}

export interface ExperimentSummary {
  version: string;
  category: string;
  products: { id: ProductId; name: string }[];
}

export interface DashboardData {
  experiment: ExperimentSummary;
  versions: string[];
  analysis: Analysis;
  reasons: ReasonView[];
  started: number;
  completed: number;
  fulfilment: FulfilmentView;
  insight: InsightView | null;
  generatedAt: string;
}

export interface ErrorResponse {
  error: string;
}
