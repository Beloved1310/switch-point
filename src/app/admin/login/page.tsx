"use client";

import Link from "next/link";
import { useState } from "react";
import { adminApi } from "@/client/api";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="login-card glass flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-2">
          <Link href="/" className="wordmark text-base" aria-label="SwitchPoint home">
            <span className="wordmark-mark">S</span> switchpoint<span className="wordmark-period">.</span>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-ink-2">Sign in to see what is making your shoppers switch.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor="password" className="font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-line bg-surface p-3"
            required
          />
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <Link href="/" className="dashboard-home-link text-sm">
          ← Back to SwitchPoint home
        </Link>
      </div>
    </main>
  );
}
