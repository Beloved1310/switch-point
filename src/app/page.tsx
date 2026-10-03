import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-4 py-12">
      <div>
        <p className="text-sm font-medium text-ink-3">SwitchPoint</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          What would make you switch?
        </h1>
        <p className="mt-3 text-ink-2">
          A three-minute shopping experiment. Pick between two products a few times and tell
          us what matters to you. No name or email needed.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/experiment"
          className="rounded-lg bg-accent px-5 py-3 text-center font-medium text-accent-ink"
        >
          Take part
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-line px-5 py-3 text-center font-medium text-ink-2"
        >
          Retailer dashboard
        </Link>
      </div>
    </main>
  );
}
