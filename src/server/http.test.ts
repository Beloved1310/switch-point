import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, type ErrorKind } from "@/application/errors";
import { parseBody, parseQuery, route } from "./http";

vi.mock("server-only", () => ({}));

afterEach(() => vi.restoreAllMocks());

const request = (body?: string) =>
  new Request("http://test.local/api/x", { method: "POST", body, headers: { "content-type": "application/json" } });

describe("route", () => {
  it("returns a plain result as JSON with status 200", async () => {
    const res = await route(async () => ({ ok: true }))(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("passes a Response through unchanged", async () => {
    const csv = new Response("a,b", { headers: { "content-type": "text/csv" } });
    expect(await route(async () => csv)(request())).toBe(csv);
  });

  it.each([
    ["invalid", 400],
    ["unauthorised", 401],
    ["not_found", 404],
    ["conflict", 409],
    ["rate_limited", 429],
    ["unavailable", 503],
  ] as [ErrorKind, number][])("maps a %s error to %i with its message", async (kind, status) => {
    const res = await route(async () => {
      throw new AppError(kind, `failed: ${kind}`);
    })(request());
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: `failed: ${kind}` });
  });

  it("hides the detail of an unexpected error behind a generic 500", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await route(async () => {
      throw new Error("connection string with secrets");
    })(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong" });
    expect(logged).toHaveBeenCalled();
  });
});

describe("parseBody", () => {
  const schema = z.object({ n: z.number() });

  it("returns the validated body", async () => {
    expect(await parseBody(request('{"n":1}'), schema)).toEqual({ n: 1 });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["an empty body", undefined],
    ["a body that fails the schema", '{"n":"one"}'],
  ])("rejects %s as invalid", async (_, body) => {
    await expect(parseBody(request(body), schema)).rejects.toMatchObject({ kind: "invalid", message: "Invalid request" });
  });
});

describe("parseQuery", () => {
  const schema = z.object({ table: z.enum(["choices", "stated"]), version: z.string().optional() });

  it("validates search parameters", () => {
    const req = new Request("http://test.local/api/x?table=stated&version=v1");
    expect(parseQuery(req, schema)).toEqual({ table: "stated", version: "v1" });
  });

  it("rejects an invalid query", () => {
    expect(() => parseQuery(new Request("http://test.local/api/x?table=users"), schema)).toThrow(
      expect.objectContaining({ kind: "invalid", message: "Invalid query" }),
    );
  });
});
