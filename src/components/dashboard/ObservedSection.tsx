import type { DashboardData } from "@/contracts/responses";
import { HBarChart } from "../charts/BarCharts";
import { Card, MeasuredSection, Stat } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { gbp, interval, pct } from "./format";

/** What participants actually chose (FR13–FR15, FR17). */
export function ObservedSection({ data }: { data: DashboardData }) {
  const a = data.analysis;
  const byRate = [...a.conditions].sort((x, y) => (y.rate ?? -1) - (x.rate ?? -1));
  const left = a.leftChoiceRate;
  const countMax = Math.max(1, ...a.switchPoints.distribution.map((d) => d.count));
  // Whole-number ticks only: every step for small counts, otherwise ends and middle.
  const countTicks =
    countMax <= 5 ? Array.from({ length: countMax + 1 }, (_, i) => i) : [0, Math.round(countMax / 2), countMax];

  return (
    <MeasuredSection
      title="What shoppers did"
      intro="Each shopper first picked a favourite. Then we changed only the other coffee. A switch means they left their favourite for it."
    >
      <Card title="Which offers made people switch" n={a.participants}>
        <p className="-mt-2 text-sm text-ink-2">Best performing offers are at the top. Longer bars mean more people switched.</p>
        <HBarChart
          title="Share of shoppers who switched under each offer"
          format={(v) => `${Math.round(v * 100)}%`}
          rows={byRate.map((c) => ({
            key: c.scenarioId,
            label: c.label,
            value: c.rate,
            interval: c.interval,
            n: c.n,
            tooltip: `${c.label}: ${c.switches} of ${c.n} switched (${pct(c.rate)})`,
          }))}
        />
        <details className="rounded-lg border border-line bg-bg p-3 text-sm">
          <summary className="cursor-pointer font-medium">See the numbers</summary>
          <p className="mb-2 mt-2 text-ink-2">
            The thin line on each bar is the 95% range: where the true rate probably sits. Wide ranges mean more
            responses are needed.
          </p>
          <DataTable
            caption="Switch rate by offer"
            head={["Offer", "Switched", "Shoppers", "Rate", "95% range"]}
            rows={byRate.map((c) => [
              c.label,
              String(c.switches),
              String(c.n),
              pct(c.rate),
              c.interval ? `${pct(c.interval[0])} to ${pct(c.interval[1])}` : "–",
            ])}
          />
        </details>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Favourite before any offer" n={a.baseline.n}>
          <p className="-mt-2 text-sm text-ink-2">Both coffees were shown at the same price, with nothing extra.</p>
          <div className="flex flex-col gap-3">
            {data.experiment.products.map((p) => {
              const count = a.baseline.shares[p.id];
              return (
                <div key={p.id} className="flex items-baseline justify-between">
                  <span className="text-ink-2">{p.name}</span>
                  <span className="tabular text-xl font-semibold">
                    {a.participants ? pct(count / a.participants) : "–"}
                    <span className="ml-2 text-sm font-normal text-ink-3">
                      {count} {count === 1 ? "person" : "people"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Stat
          label="Screen position check"
          value={left.rate === null ? "–" : `${pct(left.rate)} chose the left side`}
          note={`From ${left.n} choices. Close to 50% is good: it means the side of the screen did not drive choices.`}
        />
      </div>

      <Card title="How big a discount it takes" n={a.switchPoints.n}>
        <p className="-mt-2 text-sm text-ink-2">The smallest discount at which each shopper switched away from their favourite.</p>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <HBarChart
            title="Number of shoppers by the smallest discount that made them switch"
            max={countMax}
            ticks={countTicks}
            format={(v) => String(Math.round(v))}
            rows={a.switchPoints.distribution.map((d) => ({
              key: String(d.discount),
              label: d.discount === null ? "Never switched on price" : `Switched at ${gbp(d.discount)} off`,
              value: d.count,
              n: a.switchPoints.n,
              tooltip:
                d.discount === null
                  ? `${d.count} shoppers did not switch at any tested discount`
                  : `${d.count} shoppers first switched at ${gbp(d.discount)} off`,
            }))}
          />
          <Stat
            label="Typical discount needed"
            value={gbp(a.switchPoints.median)}
            note={`The middle value among shoppers who switched on price.${a.switchPoints.medianInterval ? ` ${interval(a.switchPoints.medianInterval, gbp)}.` : ""}`}
          />
        </div>
        <details className="rounded-lg border border-line bg-bg p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            See each shopper&apos;s price answers
            {a.switchPoints.nonMonotonicCount > 0 && (
              <span className="ml-2 font-normal text-ink-2">
                ({a.switchPoints.nonMonotonicCount} mixed)
              </span>
            )}
          </summary>
          <p className="mb-3 mt-2 text-ink-2">
            Answers run from the smallest to the biggest discount. &quot;Mixed&quot; means someone switched at a small
            discount but stayed with their favourite at a bigger one. We keep these answers exactly as given.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-155 text-left">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th className="p-2 font-medium">Shopper</th>
                  <th className="p-2 font-medium">Pattern</th>
                  <th className="p-2 font-medium">Answers, smallest discount first</th>
                  <th className="p-2 font-medium">First switch</th>
                </tr>
              </thead>
              <tbody>
                {a.byParticipant.filter((p) => p.priceResponses.length > 0).map((p) => (
                  <tr key={p.participantId} className="border-b border-line last:border-0">
                    <td className="p-2 font-mono text-xs" title={p.participantId}>{p.participantId.slice(0, 8)}</td>
                    <td className="p-2">{p.pricePattern === "non_monotonic" ? "Mixed" : p.pricePattern === "incomplete" ? "Not finished" : "Consistent"}</td>
                    <td className="p-2">
                      {p.priceResponses.map((r) => `${gbp(r.discount)}: ${r.switched ? "switched" : "stayed"}`).join(" · ")}
                    </td>
                    <td className="tabular p-2">{gbp(p.observedSwitchPoint)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
    </MeasuredSection>
  );
}
