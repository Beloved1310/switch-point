import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

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
