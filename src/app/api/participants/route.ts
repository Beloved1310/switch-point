import { randomInt, randomUUID } from "node:crypto";
import { EXPERIMENT } from "@/lib/experiment/config";
import { baselineScreen, createPlan } from "@/lib/experiment/plan";
import { ensureExperiment } from "@/lib/server/experiment";
import { fail, json } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";
import { publicDb } from "@/lib/server/supabase";

const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Consent given: create an anonymous participant with a server-side plan (FR1, NFR4). */
export async function POST(req: Request) {
  if (rateLimited(req, "participants", 10)) return fail("Too many requests", 429);
  await ensureExperiment();

  const id = randomUUID();
  const plan = createPlan(EXPERIMENT, secureRandom);
  const { error } = await publicDb().from("participants").insert({
    id,
    experiment_version: EXPERIMENT.version,
    say_first: plan.sayFirst,
    plan,
  });
  if (error) return fail("Could not start the experiment", 500);

  return json({
    participantId: id,
    sayFirst: plan.sayFirst,
    totalChoices: plan.order.length + 1,
    baseline: baselineScreen(EXPERIMENT, plan),
  });
}
