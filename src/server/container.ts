import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { after } from "next/server";
import type { Deps, Runtime } from "@/application/ports";
import { groqExperimentAdvisor } from "@/infrastructure/groq/experimentAdvisor";
import { groqReasonClassifier } from "@/infrastructure/groq/reasonClassifier";
import { broadcastNotifier } from "@/infrastructure/realtime/broadcastNotifier";
import {
  choiceRepository,
  experimentRepository,
  fulfilmentRepository,
  insightRepository,
  participantRepository,
  statedReasonRepository,
} from "@/infrastructure/supabase/repositories";

const UINT32 = 2 ** 32;

/** Cryptographic randomness so assignment cannot be predicted (NFR4). */
const nodeRuntime: Runtime = {
  randomUnit: () => randomInt(0, UINT32) / UINT32,
  randomInt: (n) => randomInt(0, n),
  newId: () => randomUUID(),
  now: () => new Date(),
  fingerprint: (text) => createHash("sha256").update(text).digest("hex"),
  defer: (task) => after(task),
};

let deps: Deps | null = null;

/**
 * Composition root: the only place that knows which adapters back each port.
 * Swap an adapter here (e.g. another database or AI provider) without
 * touching use cases or routes.
 */
export function container(): Deps {
  return (deps ??= {
    participants: participantRepository,
    choices: choiceRepository,
    statedReasons: statedReasonRepository,
    fulfilments: fulfilmentRepository,
    insights: insightRepository,
    experiments: experimentRepository,
    classifier: groqReasonClassifier,
    advisor: groqExperimentAdvisor,
    notifier: broadcastNotifier,
    runtime: nodeRuntime,
  });
}
