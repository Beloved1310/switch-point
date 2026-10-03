"use client";

import { useEffect, useState } from "react";
import type { DashboardData } from "@/contracts/responses";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs, type TabItem } from "./DashboardTabs";
import { ExportLinks } from "./ExportLinks";
import type { DashboardTab } from "./findings";
import { FulfilmentPanel } from "./FulfilmentPanel";
import { InsightPanel } from "./InsightPanel";
import { ObservedSection } from "./ObservedSection";
import { ReasonsTable } from "./ReasonsTable";
import { SayDoSection } from "./SayDoSection";
import { SummaryPanel } from "./SummaryPanel";
import { useLiveDashboard, type RealtimeConfig } from "./useLiveDashboard";

interface Props {
  initial: DashboardData;
  experimentUrl: string;
  qrDataUrl: string;
  realtime: RealtimeConfig;
}

/** Retailer dashboard: a plain-language summary first, details one tab away. */
export function DashboardClient({ initial, experimentUrl, qrDataUrl, realtime }: Props) {
  const { data, live, refresh } = useLiveDashboard(initial, realtime);

  const tabs: TabItem[] = [
    { id: "summary", label: "Summary" },
    { id: "behaviour", label: "What shoppers did" },
    { id: "saydo", label: "Say vs do" },
    {
      id: "reasons",
      label: "Reasons",
      count: data.reasons.filter((r) => r.aiStatus === "failed" || r.aiStatus === "skipped").length,
    },
    ...(data.fulfilment.enabled
      ? [{ id: "rewards" as const, label: "Rewards", count: data.fulfilment.pending.length }]
      : []),
  ];

  const [tab, setTab] = useState<DashboardTab>("summary");

  // Keep the open tab in the URL hash so a refresh or shared link lands on it.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (tabs.some((t) => t.id === fromHash)) setTab(fromHash as DashboardTab);
    // Read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(next: DashboardTab) {
    setTab(next);
    history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="dashboard-page mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <DashboardHeader experiment={data.experiment} versions={data.versions} live={live} />
      <DashboardTabs tabs={tabs} active={tab} onSelect={open} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex flex-col gap-8">
        {tab === "summary" && (
          <>
            <SummaryPanel data={data} experimentUrl={experimentUrl} qrDataUrl={qrDataUrl} onOpen={open} />
            <InsightPanel data={data} onChange={refresh} />
          </>
        )}
        {tab === "behaviour" && <ObservedSection data={data} />}
        {tab === "saydo" && <SayDoSection data={data} />}
        {tab === "reasons" && <ReasonsTable data={data} onChange={refresh} />}
        {tab === "rewards" && data.fulfilment.enabled && <FulfilmentPanel data={data} onChange={refresh} />}
      </div>

      <ExportLinks version={data.experiment.version} generatedAt={data.generatedAt} />
    </main>
  );
}
