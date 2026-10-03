"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ErrorBanner } from "./ErrorBanner";
import { ChoiceStep } from "./ChoiceStep";
import { ConsentStep } from "./ConsentStep";
import { AlreadyTakenPartStep, DoneStep } from "./FinishedStep";
import { choicesMade } from "./flow";
import { ProgressBar } from "./ProgressBar";
import { StatedStep } from "./StatedStep";
import { useExperimentSession } from "./useExperimentSession";

export interface ExperimentIntro {
  category: string;
  choiceCount: number;
  fulfilmentEnabled: boolean;
}

/** Renders the current step; state and API calls live in useExperimentSession. */
export function ExperimentFlow({ intro }: { intro: ExperimentIntro }) {
  const { step, session, busy, restored, error, consent, chooseBaseline, chooseScenario, submitStated } =
    useExperimentSession();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new heading on each step change for screen-reader users.
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  const made = session ? choicesMade(step, session.sayFirst, session.totalChoices) : null;

  return (
    <main className="experiment-page">
      <div className="experiment-shell">
      <header className="experiment-topbar">
        <Link className="experiment-brand" href="/" aria-label="SwitchPoint home">switchpoint<span>.</span></Link>
        <span className="experiment-top-meta">Shopper choice study · Coffee</span>
      </header>
      {session && made !== null && <ProgressBar done={made} total={session.totalChoices} />}
      {restored && <p role="status" className="mx-auto mb-4 max-w-3xl text-sm text-ink-2">Your saved progress has been restored.</p>}

      {error && <ErrorBanner message={error.message} onRetry={error.retry} />}

      {step.kind === "consent" && (
        <ConsentStep headingRef={headingRef} {...intro} busy={busy} onConsent={consent} />
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

      {step.kind === "done" && <DoneStep headingRef={headingRef} reward={step.reward} />}
      {step.kind === "already" && <AlreadyTakenPartStep headingRef={headingRef} />}
      </div>
    </main>
  );
}
