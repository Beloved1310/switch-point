"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PriceGap } from "@/lib/analysis/analyze";
import { REASON_CATEGORIES, type ReasonCategory } from "@/lib/experiment/types";
import type { DashboardData } from "@/lib/server/dashboard";
import { HBarChart, PairedBarChart } from "./charts";

const POLL_MS = 15_000;

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
const gbp = (v: number | null) => (v === null ? "–" : `£${v.toFixed(2)}`);
const signedGbp = (v: number | null) => {
  if (v === null) return "–";
  const s = Math.abs(v).toFixed(2);
  return s === "0.00" ? "£0.00" : `${v > 0 ? "+" : "−"}£${s}`;
};
const range = (i: [number, number] | null, f: (v: number) => string) =>
  i ? `95% interval ${f(i[0])} to ${f(i[1])}` : "no interval yet";

const GAP_LABELS: Record<PriceGap, string> = {
  matched: "Switched where they said they would",
  switched_sooner: "Switched at a smaller discount than stated",
  switched_later: "Needed a bigger discount than stated",
  never_switched: "Never switched despite a stated threshold in range",
  no_price_switch_expected: "Stated threshold above tested range and did not switch",
};

interface Props {
  initial: DashboardData;
  experiment: { version: string; category: string; products: { id: string; name: string }[] };
  experimentUrl: string;
  qrDataUrl: string;
  realtime: { url: string | null; anonKey: string | null; channel: string };
}

export function DashboardClient({ initial, experiment, experimentUrl, qrDataUrl, realtime }: Props) {
  const [data, setData] = useState(initial);
  const [live, setLive] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/results", { cache: "no-store" });
    if (res.status === 401) window.location.href = "/admin/login";
    else if (res.ok) setData(await res.json());
  }, []);

  // Debounce bursts of events into one refetch.
  const scheduleRefresh = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(refresh, 500);
  }, [refresh]);

  // Realtime updates (FR18), with polling as a fallback.
  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    if (!realtime.url || !realtime.anonKey) return () => clearInterval(timer);
    const supabase = createClient(realtime.url, realtime.anonKey, { auth: { persistSession: false } });
    const channel = supabase
      .channel(realtime.channel)
      .on("broadcast", { event: "*" }, scheduleRefresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [realtime, refresh, scheduleRefresh]);

  const a = data.analysis;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-3">SwitchPoint · experiment {experiment.version}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{experiment.category}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-2">
          <span className="flex items-center gap-2" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-good" : "bg-ink-3"}`} aria-hidden />
            {live ? "Live" : "Refreshing every 15s"}
          </span>
          <button
            type="button"
            className="underline"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Started" value={String(data.started)} />
          <Stat label="Completed" value={String(data.completed)} />
          <Stat label="With a baseline choice" value={String(a.participants)} />
          <Stat
            label="Chose the left product"
            value={pct(a.leftChoiceRate.rate)}
            note={`Position check, ${a.leftChoiceRate.n} choices. Near 50% means side did not drive choice.`}
          />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code linking to ${experimentUrl}`} className="h-28 w-28 rounded bg-white p-1" />
          <div className="max-w-40 text-xs text-ink-2">
            <p className="font-medium text-ink">Scan to take part</p>
            <p className="mt-1 break-all">{experimentUrl}</p>
          </div>
        </div>
      </section>

      {a.baseline.directional && (
        <div role="note" className="rounded-lg border border-warn-line bg-warn-bg p-3 text-sm">
          <strong>Early, directional evidence.</strong> {a.participants} participants so far. Results with
          fewer than 30 participants show a direction, not an established effect, and describe this group
          rather than all shoppers.
        </div>
      )}

      <Section
        title="Observed behaviour"
        badge="Measured · calculated by code"
        intro="What participants actually chose. Switching means choosing the product they did not pick at baseline."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Baseline preference" n={a.baseline.n}>
            <div className="flex flex-col gap-3">
              {experiment.products.map((p) => {
                const count = a.baseline.shares[p.id as "A" | "B"];
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
                tooltip: `${c.label}: ${c.switches} of ${c.n} switched (${pct(c.rate)}), ${range(c.interval, (v) => pct(v))}${c.directional ? ". Directional." : ""}`,
              }))}
            />
            <Table
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
            <div className="flex flex-col gap-3">
              <Stat
                label="Median switch point (switchers)"
                value={gbp(a.switchPoints.median)}
                note={range(a.switchPoints.medianInterval, gbp)}
              />
            </div>
          </div>
        </Card>
      </Section>

      <Section
        title="Say vs do"
        badge="Measured · calculated by code"
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
              note={range(a.stated.medianThresholdInterval, gbp)}
            />
            <Stat
              label="Average gap, observed minus stated"
              value={signedGbp(a.sayDo.meanPriceGap)}
              note={`Positive means they needed more than they said. ${range(a.sayDo.meanPriceGapInterval, (v) => `£${v.toFixed(2)}`)}`}
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
                <span className="text-ink-2">{GAP_LABELS[g.gap]}</span>
                <span className="tabular font-semibold">
                  {g.count}
                  <span className="ml-2 font-normal text-ink-3">{a.sayDo.n ? pct(g.count / a.sayDo.n) : "–"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <InsightPanel data={data} onChange={refresh} />

      <ReasonsTable data={data} onChange={refresh} />

      {data.fulfilment.enabled && <Fulfilment data={data} onChange={refresh} />}

      <section className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-ink-2">Export anonymised responses:</span>
        <a className="font-medium text-accent underline" href="/api/admin/export?table=choices">
          Choices CSV
        </a>
        <a className="font-medium text-accent underline" href="/api/admin/export?table=stated">
          Stated reasons CSV
        </a>
        <span className="text-ink-3">
          Updated <LocalTime iso={data.generatedAt} time />
        </span>
      </section>
    </main>
  );
}

/** Formats in the viewer's locale after mount, avoiding a hydration mismatch. */
function LocalTime({ iso, time = false }: { iso: string; time?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    setText(time ? d.toLocaleTimeString() : d.toLocaleString());
  }, [iso, time]);
  return <time dateTime={iso}>{text ?? ""}</time>;
}

function Section({
  title,
  badge,
  intro,
  children,
}: {
  title: string;
  badge: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-2">{badge}</span>
        </div>
        <p className="mt-1 text-sm text-ink-2">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function Card({
  title,
  n,
  className = "",
  children,
}: {
  title: string;
  n: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold">{title}</h3>
        <span className="tabular text-xs text-ink-3">
          n={n}
          {n < 30 && " · directional"}
        </span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </div>
  );
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-2">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line text-ink-3">
              {head.map((h) => (
                <th key={h} className="py-1.5 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-line last:border-0">
                {r.map((c, i) => (
                  <td key={i} className="py-1.5 pr-4">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function InsightPanel({ data, onChange }: { data: DashboardData; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insight = data.insight;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-ai-line bg-ai-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Suggested next experiment</h2>
            <span className="rounded-full border border-ai-line px-2.5 py-0.5 text-xs font-medium">
              AI-generated interpretation · not a measured result
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            Generated from the evidence summary above only. Any number not in that evidence is rejected.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || data.analysis.participants === 0}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await postJson("/api/admin/insight");
              await onChange();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60"
        >
          {busy ? "Generating…" : insight ? "Generate again" : "Generate suggestion"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {!insight && <p className="text-sm text-ink-2">No suggestion yet.</p>}
      {insight && insight.status !== "accepted" && (
        <p className="text-sm text-ink-2">{insight.detail}</p>
      )}
      {insight?.status === "accepted" && insight.suggestion && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">{insight.suggestion.title}</h3>
          <p>
            <span className="font-medium">Hypothesis: </span>
            {insight.suggestion.hypothesis}
          </p>
          <p className="text-ink-2">{insight.suggestion.rationale}</p>
          <div>
            <p className="text-sm font-medium">Proposed conditions ({insight.suggestion.lever})</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
              {insight.suggestion.proposed_conditions.map((c) => (
                <li key={c.label}>
                  {c.label}
                  {c.price_discount_gbp > 0 && ` · £${c.price_discount_gbp.toFixed(2)} off`}
                  {c.promotion && !c.label.includes(c.promotion) && ` · ${c.promotion}`}
                  {c.trust_badge && !c.label.includes(c.trust_badge) && ` · ${c.trust_badge}`}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-3">
            Generated <LocalTime iso={insight.createdAt} />
          </p>
        </div>
      )}
    </section>
  );
}

function ReasonsTable({ data, onChange }: { data: DashboardData; onChange: () => Promise<void> }) {
  const [saving, setSaving] = useState<string | null>(null);

  async function override(participantId: string, category: ReasonCategory | null) {
    setSaving(participantId);
    try {
      await postJson("/api/admin/override", { participantId, category });
      await onChange();
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Stated reasons</h2>
          <span className="rounded-full border border-ai-line bg-ai-bg px-2.5 py-0.5 text-xs font-medium">
            Categories by AI · editable
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-2">
          Participants&apos; own words are never changed. Override a category if the AI got it wrong.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th className="p-3 font-medium">Reason</th>
              <th className="p-3 font-medium">Stated £</th>
              <th className="p-3 font-medium">Asked</th>
              <th className="p-3 font-medium">AI category</th>
              <th className="p-3 font-medium">Override</th>
            </tr>
          </thead>
          <tbody>
            {data.reasons.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-ink-2">
                  No responses yet.
                </td>
              </tr>
            )}
            {data.reasons.slice(0, 200).map((r) => (
              <tr key={r.participantId} className="border-b border-line last:border-0 align-top">
                <td className="max-w-md p-3">{r.reasonText}</td>
                <td className="tabular p-3">{r.statedPriceThreshold === null ? "Not on price" : `£${r.statedPriceThreshold.toFixed(2)}`}</td>
                <td className="p-3 text-ink-2">{r.phase === "before" ? "Before choices" : "After choices"}</td>
                <td className="p-3">
                  {r.aiCategory ?? <span className="text-ink-3">{r.aiStatus === "pending" ? "Classifying…" : `AI ${r.aiStatus}`}</span>}
                  {r.aiConfidence && <span className="ml-1 text-xs text-ink-3">({r.aiConfidence})</span>}
                </td>
                <td className="p-3">
                  <label className="sr-only" htmlFor={`ov-${r.participantId}`}>
                    Override category
                  </label>
                  <select
                    id={`ov-${r.participantId}`}
                    value={r.overrideCategory ?? ""}
                    disabled={saving === r.participantId}
                    onChange={(e) => override(r.participantId, (e.target.value || null) as ReasonCategory | null)}
                    className="rounded-md border border-line bg-surface p-1.5"
                  >
                    <option value="">Use AI label</option>
                    {REASON_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Fulfilment({
  data,
  onChange,
}: {
  data: DashboardData;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Product fulfilment</h2>
        <p className="mt-1 text-sm text-ink-2">
          {data.fulfilment.rule} {data.fulfilment.fulfilled} handed over, {data.fulfilment.pending.length} waiting.
        </p>
      </div>
      {data.fulfilment.pending.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
          {data.fulfilment.pending.map((f) => (
            <li key={f.participantId} className="flex items-center justify-between gap-4 p-3 text-sm">
              <span>
                <span className="tabular font-semibold">{f.code}</span>
                <span className="ml-3 text-ink-2">{f.productName}</span>
              </span>
              <button
                type="button"
                disabled={busy === f.participantId}
                onClick={async () => {
                  setBusy(f.participantId);
                  try {
                    await postJson("/api/admin/fulfil", { participantId: f.participantId });
                    await onChange();
                  } finally {
                    setBusy(null);
                  }
                }}
                className="rounded-md border border-line px-3 py-1.5 font-medium"
              >
                Mark handed over
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
