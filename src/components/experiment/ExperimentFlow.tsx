"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductView, Screen, Side } from "@/lib/experiment/types";
import { ProductCard } from "./ProductCard";

type Step =
  | { kind: "consent" }
  | { kind: "baseline" }
  | { kind: "stated" }
  | { kind: "choice"; index: number }
  | { kind: "done"; reward: { productName: string; code: string } | null }
  | { kind: "already" };

interface Session {
  participantId: string;
  sayFirst: boolean;
  totalChoices: number;
  baseline: Screen;
  screens: Screen[];
  preferred: ProductView | null;
  alternative: ProductView | null;
}

const STORAGE_KEY = "switchpoint:done";

function readDone(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markDone() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage may be unavailable; the server still prevents duplicates.
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}

export function ExperimentFlow({ fulfilmentEnabled }: { fulfilmentEnabled: boolean }) {
  const [step, setStep] = useState<Step>({ kind: "consent" });
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (readDone()) setStep({ kind: "already" });
  }, []);

  // Move focus to the new heading on each step change for screen-reader users.
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    headingRef.current?.focus();
  }, [step]);

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

  const consent = () =>
    run(async () => {
      const r = await post<{
        participantId: string;
        sayFirst: boolean;
        totalChoices: number;
        baseline: Screen;
      }>("/api/participants", {});
      setSession({ ...r, screens: [], preferred: null, alternative: null });
      setStep({ kind: "baseline" });
    });

  const chooseBaseline = (side: Side) =>
    run(async () => {
      const s = session!;
      const r = await post<{ screens: Screen[] }>("/api/choices", {
        participantId: s.participantId,
        scenarioId: s.baseline.scenarioId,
        side,
      });
      const other: Side = side === "left" ? "right" : "left";
      setSession({ ...s, screens: r.screens, preferred: s.baseline[side], alternative: s.baseline[other] });
      setStep(s.sayFirst ? { kind: "stated" } : { kind: "choice", index: 0 });
    });

  const complete = async () => {
    const r = await post<{ reward: { productName: string; code: string } | null }>("/api/complete", {
      participantId: session!.participantId,
    });
    markDone();
    setStep({ kind: "done", reward: r.reward });
  };

  const chooseScenario = (index: number, side: Side) =>
    run(async () => {
      const s = session!;
      await post("/api/choices", {
        participantId: s.participantId,
        scenarioId: s.screens[index].scenarioId,
        side,
      });
      if (index + 1 < s.screens.length) setStep({ kind: "choice", index: index + 1 });
      else if (s.sayFirst) await complete();
      else setStep({ kind: "stated" });
    });

  const submitStated = (reasonText: string, statedPriceThreshold: number | null) =>
    run(async () => {
      const s = session!;
      await post("/api/stated", { participantId: s.participantId, reasonText, statedPriceThreshold });
      if (s.sayFirst) setStep({ kind: "choice", index: 0 });
      else await complete();
    });

  const answered =
    step.kind === "baseline"
      ? 0
      : step.kind === "choice"
        ? step.index + 1
        : step.kind === "stated"
          ? session?.sayFirst
            ? 1
            : session!.totalChoices
          : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-ink-3">SwitchPoint</p>
        {session && answered !== null && (
          <div className="flex items-center gap-3" aria-label={`${answered} of ${session.totalChoices} choices made`}>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${(answered / session.totalChoices) * 100}%` }}
              />
            </div>
            <span className="tabular text-xs text-ink-3">
              {answered}/{session.totalChoices}
            </span>
          </div>
        )}
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-warn-line bg-warn-bg p-3 text-sm">
          <span>{error.message}. Your earlier answers are saved.</span>
          <button type="button" onClick={error.retry} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      {step.kind === "consent" && (
        <section className="flex flex-col gap-5">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
            Before you start
          </h1>
          <div className="flex flex-col gap-3 text-ink-2">
            <p>
              You will choose between two packs of ground coffee about eight times, and tell us in a
              sentence what would make you switch. It takes about three minutes.
            </p>
            <p>
              These are real product choices, so choose as you would in a shop.
              {fulfilmentEnabled &&
                " At the end, one of your choices will be drawn at random and you will receive the product you picked in that round."}
            </p>
            <p>
              We do not ask for your name, email or any other personal details. You get a random
              anonymous ID. Your answers are used to study shopping decisions and may be shared in
              anonymised form. You can stop at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={consent}
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-60"
          >
            {busy ? "Starting…" : "I agree, start"}
          </button>
        </section>
      )}

      {step.kind === "baseline" && session && (
        <ChoiceStep
          headingRef={headingRef}
          title="Which would you buy?"
          hint="Both are the same price. Pick the one you would normally choose."
          screen={session.baseline}
          busy={busy}
          onChoose={chooseBaseline}
        />
      )}

      {step.kind === "choice" && session && (
        <ChoiceStep
          headingRef={headingRef}
          title="Which would you buy now?"
          hint="Look at the details, then pick one."
          screen={session.screens[step.index]}
          busy={busy}
          onChoose={(side) => chooseScenario(step.index, side)}
        />
      )}

      {step.kind === "stated" && session?.preferred && session.alternative && (
        <StatedStep
          headingRef={headingRef}
          preferred={session.preferred.name}
          alternative={session.alternative.name}
          busy={busy}
          onSubmit={submitStated}
        />
      )}

      {step.kind === "done" && (
        <section className="flex flex-col gap-4">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
            Thank you
          </h1>
          <p className="text-ink-2">Your answers have been recorded.</p>
          {step.reward && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-sm text-ink-2">The round drawn for you gives you</p>
              <p className="mt-1 text-xl font-semibold">{step.reward.productName}</p>
              <p className="mt-3 text-sm text-ink-2">
                Show this code to collect it: <span className="tabular font-semibold text-ink">{step.reward.code}</span>
              </p>
            </div>
          )}
        </section>
      )}

      {step.kind === "already" && (
        <section className="flex flex-col gap-3">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
            You have already taken part
          </h1>
          <p className="text-ink-2">Thanks. Each person can take part once.</p>
        </section>
      )}
    </main>
  );
}

function ChoiceStep({
  headingRef,
  title,
  hint,
  screen,
  busy,
  onChoose,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  hint: string;
  screen: Screen;
  busy: boolean;
  onChoose: (side: Side) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {title}
        </h1>
        <p className="mt-1 text-ink-2">{hint}</p>
      </div>
      <div key={screen.scenarioId} className="flex gap-3">
        <ProductCard product={screen.left} disabled={busy} onChoose={() => onChoose("left")} />
        <ProductCard product={screen.right} disabled={busy} onChoose={() => onChoose("right")} />
      </div>
    </section>
  );
}

function StatedStep({
  headingRef,
  preferred,
  alternative,
  busy,
  onSubmit,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  preferred: string;
  alternative: string;
  busy: boolean;
  onSubmit: (reason: string, threshold: number | null) => void;
}) {
  const [reason, setReason] = useState("");
  const [price, setPrice] = useState("");
  const [noPrice, setNoPrice] = useState(false);

  const parsed = Number(price);
  const priceValid = noPrice || (price.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100);
  const valid = reason.trim().length > 0 && priceValid;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(reason.trim(), noPrice ? null : Math.round(parsed * 100) / 100);
      }}
    >
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
        In your own words
      </h1>
      <div className="flex flex-col gap-2">
        <label htmlFor="reason" className="font-medium">
          What would make you switch from {preferred} to {alternative}?
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          required
          className="rounded-lg border border-line bg-surface p-3"
        />
        <p className="text-xs text-ink-3">{500 - reason.length} characters left</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="price" className="font-medium">
          How much cheaper would {alternative} need to be for you to switch?
        </label>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-ink-2">£</span>
          <input
            id="price"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.01}
            value={price}
            disabled={noPrice}
            onChange={(e) => setPrice(e.target.value)}
            aria-describedby="price-hint"
            className="tabular w-32 rounded-lg border border-line bg-surface p-3 disabled:opacity-50"
          />
        </div>
        <p id="price-hint" className="text-xs text-ink-3">For example 0.50 for 50p.</p>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={noPrice} onChange={(e) => setNoPrice(e.target.checked)} />
          A lower price would not make me switch
        </label>
      </div>
      <button
        type="submit"
        disabled={!valid || busy}
        className="rounded-lg bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-60"
      >
        {busy ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
