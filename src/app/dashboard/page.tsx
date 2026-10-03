import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getDashboard } from "@/application/retailer/getDashboard";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { RESULTS_CHANNEL } from "@/contracts/realtime";
import { isAdmin } from "@/server/auth";
import { container } from "@/server/container";

export const metadata: Metadata = { title: "Dashboard · SwitchPoint" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { version } = await searchParams;

  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const experimentUrl = `${origin}/experiment`;
  const [data, qrDataUrl] = await Promise.all([
    getDashboard(container(), version),
    QRCode.toDataURL(experimentUrl, { margin: 1, width: 240 }),
  ]);

  return (
    <DashboardClient
      initial={data}
      experimentUrl={experimentUrl}
      qrDataUrl={qrDataUrl}
      realtime={{
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
        channel: RESULTS_CHANNEL,
      }}
    />
  );
}
