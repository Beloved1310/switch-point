import { z } from "zod";
import { getDashboard } from "@/application/retailer/getDashboard";
import { versionQuery } from "@/contracts/requests";
import { requireAdmin } from "@/server/auth";
import { container } from "@/server/container";
import { parseQuery, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const dynamic = "force-dynamic";

// Dashboards poll every 15 s and refetch on each broadcast; this leaves room for several open tabs.
export const GET = route(async (req) => {
  await requireAdmin();
  await enforceRateLimit(req, "results", 120);
  const { version } = parseQuery(req, z.object({ version: versionQuery }));
  return getDashboard(container(), version);
});
