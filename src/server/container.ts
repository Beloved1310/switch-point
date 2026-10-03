import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { after } from "next/server";
import type { Deps, Runtime } from "@/application/ports";
import { createTestDeps } from "@/application/testing/inMemory";
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
  defer: (task) =>
    after(() => task().catch((error) => nodeRuntime.reportError("deferred task", error))),
  reportError: (context, error) => console.error(`[switchpoint] ${context}:`, error),
};

let deps: Deps | null = null;

/**
 * In-memory adapters for end-to-end tests (`SWITCHPOINT_IN_MEMORY=1`), so the
 * browser suite never touches a real database or AI provider. Kept on
 * globalThis because `next dev` can load this module once per route.
 */
function inMemoryDeps(): Deps {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SWITCHPOINT_IN_MEMORY is for local end-to-end tests only");
  }
  const g = globalThis as typeof globalThis & { switchpointInMemoryDeps?: Deps };
  return (g.switchpointInMemoryDeps ??= { ...createTestDeps().deps, runtime: nodeRuntime });
}

/**
 * Composition root: the only place that knows which adapters back each port.
 * Swap an adapter here (e.g. another database or AI provider) without
 * touching use cases or routes.
 */
export function container(): Deps {
  if (process.env.SWITCHPOINT_IN_MEMORY === "1") return inMemoryDeps();
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
