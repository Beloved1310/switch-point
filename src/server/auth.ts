import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/application/errors";

export const ADMIN_COOKIE = "sp_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

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

/** Returns a session token if the password is correct. */
export function checkPassword(candidate: string): string | null {
  const password = process.env.ADMIN_PASSWORD;
  return password && safeEqual(candidate, password) ? token() : null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = token();
  const actual = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(expected && actual && safeEqual(actual, expected));
}

/** Guard for retailer-only routes (NFR3). */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new AppError("unauthorised", "Unauthorised");
}
