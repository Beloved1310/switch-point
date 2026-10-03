import type { Reward } from "@/contracts/responses";
import { StepHeading } from "../ui/StepHeading";

export function DoneStep({ headingRef, reward }: { headingRef: React.Ref<HTMLHeadingElement>; reward: Reward | null }) {
  return (
    <section className="experiment-complete flex flex-col gap-4">
      <span className="complete-icon" aria-hidden="true">✓</span>
      <StepHeading ref={headingRef}>Thank you</StepHeading>
      <p className="text-ink-2">Your answers have been recorded.</p>
      {reward && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-2">The round drawn for you gives you</p>
          <p className="mt-1 text-xl font-semibold">{reward.productName}</p>
          <p className="mt-3 text-sm text-ink-2">
            Show this code to collect it: <span className="tabular font-semibold text-ink">{reward.code}</span>
          </p>
        </div>
      )}
    </section>
  );
}

export function AlreadyTakenPartStep({ headingRef }: { headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <section className="experiment-complete flex flex-col gap-3">
      <span className="complete-icon" aria-hidden="true">✓</span>
      <StepHeading ref={headingRef}>You have already taken part</StepHeading>
      <p className="text-ink-2">Thanks. Each person can take part once.</p>
    </section>
  );
}
