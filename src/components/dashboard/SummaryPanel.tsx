import { DIRECTIONAL_THRESHOLD } from "@/domain/analysis/analyze";
import type { DashboardData } from "@/contracts/responses";
import { HBarChart } from "../charts/BarCharts";
import { Card, Stat } from "../ui/Card";
import { gbp, pct } from "./format";

/** A compact overview that answers: how many responses, what changed choices, and how certain is that? */
export function SummaryPanel({
  data,
  experimentUrl,
  qrDataUrl,
}: {
  data: DashboardData;
  experimentUrl: string;
  qrDataUrl: string;
}) {
  const synthetic = data.experiment.version === "v1-synthetic-demo";
  const sample = data.analysis.participants;
  const completionRate = data.started ? data.completed / data.started : null;
  const conditions = [...data.analysis.conditions].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  const leadingOffer = conditions.find((condition) => condition.rate !== null);
  const hasDirectionalSample = !synthetic && sample < DIRECTIONAL_THRESHOLD;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="text-xl font-semibold">Study overview</h2>
        <p className="mt-1 text-sm text-ink-2">
          {synthetic
            ? "A simulated sample to demonstrate the dashboard. These are not real shopper responses."
            : "A quick view of response progress and which test conditions were associated with switching."}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Study summary">
        <Stat
          label={synthetic ? "Simulated profiles" : "Responses analysed"}
          value={String(sample)}
          note={synthetic ? "Generated for the demo" : "Participants with a baseline choice"}
        />
        <Stat
          label={synthetic ? "Simulated completion" : "Study completion"}
          value={completionRate === null ? "–" : pct(completionRate)}
          note={`${data.completed} finished out of ${data.started} started`}
        />
        <Stat
          label={synthetic ? "Highest simulated switch rate" : "Highest switch rate"}
          value={leadingOffer ? pct(leadingOffer.rate) : "–"}
          note={leadingOffer ? leadingOffer.label : "Waiting for completed responses"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card title={synthetic ? "Switch rates in this simulation" : "Switch rate by test condition"} n={sample}>
          <p className="-mt-2 text-sm text-ink-2">
            Share who chose the other coffee after its price, promotion or trust cue changed.
          </p>
          <HBarChart
            title="Switch rate by test condition"
            format={(value) => `${Math.round(value * 100)}%`}
            rows={conditions.map((condition) => ({
              key: condition.scenarioId,
              label: condition.label,
              value: condition.rate,
              interval: condition.interval,
              n: condition.n,
              tooltip: `${condition.label}: ${condition.switches} of ${condition.n} responses switched (${pct(condition.rate)})`,
            }))}
          />
          <p className="text-xs text-ink-3">
            Bars show the observed rate. Thin marks show the 95% uncertainty interval; wider marks mean less precision.
          </p>
        </Card>

        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold">How to read this</h3>
            {synthetic ? (
              <p className="mt-2 text-sm text-ink-2">
                The patterns are invented to show the analysis. Use them to demonstrate the product, not to make retail decisions.
              </p>
            ) : hasDirectionalSample ? (
              <p className="mt-2 text-sm text-ink-2">
                This is an early signal from {sample} responses. The app marks results directional below {DIRECTIONAL_THRESHOLD} participants.
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-2">
                These results describe choices in this study. They do not prove what shoppers will buy in a store.
              </p>
            )}
          </div>

          {!synthetic && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR code linking to ${experimentUrl}`} className="h-20 w-20 rounded bg-white p-1" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">Invite more participants</p>
                <p className="mt-1 break-all text-xs text-ink-2">{experimentUrl}</p>
              </div>
            </div>
          )}
        </aside>
      </section>

      {leadingOffer && (
        <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
          {synthetic ? "In this simulation," : "So far,"} <strong className="font-semibold text-ink">{leadingOffer.label}</strong>{" "}
          had the highest observed switch rate: {leadingOffer.switches} of {leadingOffer.n} responses ({pct(leadingOffer.rate)}).
          {data.analysis.switchPoints.median !== null && (
            <span> The estimated middle price switch point was {gbp(data.analysis.switchPoints.median)}.</span>
          )}
        </p>
      )}
    </div>
  );
}
