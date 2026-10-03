import { completeParticipant } from "@/application/participant/completeParticipant";
import { participantRequest } from "@/contracts/requests";
import { container } from "@/server/container";
import { parseBody, route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const POST = route(async (req) => {
  await enforceRateLimit(req, "complete", 10);
  return completeParticipant(container(), await parseBody(req, participantRequest));
});
