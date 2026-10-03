import { z } from "zod";
import { ADMIN_COOKIE, checkPassword } from "@/lib/server/auth";
import { fail, json, parseBody } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (rateLimited(req, "login", 5)) return fail("Too many attempts", 429);
  const body = await parseBody(req, bodySchema);
  const token = body && checkPassword(body.password);
  if (!token) return fail("Incorrect password", 401);
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
