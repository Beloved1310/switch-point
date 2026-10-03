import { z } from "zod";
import { BASELINE_SCENARIO_ID, EXPERIMENT } from "@/lib/experiment/config";
import {
  baselineScreen,
  findScenario,
  productOnSide,
  scenarioScreen,
  screensForPlan,
} from "@/lib/experiment/plan";
import type { ProductId, Screen } from "@/lib/experiment/types";
import { notifyDashboards } from "@/lib/server/broadcast";
import { loadParticipant } from "@/lib/server/experiment";
import { fail, json, parseBody } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";
import { isUniqueViolation, publicDb, serviceDb } from "@/lib/server/supabase";
import { after } from "next/server";

const bodySchema = z.object({
  participantId: z.uuid(),
  scenarioId: z.string().min(1).max(40),
  side: z.enum(["left", "right"]),
});

/**
 * Record one choice. The client sends only the side it picked; products,
 * prices and positions come from the server's plan (NFR4, NFR7, FR10).
 */
export async function POST(req: Request) {
  if (rateLimited(req, "choices", 60)) return fail("Too many requests", 429);
  const body = await parseBody(req, bodySchema);
  if (!body) return fail("Invalid request", 400);

  const participant = await loadParticipant(body.participantId);
  if (!participant || participant.experiment_version !== EXPERIMENT.version) {
    return fail("Unknown participant", 404);
  }
  if (participant.completed_at) return fail("Experiment already completed", 409);
  const plan = participant.plan;
  const isBaseline = body.scenarioId === BASELINE_SCENARIO_ID;

  let screen: Screen;
  let baselineProduct: ProductId | null = null;
  if (isBaseline) {
    screen = baselineScreen(EXPERIMENT, plan);
  } else {
    if (!plan.order.some((o) => o.scenarioId === body.scenarioId)) {
      return fail("Scenario not in plan", 400);
    }
    const { data, error } = await serviceDb()
      .from("choices")
      .select("chosen_product")
      .eq("participant_id", participant.id)
      .eq("scenario_id", BASELINE_SCENARIO_ID)
      .maybeSingle();
    if (error) return fail("Could not record choice", 500);
    if (!data) return fail("Baseline choice required first", 409);
    baselineProduct = data.chosen_product as ProductId;
    screen = scenarioScreen(EXPERIMENT, plan, body.scenarioId, baselineProduct);
  }

  const chosenProduct = productOnSide(screen, body.side);
  const scenario = findScenario(EXPERIMENT, body.scenarioId);
  const { error } = await publicDb().from("choices").insert({
    participant_id: participant.id,
    experiment_version: EXPERIMENT.version,
    scenario_id: body.scenarioId,
    levers: scenario?.levers ?? [],
    condition: scenario?.condition ?? null,
    left_product: screen.left.productId,
    right_product: screen.right.productId,
    left_view: screen.left,
    right_view: screen.right,
    chosen_side: body.side,
    chosen_product: chosenProduct,
    baseline_product: baselineProduct,
    switched: baselineProduct === null ? null : chosenProduct !== baselineProduct,
  });
  // A repeated submission is treated as success so retries are safe (NFR12).
  if (error && !isUniqueViolation(error)) return fail("Could not record choice", 500);
  if (!error) after(() => notifyDashboards("choice"));

  if (!isBaseline) return json({ ok: true });

  // The baseline answer decides which product is the alternative, so the
  // controlled screens can only be built now.
  const { data: stored } = await serviceDb()
    .from("choices")
    .select("chosen_product")
    .eq("participant_id", participant.id)
    .eq("scenario_id", BASELINE_SCENARIO_ID)
    .single();
  const baseline = (stored?.chosen_product ?? chosenProduct) as ProductId;
  return json({ ok: true, screens: screensForPlan(EXPERIMENT, plan, baseline) });
}
