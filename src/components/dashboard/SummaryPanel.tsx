import { DIRECTIONAL_THRESHOLD } from "@/domain/analysis/analyze";
import type { DashboardData } from "@/contracts/responses";
import { PairedBarChart } from "../charts/BarCharts";
import { Badge } from "../ui/Card";
import { pct } from "./format";
import { attentionItems, keyFindings, type DashboardTab } from "./findings";

/** The first tab: progress, what needs action, and the main lessons in plain words. */
export function SummaryPanel({
  data,
  experimentUrl,
  qrDataUrl,
  onOpen,
}: {
  data: DashboardData;
  experimentUrl: string;
  qrDataUrl: string;
  onOpen: (tab: DashboardTab) => void;
}) {
  const items = attentionItems(data);
  const allFindings = keyFindings(data);
  const sayDo = allFindings.find((f) => f.tab === "saydo" && f.label === "Say vs do");
  const findings = allFindings.filter((f) => f !== sayDo);
  const levers = data.analysis.sayDo.leverRows;
  const people = data.analysis.participants;
  const progress = Math.min(1, people / DIRECTIONAL_THRESHOLD);
  const finishedShare = data.started ? Math.round((data.completed / data.started) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm text-ink-2">Responses</p>
          <p className="mt-1 text-lg">
            <span className="tabular text-3xl font-semibold">{data.started}</span> started
            <span className="mx-3 text-ink-3">·</span>
            <span className="tabular text-3xl font-semibold">{data.completed}</span> finished
            {data.started > 0 && <span className="ml-2 text-sm text-ink-3">({finishedShare}%)</span>}
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-ink-2">
              <span>Progress to reliable results</span>
              <span className="tabular">
                {people} of {DIRECTIONAL_THRESHOLD} people
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Progress to reliable results"
              aria-valuemin={0}
              aria-valuemax={DIRECTIONAL_THRESHOLD}
              aria-valuenow={Math.min(people, DIRECTIONAL_THRESHOLD)}
            >
              <div
                className={`h-full rounded-full ${progress >= 1 ? "bg-good" : "bg-accent"}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code linking to ${experimentUrl}`} className="h-28 w-28 rounded bg-white p-1" />
          <div className="max-w-48 text-sm text-ink-2">
            <p className="font-medium text-ink">Get more responses</p>
            <p className="mt-1">Shoppers scan this code to take part.</p>
            <p className="mt-1 break-all text-xs text-ink-3">{experimentUrl}</p>
          </div>
        </div>
      </section>

      <section className="glass flex flex-col gap-4 p-6" aria-labelledby="saydo-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent-text">Say vs do</p>
            <h2 id="saydo-heading" className="mt-1">
              {sayDo ? sayDo.headline : "What shoppers say, compared with what they do"}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {sayDo
                ? sayDo.detail
                : "This fills in as shoppers finish. Bars far apart mean people are not doing what they say."}
            </p>
          </div>
          <Badge>Measured · calculated by code</Badge>
        </div>
        <PairedBarChart
          title="For each reason, share who switched for it versus share who named it"
          aLabel="Actually switched for it"
          bLabel="Said it was their reason"
          rows={levers.map((r) => ({
            key: r.lever,
            label: r.lever,
            a: r.observedSwitchRate,
            b: r.statedShare,
            tooltip: `${r.lever}: ${pct(r.observedSwitchRate)} switched for it; ${pct(r.statedShare)} said it was their reason`,
          }))}
        />
        <button
          type="button"
          onClick={() => onOpen("saydo")}
          className="self-start text-sm font-medium text-accent-text underline"
        >
          Open the full comparison
        </button>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="attention-heading">
        <h2 id="attention-heading">Needs your attention</h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
            <span className="mr-2 text-good" aria-hidden>
              ✓
            </span>
            Everything looks fine. Nothing needs action right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.title}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                  item.tone === "warn" ? "border-warn-line bg-warn-bg" : "border-line bg-surface"
                }`}
              >
                <div className="flex gap-3">
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      item.tone === "warn" ? "bg-warn/15 text-warn" : "bg-white/10 text-ink-2"
                    }`}
                  >
                    {item.tone === "warn" ? "!" : "i"}
                  </span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm text-ink-2">{item.detail}</p>
                  </div>
                </div>
                {item.action && (
                  <button
                    type="button"
                    onClick={() => onOpen(item.action!.tab)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
                  >
                    {item.action.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="findings-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="findings-heading">What we have learned so far</h2>
          <Badge>Measured · calculated by code</Badge>
        </div>
        {findings.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
            Findings will appear here once people start finishing the study.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {findings.map((f) => (
              <article key={f.label} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{f.label}</p>
                <p className="text-lg font-semibold leading-snug">{f.headline}</p>
                <p className="text-sm text-ink-2">{f.detail}</p>
                <button
                  type="button"
                  onClick={() => onOpen(f.tab)}
                  className="mt-auto self-start text-sm font-medium text-accent-text underline"
                >
                  See the detail
                </button>
              </article>
            ))}
          </div>
        )}
        {data.analysis.baseline.directional && findings.length > 0 && (
          <p className="text-xs text-ink-3">
            Based on {people} {people === 1 ? "person" : "people"}. These describe this group only, not all shoppers.
          </p>
        )}
      </section>
    </div>
  );
}
