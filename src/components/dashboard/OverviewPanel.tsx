import { DIRECTIONAL_THRESHOLD } from "@/domain/analysis/analyze";
import type { DashboardData } from "@/contracts/responses";
import { Stat } from "../ui/Card";
import { pct } from "./format";

export function OverviewPanel({
  data,
  experimentUrl,
  qrDataUrl,
}: {
  data: DashboardData;
  experimentUrl: string;
  qrDataUrl: string;
}) {
  const a = data.analysis;
  return (
    <>
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
          fewer than {DIRECTIONAL_THRESHOLD} participants show a direction, not an established effect, and
          describe this group rather than all shoppers.
        </div>
      )}
    </>
  );
}
