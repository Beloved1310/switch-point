import { after } from "next/server";
import { z } from "zod";
import { classifyReason, GROQ_MODEL } from "@/lib/ai/groq";
import { EXPERIMENT } from "@/lib/experiment/config";
import { notifyDashboards } from "@/lib/server/broadcast";
import { loadParticipant } from "@/lib/server/experiment";
import { fail, json, parseBody } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";
import { isUniqueViolation, publicDb, serviceDb } from "@/lib/server/supabase";

const bodySchema = z.object({
  participantId: z.uuid(),
  reasonText: z.string().trim().min(1).max(500),
  statedPriceThreshold: z.number().min(0).max(100).multipleOf(0.01).nullable(),
});

/** Store the stated reason first, then classify it with AI (FR4, FR5, FR11, NFR8). */
export async function POST(req: Request) {
  if (rateLimited(req, "stated", 10)) return fail("Too many requests", 429);
  const body = await parseBody(req, bodySchema);
  if (!body) return fail("Invalid request", 400);

  const participant = await loadParticipant(body.participantId);
  if (!participant || participant.experiment_version !== EXPERIMENT.version) {
    return fail("Unknown participant", 404);
  }
  if (participant.completed_at) return fail("Experiment already completed", 409);

  const { error } = await publicDb().from("stated_reasons").insert({
    participant_id: participant.id,
    experiment_version: EXPERIMENT.version,
    phase: participant.say_first ? "before" : "after",
    reason_text: body.reasonText,
    stated_price_threshold: body.statedPriceThreshold,
  });
  if (isUniqueViolation(error)) return json({ ok: true });
  if (error) return fail("Could not save your answer", 500);

  // Classification runs after the response is sent; failure never blocks
  // the participant and is recorded as ai_status = 'failed' (NFR8, NFR20).
  after(async () => {
    const db = serviceDb();
    if (!process.env.GROQ_API_KEY) {
      await db.from("stated_reasons").update({ ai_status: "skipped" }).eq("participant_id", participant.id);
    } else {
      try {
        const result = await classifyReason(body.reasonText);
        await db
          .from("stated_reasons")
          .update({
            ai_status: "done",
            ai_category: result.category,
            ai_confidence: result.confidence,
            ai_model: GROQ_MODEL,
          })
          .eq("participant_id", participant.id);
      } catch {
        await db.from("stated_reasons").update({ ai_status: "failed" }).eq("participant_id", participant.id);
      }
    }
    await notifyDashboards("stated");
  });

  return json({ ok: true });
}
