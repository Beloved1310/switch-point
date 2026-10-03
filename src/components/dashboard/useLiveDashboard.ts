"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, ApiError } from "@/client/api";
import type { DashboardData } from "@/contracts/responses";

const POLL_MS = 15_000;
const DEBOUNCE_MS = 500;

export interface RealtimeConfig {
  url: string | null;
  anonKey: string | null;
  channel: string;
}

/**
 * Keeps dashboard data fresh (FR18): a Supabase Realtime broadcast triggers
 * a debounced refetch, and polling covers any missed broadcast.
 */
export function useLiveDashboard(initial: DashboardData, realtime: RealtimeConfig) {
  const [data, setData] = useState(initial);
  const [live, setLive] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = initial.experiment.version;

  const refresh = useCallback(async () => {
    try {
      setData(await adminApi.results(version));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) window.location.href = "/admin/login";
    }
  }, [version]);

  const scheduleRefresh = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(refresh, DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    if (!realtime.url || !realtime.anonKey) return () => clearInterval(timer);
    const supabase = createClient(realtime.url, realtime.anonKey, { auth: { persistSession: false } });
    const channel = supabase
      .channel(realtime.channel)
      .on("broadcast", { event: "*" }, scheduleRefresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [realtime.url, realtime.anonKey, realtime.channel, refresh, scheduleRefresh]);

  return { data, live, refresh };
}
