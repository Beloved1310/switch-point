import { DIRECTIONAL_THRESHOLD } from "@/domain/analysis/analyze";

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ai"; children: React.ReactNode }) {
  const style = tone === "ai" ? "border-ai-line bg-ai-bg" : "border-line text-ink-2";
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}

export function SectionHeader({
  title,
  badge,
  intro,
}: {
  title: string;
  badge?: React.ReactNode;
  intro?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {badge}
      </div>
      {intro && <p className="mt-1 text-sm text-ink-2">{intro}</p>}
    </div>
  );
}

/** Measured results section: always labelled as calculated by code (NFR15). */
export function MeasuredSection({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={title} badge={<Badge>Measured · calculated by code</Badge>} intro={intro} />
      {children}
    </section>
  );
}

/** A result card that always shows its sample size (NFR16). */
export function Card({
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
          {n < DIRECTIONAL_THRESHOLD && " · directional"}
        </span>
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
