import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { AppError, invalid, type ErrorKind } from "@/application/errors";

const STATUS: Record<ErrorKind, number> = {
  invalid: 400,
  unauthorised: 401,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
};

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * Wrap a route handler: plain results become JSON, AppErrors become their
 * status code, and anything unexpected becomes a generic 500.
 */
export function route(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      const result = await handler(req);
      return result instanceof Response ? result : json(result);
    } catch (error) {
      if (error instanceof AppError) return json({ error: error.message }, STATUS[error.kind]);
      console.error(error);
      return json({ error: "Something went wrong" }, 500);
    }
  };
}

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw invalid("Invalid request");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw invalid("Invalid request");
  return result.data;
}

export function parseQuery<T>(req: Request, schema: z.ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) throw invalid("Invalid query");
  return result.data;
}
