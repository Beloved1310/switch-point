import { startParticipant } from "@/application/participant/startParticipant";
import { container } from "@/server/container";
import { route } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export const POST = route(async (req) => {
  enforceRateLimit(req, "participants", 10);
  return startParticipant(container());
});
