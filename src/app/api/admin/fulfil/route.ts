import { z } from "zod";
import { isAdmin } from "@/lib/server/auth";
import { fail, json, parseBody } from "@/lib/server/http";
import { serviceDb } from "@/lib/server/supabase";

const bodySchema = z.object({ participantId: z.uuid() });

/** Record that the drawn product was handed over (FR23). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Unauthorised", 401);
  const body = await parseBody(req, bodySchema);
  if (!body) return fail("Invalid request", 400);
  const { error } = await serviceDb()
    .from("fulfilments")
    .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
    .eq("participant_id", body.participantId);
  if (error) return fail("Could not update", 500);
  return json({ ok: true });
}
