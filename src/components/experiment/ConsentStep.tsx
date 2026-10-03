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
    <section className="flex flex-col gap-5">
      <StepHeading ref={headingRef}>Before you start</StepHeading>
      <div className="flex flex-col gap-3 text-ink-2">
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
          We do not ask for your name, email or any other personal details. You get a random anonymous
          ID. Your answers are used to study shopping decisions and may be shared in anonymised form.
          You can stop at any time.
        </p>
      </div>
      <Button onClick={onConsent} disabled={busy}>
        {busy ? "Starting…" : "I agree, start"}
      </Button>
    </section>
  );
}
