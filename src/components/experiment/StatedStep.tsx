"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { StepHeading } from "../ui/StepHeading";

const MAX_REASON = 500;

export function StatedStep({
  headingRef,
  preferred,
  alternative,
  busy,
  onSubmit,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
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
      className="stated-form flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(reason.trim(), noPrice ? null : Math.round(parsed * 100) / 100);
      }}
    >
      <StepHeading ref={headingRef}>In your own words</StepHeading>
      <div className="flex flex-col gap-2">
        <label htmlFor="reason" className="font-medium">
          What would make you switch from {preferred} to {alternative}?
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_REASON}
          rows={3}
          required
          className="rounded-lg border border-line bg-surface p-3"
        />
        <p className="text-xs text-ink-3">{MAX_REASON - reason.length} characters left</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="price" className="font-medium">
          How much cheaper would {alternative} need to be for you to switch?
        </label>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-ink-2">
            £
          </span>
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
        <p id="price-hint" className="text-xs text-ink-3">
          For example 0.50 for 50p.
        </p>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={noPrice} onChange={(e) => setNoPrice(e.target.checked)} />
          A lower price would not make me switch
        </label>
      </div>
      <Button type="submit" disabled={!valid || busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
