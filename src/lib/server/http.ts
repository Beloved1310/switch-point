import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const fail = (message: string, status: number) => json({ error: message }, status);

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const result = schema.safeParse(await req.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
