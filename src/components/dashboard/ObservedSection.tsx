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

      <Card title="Price switch points" n={a.switchPoints.n}>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <HBarChart
            title="Smallest discount at which each participant switched"
            max={Math.max(1, ...a.switchPoints.distribution.map((d) => d.count))}
            format={(v) => String(Math.round(v))}
            rows={a.switchPoints.distribution.map((d) => ({
              key: String(d.discount),
              label: d.discount === null ? "Never switched on price" : `First switched at ${gbp(d.discount)} off`,
              value: d.count,
              n: a.switchPoints.n,
              tooltip:
                d.discount === null
                  ? `${d.count} participants did not switch at any tested discount`
                  : `${d.count} participants first switched at ${gbp(d.discount)} off`,
            }))}
          />
          <Stat
            label="Median switch point (switchers)"
            value={gbp(a.switchPoints.median)}
            note={interval(a.switchPoints.medianInterval, gbp)}
          />
        </div>
      </Card>
    </MeasuredSection>
  );
}
