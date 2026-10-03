import { overrideReasonCategory } from "@/application/retailer/adminActions";
import { overrideCategoryRequest } from "@/contracts/requests";
import { requireAdmin } from "@/server/auth";
import { container } from "@/server/container";
import { parseBody, route } from "@/server/http";

export const POST = route(async (req) => {
  await requireAdmin();
  return overrideReasonCategory(container(), await parseBody(req, overrideCategoryRequest));
});
