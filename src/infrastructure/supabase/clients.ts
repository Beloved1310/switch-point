import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Upper bound on any single database call, so a slow database fails fast instead of hanging a request. */
export const DB_TIMEOUT_MS = 8_000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(DB_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

const opts = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
};

let publicClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/** Anon-key client: RLS allows it to INSERT responses and nothing else. */
export function publicDb(): SupabaseClient {
  return (publicClient ??= createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    opts,
  ));
}

/** Service-role client: bypasses RLS. Server-only (NFR2). */
export function serviceDb(): SupabaseClient {
  return (serviceClient ??= createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    opts,
  ));
}

export const isUniqueViolation = (error: { code?: string } | null) => error?.code === "23505";

/** supabase-js reports a failed fetch (including our timeout) as an error with no Postgres code. */
export const isNetworkFailure = (error: { code?: string; message: string } | null) =>
  Boolean(error && !error.code && /abort|timeout|timed out|fetch failed/i.test(error.message));
