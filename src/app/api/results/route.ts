import { z } from "zod";
import { getDashboard } from "@/application/retailer/getDashboard";
import { versionQuery } from "@/contracts/requests";
import { requireAdmin } from "@/server/auth";
import { container } from "@/server/container";
import { parseQuery, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const { version } = parseQuery(req, z.object({ version: versionQuery }));
  return getDashboard(container(), version);
});
