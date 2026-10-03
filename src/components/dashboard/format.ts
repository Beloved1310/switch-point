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
  matched: "Switched where they said they would",
  switched_sooner: "Switched at a smaller discount than stated",
  switched_later: "Needed a bigger discount than stated",
  never_switched: "Never switched despite a stated threshold in range",
  no_price_switch_expected: "Stated threshold above tested range and did not switch",
};
