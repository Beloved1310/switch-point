import { isAdmin } from "@/lib/server/auth";
import { loadDashboardData } from "@/lib/server/dashboard";
import { fail, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return fail("Unauthorised", 401);
  return json(await loadDashboardData());
}
