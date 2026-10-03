import type { DashboardData } from "@/contracts/responses";
import { PairedBarChart } from "../charts/BarCharts";
import { Card, MeasuredSection, Stat } from "../ui/Card";
import { gbp, interval, pct, PRICE_GAP_LABELS, signedGbp } from "./format";

/** Stated reasons and thresholds compared with behaviour (FR16). */
export function SayDoSection({ data }: { data: DashboardData }) {
  const a = data.analysis;
  return (
    <MeasuredSection
      title="Say vs do"
      intro="What shoppers told us would make them switch, compared with what actually did."
    >
      <Card title="Reasons given vs what actually worked" n={a.sayDo.leverRows[0]?.n ?? 0}>
        <p className="-mt-2 text-sm text-ink-2">
          When the two bars for a reason are far apart, shoppers are not doing what they say.
        </p>
        <PairedBarChart
          title="For each reason, share who switched for it versus share who named it"
          aLabel="Actually switched for it"
          bLabel="Said it was their reason"
          rows={a.sayDo.leverRows.map((r) => ({
            key: r.lever,
            label: r.lever,
            a: r.observedSwitchRate,
            b: r.statedShare,
            tooltip: `${r.lever}: ${pct(r.observedSwitchRate)} switched for it; ${pct(r.statedShare)} said it was their reason`,
          }))}
        />
        <p className="text-xs text-ink-3">Reasons are sorted by AI unless you have changed them on the Reasons tab.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Discount they said they need"
          value={gbp(a.stated.medianThreshold)}
          note={`Typical answer.${a.stated.medianThresholdInterval ? ` ${interval(a.stated.medianThresholdInterval, gbp)}.` : ""}`}
        />
        <Stat
          label="Gap between doing and saying"
          value={signedGbp(a.sayDo.meanPriceGap)}
          note="Average of actual minus stated discount. Below zero means they switched for less than they said."
        />
        <Stat
          label="Switched for the reason they gave"
          value={pct(a.sayDo.actedOnStatedLeverRate)}
          note={`From ${a.sayDo.actedOnStatedLeverN} ${a.sayDo.actedOnStatedLeverN === 1 ? "shopper" : "shoppers"} who named price, a promotion or trust.`}
        />
      </div>

      <Card title="Did shoppers switch where they said they would?" n={a.sayDo.n}>
        <ul className="flex flex-col gap-2">
          {a.sayDo.priceGaps.map((g) => (
            <li key={g.gap} className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0">
              <span className="text-ink-2">{PRICE_GAP_LABELS[g.gap]}</span>
              <span className="tabular font-semibold">
                {g.count}
                <span className="ml-2 font-normal text-ink-3">{a.sayDo.n ? pct(g.count / a.sayDo.n) : "–"}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </MeasuredSection>
  );
}
