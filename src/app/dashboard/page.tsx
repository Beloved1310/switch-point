import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { DashboardClient } from "@/components/DashboardClient";
import { EXPERIMENT } from "@/lib/experiment/config";
import { isAdmin } from "@/lib/server/auth";
import { RESULTS_CHANNEL } from "@/lib/server/broadcast";
import { loadDashboardData } from "@/lib/server/dashboard";

export const metadata: Metadata = { title: "Dashboard · SwitchPoint" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const experimentUrl = `${origin}/experiment`;
  const [data, qr] = await Promise.all([
    loadDashboardData(),
    QRCode.toDataURL(experimentUrl, { margin: 1, width: 240 }),
  ]);

  return (
    <DashboardClient
      initial={data}
      experiment={{
        version: EXPERIMENT.version,
        category: EXPERIMENT.category,
        products: EXPERIMENT.products.map((p) => ({ id: p.id, name: p.name })),
      }}
      experimentUrl={experimentUrl}
      qrDataUrl={qr}
      realtime={{
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
        channel: RESULTS_CHANNEL,
      }}
    />
  );
}
