"use client";

import { useState } from "react";
import { adminApi } from "@/client/api";
import { REASON_CATEGORIES, type ReasonCategory } from "@/domain/experiment/types";
import type { DashboardData } from "@/contracts/responses";
import { Badge, SectionHeader } from "../ui/Card";

const MAX_ROWS = 200;

/** Participants' own words with AI categories and admin overrides (FR11, FR12). */
export function ReasonsTable({ data, onChange }: { data: DashboardData; onChange: () => Promise<void> }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const needsRetry = data.reasons.filter((r) => r.aiStatus === "failed" || r.aiStatus === "skipped").length;

  async function override(participantId: string, category: ReasonCategory | null) {
    setSaving(participantId);
    setMessage(null);
    try {
      await adminApi.overrideCategory(participantId, category);
      await onChange();
    } catch (e) {
      setMessage({ text: (e as Error).message, isError: true });
    } finally {
      setSaving(null);
    }
  }

  async function retryAi() {
    setRetrying(true);
    setMessage(null);
    try {
      const { queued } = await adminApi.reclassify(data.experiment.version);
      setMessage({
        text: queued ? `Retrying ${queued} reason${queued === 1 ? "" : "s"}. Results appear as they finish.` : "Nothing to retry.",
        isError: false,
      });
    } catch (e) {
      setMessage({ text: (e as Error).message, isError: true });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Stated reasons"
          badge={<Badge tone="ai">Categories by AI · editable</Badge>}
          intro="Participants' own words are never changed. Override a category if the AI got it wrong."
        />
        {needsRetry > 0 && (
          <button
            type="button"
            disabled={retrying}
            onClick={retryAi}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {retrying ? "Retrying…" : `Retry AI for ${needsRetry} unclassified`}
          </button>
        )}
      </div>
      {message && (
        <p role={message.isError ? "alert" : "status"} className={`text-sm ${message.isError ? "text-bad" : "text-ink-2"}`}>
          {message.text}
        </p>
      )}
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
            {data.reasons.slice(0, MAX_ROWS).map((r) => (
              <tr key={r.participantId} className="border-b border-line align-top last:border-0">
                <td className="max-w-md p-3">{r.reasonText}</td>
                <td className="tabular p-3">
                  {r.statedPriceThreshold === null ? "Not on price" : `£${r.statedPriceThreshold.toFixed(2)}`}
                </td>
                <td className="p-3 text-ink-2">{r.phase === "before" ? "Before choices" : "After choices"}</td>
                <td className="p-3">
                  {r.aiCategory ?? (
                    <span className="text-ink-3">{r.aiStatus === "pending" ? "Classifying…" : `AI ${r.aiStatus}`}</span>
                  )}
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
