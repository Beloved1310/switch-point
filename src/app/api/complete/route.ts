import { randomInt } from "node:crypto";
import { z } from "zod";
import { BASELINE_SCENARIO_ID, EXPERIMENT } from "@/lib/experiment/config";
import { notifyDashboards } from "@/lib/server/broadcast";
import { claimCode } from "@/lib/server/dashboard";
import { loadParticipant } from "@/lib/server/experiment";
import { fail, json, parseBody } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";
import { isUniqueViolation, serviceDb } from "@/lib/server/supabase";

const bodySchema = z.object({ participantId: z.uuid() });

/** Mark completion and, if enabled, draw the choice that will be honoured (FR23). */
export async function POST(req: Request) {
  if (rateLimited(req, "complete", 10)) return fail("Too many requests", 429);
  const body = await parseBody(req, bodySchema);
  if (!body) return fail("Invalid request", 400);

  const participant = await loadParticipant(body.participantId);
  if (!participant || participant.experiment_version !== EXPERIMENT.version) {
    return fail("Unknown participant", 404);
  }
  const db = serviceDb();

  const [{ data: choices }, { data: stated }] = await Promise.all([
    db.from("choices").select("id, scenario_id, chosen_product").eq("participant_id", participant.id),
    db.from("stated_reasons").select("participant_id").eq("participant_id", participant.id).maybeSingle(),
  ]);
  const controlled = (choices ?? []).filter((c) => c.scenario_id !== BASELINE_SCENARIO_ID);
  if (controlled.length < participant.plan.order.length || !stated) {
    return fail("Experiment not finished", 409);
  }

  if (!participant.completed_at) {
    await db
      .from("participants")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", participant.id)
      .is("completed_at", null);
  }

  let reward: { productName: string; code: string } | null = null;
  if (EXPERIMENT.fulfilment.enabled) {
    const { data: existing } = await db
      .from("fulfilments")
      .select("product")
      .eq("participant_id", participant.id)
      .maybeSingle();
    let product = existing?.product as string | undefined;
    if (!product) {
      const drawn = controlled[randomInt(0, controlled.length)];
      const { error } = await db.from("fulfilments").insert({
        participant_id: participant.id,
        choice_id: drawn.id,
        product: drawn.chosen_product,
      });
      if (error && !isUniqueViolation(error)) return fail("Could not complete", 500);
      product = drawn.chosen_product;
      if (isUniqueViolation(error)) {
        const { data } = await db.from("fulfilments").select("product").eq("participant_id", participant.id).single();
        product = data?.product ?? product;
      }
    }
    reward = {
      productName: EXPERIMENT.products.find((p) => p.id === product)?.name ?? String(product),
      code: claimCode(participant.id),
    };
  }

  await notifyDashboards("complete");
  return json({ ok: true, reward });
}
