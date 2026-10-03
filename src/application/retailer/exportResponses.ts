import type { ExportTable } from "@/contracts/requests";
import { resolveExperiment } from "../experiments";
import type { Deps, ExportRow } from "../ports";

/** Columns in each export. Participants appear only as random IDs (FR24, NFR1). */
export const EXPORT_COLUMNS = {
  choices: [
    "participant_id",
    "experiment_version",
    "scenario_id",
    "levers",
    "condition",
    "left_product",
    "right_product",
    "chosen_side",
    "chosen_product",
    "baseline_product",
    "switched",
    "created_at",
  ],
  stated: [
    "participant_id",
    "experiment_version",
    "phase",
    "reason_text",
    "stated_price_threshold",
    "ai_status",
    "ai_category",
    "ai_confidence",
    "ai_model",
    "override_category",
    "created_at",
  ],
} as const satisfies Record<ExportTable, readonly string[]>;

export interface ExportResult {
  filename: string;
  columns: readonly string[];
  rows: ExportRow[];
}

export async function exportResponses(
  deps: Deps,
  input: { table: ExportTable; version?: string },
): Promise<ExportResult> {
  const config = resolveExperiment(input.version);
  const columns = EXPORT_COLUMNS[input.table];
  const rows =
    input.table === "choices"
      ? await deps.choices.exportRows(config.version, columns)
      : await deps.statedReasons.exportRows(config.version, columns);
  return { filename: `switchpoint-${config.version}-${input.table}.csv`, columns, rows };
}
