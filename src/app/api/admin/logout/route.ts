import { ADMIN_COOKIE } from "@/lib/server/auth";
import { json } from "@/lib/server/http";

export async function POST() {
  const res = json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
