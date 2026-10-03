import { markFulfilled } from "@/application/retailer/adminActions";
import { participantRequest } from "@/contracts/requests";
import { requireAdmin } from "@/server/auth";
import { container } from "@/server/container";
import { parseBody, route } from "@/server/http";

export const POST = route(async (req) => {
  await requireAdmin();
  return markFulfilled(container(), await parseBody(req, participantRequest));
});
