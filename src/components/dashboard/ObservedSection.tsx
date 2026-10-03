import type { DashboardData } from "@/contracts/responses";
import { HBarChart } from "../charts/BarCharts";
import { Card, MeasuredSection, Stat } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { gbp, interval, pct } from "./format";

/** What participants actually chose (FR13–FR15, FR17). */
export function ObservedSection({ data }: { data: DashboardData }) {
  const a = data.analysis;
  return (
    <MeasuredSection
      title="Observed behaviour"
      intro="What participants actually chose. Switching means choosing the product they did not pick at baseline."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Baseline preference" n={a.baseline.n}>
          <div className="flex flex-col gap-3">
            {data.experiment.products.map((p) => {
              const count = a.baseline.shares[p.id];
              return (
                <div key={p.id} className="flex items-baseline justify-between">
                  <span className="text-ink-2">{p.name}</span>
                  <span className="tabular text-xl font-semibold">
                    {a.participants ? pct(count / a.participants) : "–"}
                    <span className="ml-2 text-sm font-normal text-ink-3">{count}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Switch rate by condition" n={a.participants} className="lg:col-span-2">
          <HBarChart
            title="Share of participants switching under each condition"
            format={(v) => `${Math.round(v * 100)}%`}
            rows={a.conditions.map((c) => ({
              key: c.scenarioId,
              label: c.label,
              value: c.rate,
              interval: c.interval,
              n: c.n,
              tooltip: `${c.label}: ${c.switches} of ${c.n} switched (${pct(c.rate)}), ${interval(c.interval, pct)}${c.directional ? ". Directional." : ""}`,
            }))}
          />
          <DataTable
            caption="Switch rate by condition"
            head={["Condition", "Switched", "n", "Rate", "95% interval"]}
            rows={a.conditions.map((c) => [
              c.label,
              String(c.switches),
              String(c.n),
              pct(c.rate),
              c.interval ? `${pct(c.interval[0])}–${pct(c.interval[1])}` : "–",
            ])}
          />
        </Card>
      </div>

      <Card title="Estimated price switch points" n={a.switchPoints.n}>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <HBarChart
            title="Lowest tested discount with a recorded switch (estimate)"
            max={Math.max(1, ...a.switchPoints.distribution.map((d) => d.count))}
            format={(v) => String(Math.round(v))}
            rows={a.switchPoints.distribution.map((d) => ({
              key: String(d.discount),
              label: d.discount === null ? "Never switched on price" : `Lowest switch at ${gbp(d.discount)} off`,
              value: d.count,
              n: a.switchPoints.n,
              tooltip:
                d.discount === null
                  ? `${d.count} participants did not switch at any tested discount`
                  : `${d.count} participants' lowest tested discount with a recorded switch was ${gbp(d.discount)} off`,
            }))}
          />
          <Stat
            label="Median estimated switch point (switchers)"
            value={gbp(a.switchPoints.median)}
            note={`${interval(a.switchPoints.medianInterval, gbp)}. Lowest tested discount with a switch; later choices can differ.`}
          />
        </div>
        <p className="text-sm text-ink-2" role="note">
          {a.switchPoints.nonMonotonicCount} of {a.switchPoints.n} complete price patterns were non-monotonic
          (a participant switched at a lower discount, then chose their baseline product at a higher one).
          The estimate does not smooth or discard those responses.
        </p>
        <details className="rounded-lg border border-line bg-bg p-3">
          <summary className="cursor-pointer font-medium">Inspect individual price responses</summary>
          <p className="mb-3 mt-2 text-sm text-ink-2">
            Responses are listed from the smallest to largest tested discount. IDs are anonymous participant IDs.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th className="p-2 font-medium">Participant</th>
                  <th className="p-2 font-medium">Pattern</th>
                  <th className="p-2 font-medium">Price choices (in discount order)</th>
                  <th className="p-2 font-medium">Estimate</th>
                </tr>
              </thead>
              <tbody>
                {a.byParticipant.filter((p) => p.priceResponses.length > 0).map((p) => (
                  <tr key={p.participantId} className="border-b border-line last:border-0">
                    <td className="p-2 font-mono text-xs" title={p.participantId}>{p.participantId.slice(0, 8)}</td>
                    <td className="p-2">{p.pricePattern === "non_monotonic" ? "Non-monotonic" : p.pricePattern === "incomplete" ? "Incomplete" : "Consistent"}</td>
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
