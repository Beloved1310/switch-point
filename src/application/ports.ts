import type { ChoiceRecord } from "@/domain/analysis/analyze";
import type {
  Condition,
  ExperimentConfig,
  Lever,
  ParticipantPlan,
  ProductId,
  ReasonCategory,
  Screen,
  Side,
} from "@/domain/experiment/types";
import type { EvidencePacket } from "@/domain/insight/evidence";
import type { Classification, Suggestion } from "@/domain/insight/types";
import type { InsightView, ReasonView } from "@/contracts/responses";

/**
 * Ports: what the use cases need from the outside world. Infrastructure
 * implements them (Supabase, Groq, Realtime); tests use in-memory fakes.
 */

export type InsertResult = "created" | "duplicate";

export interface ParticipantRecord {
  id: string;
  experimentVersion: string;
  sayFirst: boolean;
  plan: ParticipantPlan;
  completedAt: string | null;
}

export interface ParticipantRepository {
  create(p: { id: string; experimentVersion: string; plan: ParticipantPlan }): Promise<void>;
  findById(id: string): Promise<ParticipantRecord | null>;
  markCompleted(id: string, at: Date): Promise<void>;
  counts(version: string): Promise<{ started: number; completed: number }>;
}

export interface NewChoice {
  participantId: string;
  experimentVersion: string;
  scenarioId: string;
  levers: Lever[];
  condition: Condition | null;
  screen: Screen;
  chosenSide: Side;
  chosenProduct: ProductId;
  baselineProduct: ProductId | null;
  switched: boolean | null;
}

export interface StoredChoice {
  id: number;
  scenarioId: string;
  chosenProduct: ProductId;
}

export type ExportRow = Record<string, unknown>;

export interface ChoiceRepository {
  insert(choice: NewChoice): Promise<InsertResult>;
  findBaselineProduct(participantId: string): Promise<ProductId | null>;
  listForParticipant(participantId: string): Promise<StoredChoice[]>;
  listRecords(version: string): Promise<ChoiceRecord[]>;
  exportRows(version: string, columns: readonly string[]): Promise<ExportRow[]>;
}

export type ClassificationOutcome =
  | { status: "done"; classification: Classification; model: string }
  | { status: "failed" | "skipped" };

export interface StatedReasonRepository {
  insert(r: {
    participantId: string;
    experimentVersion: string;
    phase: "before" | "after";
    reasonText: string;
    statedPriceThreshold: number | null;
  }): Promise<InsertResult>;
  exists(participantId: string): Promise<boolean>;
  saveClassification(participantId: string, outcome: ClassificationOutcome): Promise<void>;
  /**
   * Reasons that need classifying again: `failed`, `skipped`, or `pending`
   * since before `stalledBefore` (the deferred task never finished).
   */
  listUnclassified(
    version: string,
    stalledBefore: Date,
    limit: number,
  ): Promise<{ participantId: string; reasonText: string }[]>;
  setOverride(participantId: string, category: ReasonCategory | null, at: Date): Promise<void>;
  list(version: string): Promise<ReasonView[]>;
  exportRows(version: string, columns: readonly string[]): Promise<ExportRow[]>;
}

export interface FulfilmentRecord {
  participantId: string;
  product: ProductId;
  status: "pending" | "fulfilled";
}

export interface FulfilmentRepository {
  findProduct(participantId: string): Promise<ProductId | null>;
  insert(f: { participantId: string; choiceId: number; product: ProductId }): Promise<InsertResult>;
  markFulfilled(participantId: string, at: Date): Promise<void>;
  list(version: string): Promise<FulfilmentRecord[]>;
}

export interface InsightRepository {
  save(i: {
    experimentVersion: string;
    evidence: EvidencePacket;
    model: string;
    view: Omit<InsightView, "createdAt">;
  }): Promise<void>;
  latest(version: string): Promise<InsightView | null>;
}

export interface ExperimentRepository {
  findFingerprint(version: string): Promise<string | null>;
  register(config: ExperimentConfig, fingerprint: string): Promise<void>;
}

export interface ReasonClassifier {
  readonly model: string;
  isConfigured(): boolean;
  classify(reasonText: string): Promise<Classification>;
}

export interface ExperimentAdvisor {
  readonly model: string;
  isConfigured(): boolean;
  /** Must return a shape-validated suggestion or throw (NFR14). */
  suggest(evidence: EvidencePacket): Promise<Suggestion>;
}

export interface ResultsNotifier {
  resultsChanged(kind: string): Promise<void>;
}

export interface Runtime {
  /** Uniform in [0, 1). */
  randomUnit(): number;
  /** Integer in [0, n). */
  randomInt(n: number): number;
  newId(): string;
  now(): Date;
  fingerprint(text: string): string;
  /** Run work after the response is sent; it must not affect the response. */
  defer(task: () => Promise<void>): void;
  /** Record a failure that was handled (not rethrown), so its cause is not lost. */
  reportError(context: string, error: unknown): void;
}

export interface Deps {
  participants: ParticipantRepository;
  choices: ChoiceRepository;
  statedReasons: StatedReasonRepository;
  fulfilments: FulfilmentRepository;
  insights: InsightRepository;
  experiments: ExperimentRepository;
  classifier: ReasonClassifier;
  advisor: ExperimentAdvisor;
  notifier: ResultsNotifier;
  runtime: Runtime;
}
