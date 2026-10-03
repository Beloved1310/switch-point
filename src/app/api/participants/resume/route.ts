import { resumeParticipant } from "@/application/participant/resumeParticipant";
import { participantRequest } from "@/contracts/requests";
import { container } from "@/server/container";
import { enforceRateLimit } from "@/server/rateLimit";
import { parseBody, route } from "@/server/http";

export const POST = route(async (req) => {
  await enforceRateLimit(req, "participant-resume", 20);
  const { participantId } = await parseBody(req, participantRequest);
  return resumeParticipant(container(), participantId);
});
