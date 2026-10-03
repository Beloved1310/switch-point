import { z } from "zod";
import { REASON_CATEGORIES } from "@/lib/experiment/types";
import { isAdmin } from "@/lib/server/auth";
import { notifyDashboards } from "@/lib/server/broadcast";
import { fail, json, parseBody } from "@/lib/server/http";
import { serviceDb } from "@/lib/server/supabase";

const bodySchema = z.object({
  participantId: z.uuid(),
  category: z.enum(REASON_CATEGORIES).nullable(),
});

/** Override the AI category; the original text and AI label are kept (FR12). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Unauthorised", 401);
  const body = await parseBody(req, bodySchema);
  if (!body) return fail("Invalid request", 400);
  const { error } = await serviceDb()
    .from("stated_reasons")
    .update({
      override_category: body.category,
      override_at: body.category ? new Date().toISOString() : null,
    })
    .eq("participant_id", body.participantId);
  if (error) return fail("Could not save override", 500);
  await notifyDashboards("override");
  return json({ ok: true });
}
