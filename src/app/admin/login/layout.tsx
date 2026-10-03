import { redirect } from "next/navigation";
import { isAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Already signed in? Skip the form and go straight to the dashboard. */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  if (await isAdmin()) redirect("/dashboard");
  return children;
}
