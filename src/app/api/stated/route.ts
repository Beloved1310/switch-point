import { submitStatedReason } from "@/application/participant/submitStatedReason";
import { submitStatedRequest } from "@/contracts/requests";
import { container } from "@/server/container";
import { parseBody, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const POST = route(async (req) => {
  enforceRateLimit(req, "stated", 10);
  return submitStatedReason(container(), await parseBody(req, submitStatedRequest));
});
