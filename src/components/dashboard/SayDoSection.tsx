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
      intro="What participants said would make them switch, compared with what they did. Stated categories use the AI label unless an admin has overridden it."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Stated driver vs observed switching" n={a.sayDo.leverRows[0]?.n ?? 0} className="lg:col-span-2">
          <PairedBarChart
            title="For each lever, share of participants who switched on it versus share who named it as their reason"
            aLabel="Switched when the lever was applied"
            bLabel="Named it as their reason"
            rows={a.sayDo.leverRows.map((r) => ({
              key: r.lever,
              label: r.lever,
              a: r.observedSwitchRate,
              b: r.statedShare,
              tooltip: `${r.lever}: ${pct(r.observedSwitchRate)} switched (n=${r.n}); ${pct(r.statedShare)} named it as their reason`,
            }))}
          />
        </Card>
        <div className="flex flex-col gap-4">
          <Stat
            label="Median stated price threshold"
            value={gbp(a.stated.medianThreshold)}
            note={interval(a.stated.medianThresholdInterval, gbp)}
          />
          <Stat
            label="Average gap, observed minus stated"
            value={signedGbp(a.sayDo.meanPriceGap)}
            note={`Positive means they needed more than they said. ${interval(a.sayDo.meanPriceGapInterval, (v) => `£${v.toFixed(2)}`)}`}
          />
          <Stat
            label="Acted on their stated lever"
            value={pct(a.sayDo.actedOnStatedLeverRate)}
            note={`${a.sayDo.actedOnStatedLeverN} participants who named price, promotion or trust`}
          />
        </div>
      </div>

      <Card title="Stated price threshold vs behaviour" n={a.sayDo.n}>
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
