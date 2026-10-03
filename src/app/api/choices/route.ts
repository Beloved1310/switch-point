import { recordChoice } from "@/application/participant/recordChoice";
import { recordChoiceRequest } from "@/contracts/requests";
import { container } from "@/server/container";
import { parseBody, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const POST = route(async (req) => {
  await enforceRateLimit(req, "choices", 60);
  return recordChoice(container(), await parseBody(req, recordChoiceRequest));
});
