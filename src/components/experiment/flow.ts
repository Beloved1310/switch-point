import type { Reward } from "@/contracts/responses";

/** Participant journey as a pure state machine, independent of React. */

export type Step =
  | { kind: "consent" }
  | { kind: "baseline" }
  | { kind: "stated" }
  | { kind: "choice"; index: number }
  | { kind: "done"; reward: Reward | null }
  | { kind: "already" };

/** Either show another step, or finish the experiment. */
export type Next = Step | { kind: "complete" };

export function afterBaseline(sayFirst: boolean): Step {
  return sayFirst ? { kind: "stated" } : { kind: "choice", index: 0 };
}

export function afterChoice(index: number, scenarioCount: number, sayFirst: boolean): Next {
  if (index + 1 < scenarioCount) return { kind: "choice", index: index + 1 };
  return sayFirst ? { kind: "complete" } : { kind: "stated" };
}

export function afterStated(sayFirst: boolean): Next {
  return sayFirst ? { kind: "choice", index: 0 } : { kind: "complete" };
}

/** Choices made so far, or null when no progress bar should show. */
export function choicesMade(step: Step, sayFirst: boolean, totalChoices: number): number | null {
  switch (step.kind) {
    case "baseline":
      return 0;
    case "choice":
      return step.index + 1;
    case "stated":
      return sayFirst ? 1 : totalChoices;
    default:
      return null;
  }
}
