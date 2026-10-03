import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sp_admin";

function token(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update("switchpoint-admin").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(candidate: string): string | null {
  const password = process.env.ADMIN_PASSWORD;
  return password && safeEqual(candidate, password) ? token() : null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = token();
  const actual = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(expected && actual && safeEqual(actual, expected));
}
