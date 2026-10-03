"use client";

import { useEffect, useState } from "react";
import { ApiError, participantApi } from "@/client/api";
import type { ProductView, Screen, Side } from "@/domain/experiment/types";
import { afterBaseline, afterChoice, afterStated, type Next, type Step } from "./flow";

interface Session {
  participantId: string;
  sayFirst: boolean;
  totalChoices: number;
  baseline: Screen;
  screens: Screen[];
  preferred: ProductView | null;
  alternative: ProductView | null;
}

const DONE_KEY = "switchpoint:done";
const ACTIVE_KEY = "switchpoint:participant";

function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveActiveSession(participantId: string) {
  try {
    sessionStorage.setItem(ACTIVE_KEY, participantId);
  } catch {
    // The experiment still works; resume is unavailable if storage is blocked.
  }
}

function clearActiveSession() {
  try {
    sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Storage may be unavailable.
  }
}

function markDone() {
  try {
    sessionStorage.setItem(DONE_KEY, "1");
    sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // The server still prevents completed participants from submitting more choices.
  }
}

/** State and actions for one participant's run through the experiment. */
export function useExperimentSession() {
  const [step, setStep] = useState<Step>({ kind: "consent" });
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError({ message: (e as Error).message, retry: () => run(action) });
    } finally {
      setBusy(false);
    }
  }

  async function restore(participantId: string) {
    await run(async () => {
      let restored;
      try {
        restored = await participantApi.resume(participantId);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          clearActiveSession();
          setError({
            message: "This saved session is no longer available. Start a new study to continue.",
            retry: () => setError(null),
          });
          return;
        }
        throw e;
      }

      const preferred = restored.baselineProduct
        ? [restored.baseline.left, restored.baseline.right].find((p) => p.productId === restored.baselineProduct) ?? null
        : null;
      const alternative = preferred
        ? [restored.baseline.left, restored.baseline.right].find((p) => p.productId !== restored.baselineProduct) ?? null
        : null;
      const restoredSession: Session = {
        participantId: restored.participantId,
        sayFirst: restored.sayFirst,
        totalChoices: restored.totalChoices,
        baseline: restored.baseline,
        screens: restored.screens,
        preferred,
        alternative,
      };
      setSession(restoredSession);
      setRestored(true);

      if (restored.completed) {
        markDone();
        setStep({ kind: "done", reward: restored.reward });
        return;
      }
      if (!restored.baselineProduct) {
        setStep({ kind: "baseline" });
        return;
      }
      if (restored.sayFirst && !restored.hasStated) {
        setStep({ kind: "stated" });
        return;
      }

      const answered = new Set(restored.completedScenarioIds);
      const nextIndex = restored.screens.findIndex((screen) => !answered.has(screen.scenarioId));
      if (nextIndex !== -1) {
        setStep({ kind: "choice", index: nextIndex });
      } else if (!restored.hasStated) {
        setStep({ kind: "stated" });
      } else {
        const result = await participantApi.complete(restored.participantId);
        markDone();
        setStep({ kind: "done", reward: result.reward });
      }
    });
  }

  useEffect(() => {
    if (readSessionValue(DONE_KEY) === "1") {
      setStep({ kind: "already" });
      return;
    }
    const participantId = readSessionValue(ACTIVE_KEY);
    if (participantId) void restore(participantId);
    // Restore once on mount; subsequent progress updates are handled by the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function go(next: Next, s: Session) {
    if (next.kind !== "complete") return setStep(next);
    const { reward } = await participantApi.complete(s.participantId);
    markDone();
    setStep({ kind: "done", reward });
  }

  const consent = () =>
    run(async () => {
      const r = await participantApi.start();
      saveActiveSession(r.participantId);
      setSession({ ...r, screens: [], preferred: null, alternative: null });
      setStep({ kind: "baseline" });
    });

  const chooseBaseline = (side: Side) =>
    run(async () => {
      const s = session!;
      const r = await participantApi.choose(s.participantId, s.baseline.scenarioId, side);
      const other: Side = side === "left" ? "right" : "left";
      setSession({
        ...s,
        screens: r.screens ?? [],
        preferred: s.baseline[side],
        alternative: s.baseline[other],
      });
      setStep(afterBaseline(s.sayFirst));
    });

  const chooseScenario = (index: number, side: Side) =>
    run(async () => {
      const s = session!;
      await participantApi.choose(s.participantId, s.screens[index].scenarioId, side);
      await go(afterChoice(index, s.screens.length, s.sayFirst), s);
    });

  const submitStated = (reasonText: string, statedPriceThreshold: number | null) =>
    run(async () => {
      const s = session!;
      await participantApi.state(s.participantId, reasonText, statedPriceThreshold);
      await go(afterStated(s.sayFirst), s);
    });

  return { step, session, busy, restored, error, consent, chooseBaseline, chooseScenario, submitStated };
}
