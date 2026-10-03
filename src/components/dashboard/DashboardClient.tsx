"use client";

import type { DashboardData } from "@/contracts/responses";
import { DashboardHeader } from "./DashboardHeader";
import { ExportLinks } from "./ExportLinks";
import { FulfilmentPanel } from "./FulfilmentPanel";
import { InsightPanel } from "./InsightPanel";
import { ObservedSection } from "./ObservedSection";
import { OverviewPanel } from "./OverviewPanel";
import { ReasonsTable } from "./ReasonsTable";
import { SayDoSection } from "./SayDoSection";
import { useLiveDashboard, type RealtimeConfig } from "./useLiveDashboard";

interface Props {
  initial: DashboardData;
  experimentUrl: string;
  qrDataUrl: string;
  realtime: RealtimeConfig;
}

/** Retailer dashboard: composes sections around live-updating data. */
export function DashboardClient({ initial, experimentUrl, qrDataUrl, realtime }: Props) {
  const { data, live, refresh } = useLiveDashboard(initial, realtime);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <DashboardHeader experiment={data.experiment} versions={data.versions} live={live} />
      <OverviewPanel data={data} experimentUrl={experimentUrl} qrDataUrl={qrDataUrl} />
      <ObservedSection data={data} />
      <SayDoSection data={data} />
      <InsightPanel data={data} onChange={refresh} />
      <ReasonsTable data={data} onChange={refresh} />
      {data.fulfilment.enabled && <FulfilmentPanel data={data} onChange={refresh} />}
      <ExportLinks version={data.experiment.version} generatedAt={data.generatedAt} />
    </main>
  );
}
