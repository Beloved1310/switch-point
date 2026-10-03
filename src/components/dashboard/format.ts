import type { PriceGap } from "@/domain/analysis/analyze";

export const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
export const gbp = (v: number | null) => (v === null ? "–" : `£${v.toFixed(2)}`);

export function signedGbp(v: number | null): string {
  if (v === null) return "–";
  const s = Math.abs(v).toFixed(2);
  return s === "0.00" ? "£0.00" : `${v > 0 ? "+" : "−"}£${s}`;
}

export const interval = (i: [number, number] | null, f: (v: number) => string) =>
  i ? `95% interval ${f(i[0])} to ${f(i[1])}` : "no interval yet";

export const PRICE_GAP_LABELS: Record<PriceGap, string> = {
  matched: "Switched at the discount they said",
  switched_sooner: "Switched for less than they said",
  switched_later: "Needed a bigger discount than they said",
  never_switched: "Never switched, even at the discount they named",
  no_price_switch_expected: "Named a discount bigger than we tested, and did not switch",
};
