import { z } from "zod";
import { reclassifyReasons } from "@/application/retailer/reclassifyReasons";
import { versionQuery } from "@/contracts/requests";
import { requireAdmin } from "@/server/auth";
import { container } from "@/server/container";
import { parseQuery, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const POST = route(async (req) => {
  await requireAdmin();
  await enforceRateLimit(req, "reclassify", 5);
  const { version } = parseQuery(req, z.object({ version: versionQuery }));
  return reclassifyReasons(container(), version);
});
