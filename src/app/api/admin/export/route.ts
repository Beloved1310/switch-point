import { EXPERIMENT } from "@/lib/experiment/config";
import { isAdmin } from "@/lib/server/auth";
import { fail } from "@/lib/server/http";
import { serviceDb } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

const TABLES = {
  choices:
    "participant_id, experiment_version, scenario_id, levers, condition, left_product, right_product, chosen_side, chosen_product, baseline_product, switched, created_at",
  stated:
    "participant_id, experiment_version, phase, reason_text, stated_price_threshold, ai_status, ai_category, ai_confidence, ai_model, override_category, created_at",
} as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formulas in free text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Anonymised CSV export (FR24). Participants are identified only by random IDs. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return fail("Unauthorised", 401);
  const table = new URL(req.url).searchParams.get("table") as keyof typeof TABLES | null;
  if (!table || !(table in TABLES)) return fail("Unknown table", 400);

  const { data, error } = await serviceDb()
    .from(table === "stated" ? "stated_reasons" : "choices")
    .select(TABLES[table])
    .eq("experiment_version", EXPERIMENT.version)
    .order("created_at")
    .limit(50_000);
  if (error) return fail("Export failed", 500);

  const columns = TABLES[table].split(", ");
  const rows = (data as unknown as Record<string, unknown>[]).map((r) =>
    columns.map((c) => csvCell(r[c])).join(","),
  );
  return new Response([columns.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="switchpoint-${EXPERIMENT.version}-${table}.csv"`,
    },
  });
}
