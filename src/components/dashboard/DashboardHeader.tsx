"use client";

import { adminApi } from "@/client/api";
import type { ExperimentSummary } from "@/contracts/responses";

export function DashboardHeader({
  experiment,
  versions,
  live,
}: {
  experiment: ExperimentSummary;
  versions: string[];
  live: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-ink-3">
          <span>SwitchPoint · experiment</span>
          {versions.length > 1 ? (
            <select
              aria-label="Experiment version"
              value={experiment.version}
              onChange={(e) => (window.location.href = `/dashboard?version=${encodeURIComponent(e.target.value)}`)}
              className="rounded-md border border-line bg-surface px-1.5 py-0.5"
            >
              {versions.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <span>{experiment.version}</span>
          )}
        </div>
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
            await adminApi.logout();
            window.location.href = "/admin/login";
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
