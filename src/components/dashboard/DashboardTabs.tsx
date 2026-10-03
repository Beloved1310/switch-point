import type { DashboardTab } from "./findings";

export interface TabItem {
  id: DashboardTab;
  label: string;
  /** Small count shown next to the label, e.g. items waiting for action. */
  count?: number;
}

export function DashboardTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: TabItem[];
  active: DashboardTab;
  onSelect: (tab: DashboardTab) => void;
}) {
  return (
    <nav aria-label="Dashboard sections" className="overflow-x-auto">
      <div role="tablist" className="glass pill inline-flex min-w-max gap-1 p-1.5">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              onClick={() => onSelect(t.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selected ? "bg-white/10 text-ink shadow-sm" : "text-ink-2 hover:bg-white/5 hover:text-ink"
              }`}
            >
              {t.label}
              {t.count ? (
                <span className="tabular rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink">
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
