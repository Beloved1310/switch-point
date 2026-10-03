import { overrideReasonCategory } from "@/application/retailer/adminActions";
import { overrideCategoryRequest } from "@/contracts/requests";
import { requireAdmin } from "@/server/auth";
import { container } from "@/server/container";
import { parseBody, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const POST = route(async (req) => {
  await requireAdmin();
  await enforceRateLimit(req, "override", 60);
  return overrideReasonCategory(container(), await parseBody(req, overrideCategoryRequest));
});
