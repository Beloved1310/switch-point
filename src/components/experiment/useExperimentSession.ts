"use client";

import { useEffect, useState } from "react";
import { participantApi } from "@/client/api";
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

function readDone(): boolean {
  try {
    return sessionStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markDone() {
  try {
    sessionStorage.setItem(DONE_KEY, "1");
  } catch {
    // Storage may be unavailable; the server still prevents duplicates.
  }
}

/** State and actions for one participant's run through the experiment. */
export function useExperimentSession() {
  const [step, setStep] = useState<Step>({ kind: "consent" });
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);

  useEffect(() => {
    if (readDone()) setStep({ kind: "already" });
  }, []);

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

  async function go(next: Next, s: Session) {
    if (next.kind !== "complete") return setStep(next);
    const { reward } = await participantApi.complete(s.participantId);
    markDone();
    setStep({ kind: "done", reward });
  }

  const consent = () =>
    run(async () => {
      const r = await participantApi.start();
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

  return { step, session, busy, error, consent, chooseBaseline, chooseScenario, submitStated };
}
