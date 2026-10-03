"use client";

import { useState } from "react";
import { adminApi } from "@/client/api";
import type { DashboardData } from "@/contracts/responses";
import { SectionHeader } from "../ui/Card";

/** Products owed to participants, by claim code (FR23). */
export function FulfilmentPanel({ data, onChange }: { data: DashboardData; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const { fulfilment } = data;

  async function markHandedOver(participantId: string) {
    setBusy(participantId);
    try {
      await adminApi.markFulfilled(participantId);
      await onChange();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Product fulfilment"
        intro={`${fulfilment.rule} ${fulfilment.fulfilled} handed over, ${fulfilment.pending.length} waiting.`}
      />
      {fulfilment.pending.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
          {fulfilment.pending.map((f) => (
            <li key={f.participantId} className="flex items-center justify-between gap-4 p-3 text-sm">
              <span>
                <span className="tabular font-semibold">{f.code}</span>
                <span className="ml-3 text-ink-2">{f.productName}</span>
              </span>
              <button
                type="button"
                disabled={busy === f.participantId}
                onClick={() => markHandedOver(f.participantId)}
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
