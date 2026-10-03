import { Button } from "../ui/Button";
import { StepHeading } from "../ui/StepHeading";

export function ConsentStep({
  headingRef,
  category,
  choiceCount,
  fulfilmentEnabled,
  busy,
  onConsent,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  category: string;
  choiceCount: number;
  fulfilmentEnabled: boolean;
  busy: boolean;
  onConsent: () => void;
}) {
  return (
    <section className="consent-card flex flex-col gap-5">
      <p className="eyebrow"><span className="eyebrow-line" /> BEFORE YOU BEGIN</p>
      <StepHeading ref={headingRef}>Before you start</StepHeading>
      <div className="consent-intro flex flex-col gap-3 text-ink-2">
        <p>
          You will choose between two products ({category.toLowerCase()}) {choiceCount} times, and tell us
          in a sentence what would make you switch. It takes about three minutes.
        </p>
        <p>
          These are real product choices, so choose as you would in a shop.
          {fulfilmentEnabled &&
            " At the end, one of your choices will be drawn at random and you will receive the product you picked in that round."}
        </p>
        <p>
          We do not ask for your name or email. Your answers use a random participant ID. A keyed
          identifier derived from your IP is used separately to limit abuse. Inactive
          rate-limit records are cleared on later requests after an hour; this identifier is not
          attached to your answers. Results may be shared in anonymised form. You can stop at any time.
        </p>
      </div>
      <div className="consent-detail" aria-label="Study details">
        <div><b>About 3 minutes</b>{choiceCount} quick product choices</div>
        <div><b>Private responses</b>No name or email requested</div>
        {fulfilmentEnabled ? (
          <div><b>One real choice</b>You receive the product from one round, drawn at random</div>
        ) : (
          <div><b>Choose as in a shop</b>Pick what you would really buy</div>
        )}
      </div>
      <Button onClick={onConsent} disabled={busy}>
        {busy ? "Starting…" : "I agree, start"}
      </Button>
    </section>
  );
}
