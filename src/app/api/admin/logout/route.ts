import { ADMIN_COOKIE } from "@/server/auth";
import { json } from "@/server/http";

export async function POST() {
  const res = json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
