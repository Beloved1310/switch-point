import { buildEvidencePacket } from "@/lib/ai/evidence";
import { GROQ_MODEL, suggestNextExperiment } from "@/lib/ai/groq";
import { EXPERIMENT } from "@/lib/experiment/config";
import { isAdmin } from "@/lib/server/auth";
import { loadDashboardData } from "@/lib/server/dashboard";
import { fail, json } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";
import { serviceDb } from "@/lib/server/supabase";

/** Generate one next-experiment suggestion, on request only (FR20, NFR17). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Unauthorised", 401);
  if (rateLimited(req, "insight", 5)) return fail("Too many requests", 429);
  if (!process.env.GROQ_API_KEY) return fail("AI is not configured", 503);

  const { analysis } = await loadDashboardData();
  if (analysis.participants === 0) return fail("No results yet", 409);
  const evidence = buildEvidencePacket(EXPERIMENT, analysis);

  let row;
  try {
    const result = await suggestNextExperiment(evidence);
    row =
      result.status === "accepted"
        ? { status: "accepted", suggestion: result.suggestion, detail: null }
        : {
            status: "rejected",
            suggestion: null,
            detail: `Suppressed: the AI quoted numbers not in the evidence (${result.ungrounded.join(", ")}).`,
          };
  } catch {
    row = { status: "failed", suggestion: null, detail: "The AI service was unavailable or returned an invalid response." };
  }

  const { error } = await serviceDb()
    .from("insights")
    .insert({ experiment_version: EXPERIMENT.version, evidence, model: GROQ_MODEL, ...row });
  if (error) return fail("Could not save suggestion", 500);
  return json(row);
}
