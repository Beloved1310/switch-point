import type { Screen, Side } from "@/domain/experiment/types";
import { StepHeading } from "../ui/StepHeading";
import { ProductCard } from "./ProductCard";

export function ChoiceStep({
  headingRef,
  title,
  hint,
  screen,
  busy,
  onChoose,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  title: string;
  hint: string;
  screen: Screen;
  busy: boolean;
  onChoose: (side: Side) => void;
}) {
  return (
    <section className="choice-step">
      <div className="choice-prompt">
        <p className="eyebrow"><span className="eyebrow-line" /> TAKE A MOMENT TO CHOOSE</p>
        <StepHeading ref={headingRef}>{title}</StepHeading>
        <p className="mt-1 text-ink-2">{hint}</p>
      </div>
      <div key={screen.scenarioId} className="product-choice-grid">
        <ProductCard product={screen.left} disabled={busy} onChoose={() => onChoose("left")} />
        <ProductCard product={screen.right} disabled={busy} onChoose={() => onChoose("right")} />
      </div>
      <p className="product-choice-hint">There’s no right answer. Choose what feels right to you.</p>
    </section>
  );
}
