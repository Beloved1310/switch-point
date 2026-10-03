"use client";

import { useState } from "react";
import { adminApi } from "@/client/api";
import type { DashboardData } from "@/contracts/responses";
import { Badge, SectionHeader } from "../ui/Card";
import { LocalTime } from "../ui/LocalTime";

/** AI interpretation, visually separate from measured results (FR22, NFR15). */
export function InsightPanel({ data, onChange }: { data: DashboardData; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insight = data.insight;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.generateInsight(data.experiment.version);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-ai-line bg-ai-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Suggested next experiment"
          badge={<Badge tone="ai">AI-generated interpretation · not a measured result</Badge>}
          intro="Generated from the evidence summary above only. Any number not in that evidence is rejected."
        />
        <button
          type="button"
          disabled={busy || data.analysis.participants === 0}
          onClick={generate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60"
        >
          {busy ? "Generating…" : insight ? "Generate again" : "Generate suggestion"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      {!insight && <p className="text-sm text-ink-2">No suggestion yet.</p>}
      {insight && insight.status !== "accepted" && <p className="text-sm text-ink-2">{insight.detail}</p>}
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
