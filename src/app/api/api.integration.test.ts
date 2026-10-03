import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDeps } from "@/application/testing/inMemory";
import type { RecordChoiceResponse, StartParticipantResponse } from "@/contracts/responses";
import { BASELINE_SCENARIO_ID } from "@/domain/experiment/types";

/**
 * Integration tests for the HTTP layer: real route handlers, request
 * validation, auth, rate limiting and use cases, wired to in-memory adapters
 * instead of Supabase and Groq.
 */

const ctx = vi.hoisted(() => ({
  t: null as unknown as ReturnType<typeof import("@/application/testing/inMemory").createTestDeps>,
  jar: new Map<string, string>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/container", () => ({ container: () => ctx.t.deps }));
vi.mock("@/infrastructure/supabase/rateLimitStore", () => ({ rateLimitStore: { hit: async () => 1 } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (ctx.jar.has(name) ? { name, value: ctx.jar.get(name)! } : undefined),
  }),
}));

const { POST: startRoute } = await import("./participants/route");
const { POST: resumeRoute } = await import("./participants/resume/route");
const { POST: choicesRoute } = await import("./choices/route");
const { POST: statedRoute } = await import("./stated/route");
const { POST: completeRoute } = await import("./complete/route");
const { GET: resultsRoute } = await import("./results/route");
const { POST: loginRoute } = await import("./admin/login/route");
const { POST: logoutRoute } = await import("./admin/logout/route");
const { GET: exportRoute } = await import("./admin/export/route");
const { POST: overrideRoute } = await import("./admin/override/route");
const { POST: fulfilRoute } = await import("./admin/fulfil/route");
const { POST: insightRoute } = await import("./admin/insight/route");
const { POST: reclassifyRoute } = await import("./admin/reclassify/route");

type Handler = (req: Request) => Promise<Response>;

let ip = "";
let ipCounter = 0;

/** Call a route handler as the current client. */
async function call(handler: Handler, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const res = await handler(
    new Request(`http://test.local${path}`, {
      method,
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON (e.g. a CSV export).
  }
  return { status: res.status, headers: res.headers, text, json: json as Record<string, unknown> & any };
}

async function signIn() {
  const res = await call(loginRoute, "/api/admin/login", { password: "integration-password" });
  const cookie = res.headers.get("set-cookie")!.match(/sp_admin=([^;]+)/)![1];
  ctx.jar.set("sp_admin", cookie);
}

/** Run one participant through the whole study over HTTP. */
async function participate(reasonText = "Cheaper would do it") {
  const start = await call(startRoute, "/api/participants", {});
  const participant = start.json as StartParticipantResponse;
  const baseline = await call(choicesRoute, "/api/choices", {
    participantId: participant.participantId,
    scenarioId: BASELINE_SCENARIO_ID,
    side: "left",
  });
  const { screens } = baseline.json as RecordChoiceResponse;
  await call(statedRoute, "/api/stated", { participantId: participant.participantId, reasonText, statedPriceThreshold: 0.5 });
  for (const screen of screens!) {
    await call(choicesRoute, "/api/choices", { participantId: participant.participantId, scenarioId: screen.scenarioId, side: "right" });
  }
  const complete = await call(completeRoute, "/api/complete", { participantId: participant.participantId });
  return { participant, screens: screens!, complete };
}

beforeEach(() => {
  ctx.t = createTestDeps();
  ctx.jar.clear();
  // A fresh client per test, so the per-instance rate limit window never carries over.
  ip = `198.51.100.${++ipCounter}`;
  vi.stubEnv("ADMIN_PASSWORD", "integration-password");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "integration-secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("participant API", () => {
  it("runs a full participant journey and returns a reward", async () => {
    const { participant, screens, complete } = await participate();

    expect(participant.participantId).toMatch(/^[0-9a-f-]{36}$/);
    expect(participant.totalChoices).toBe(screens.length + 1);
    expect(complete.status).toBe(200);
    expect(complete.json).toMatchObject({ ok: true, reward: { code: participant.participantId.slice(0, 6).toUpperCase() } });
    expect(["Hearth Roast", "Ridgeline"]).toContain(complete.json.reward.productName);
    expect(ctx.t.store.choices).toHaveLength(screens.length + 1);
  });

  it("resumes a participant from server-side records", async () => {
    const start = await call(startRoute, "/api/participants", {});
    const { participantId } = start.json as StartParticipantResponse;
    await call(choicesRoute, "/api/choices", { participantId, scenarioId: BASELINE_SCENARIO_ID, side: "right" });

    const resumed = await call(resumeRoute, "/api/participants/resume", { participantId });
    expect(resumed.status).toBe(200);
    expect(resumed.json).toMatchObject({ participantId, completed: false, hasStated: false });
    expect(resumed.json.baselineProduct).toBe(start.json.baseline.right.productId);
  });

  it("rejects malformed bodies with 400 before touching storage", async () => {
    expect((await call(choicesRoute, "/api/choices", "{not json")).status).toBe(400);
    expect((await call(choicesRoute, "/api/choices", { participantId: "nope", scenarioId: "baseline", side: "left" })).status).toBe(400);
    expect(
      (await call(statedRoute, "/api/stated", { participantId: crypto.randomUUID(), reasonText: "", statedPriceThreshold: null })).status,
    ).toBe(400);
    expect(ctx.t.store.choices).toHaveLength(0);
  });

  it("returns 404 for an unknown participant", async () => {
    const res = await call(resumeRoute, "/api/participants/resume", { participantId: crypto.randomUUID() });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Unknown participant" });
  });

  it("returns 409 for out-of-order or late submissions", async () => {
    const start = await call(startRoute, "/api/participants", {});
    const { participantId } = start.json as StartParticipantResponse;

    const early = await call(completeRoute, "/api/complete", { participantId });
    expect(early.status).toBe(409);
    const skipped = await call(choicesRoute, "/api/choices", { participantId, scenarioId: "price_050", side: "left" });
    expect(skipped).toMatchObject({ status: 409, json: { error: "Baseline choice required first" } });

    const { participant, screens } = await participate();
    const late = await call(choicesRoute, "/api/choices", {
      participantId: participant.participantId,
      scenarioId: screens[0].scenarioId,
      side: "left",
    });
    expect(late).toMatchObject({ status: 409, json: { error: "Experiment already completed" } });
  });

  it("rate limits enrolment per client with 429", async () => {
    for (let i = 0; i < 10; i++) expect((await call(startRoute, "/api/participants", {})).status).toBe(200);
    const blocked = await call(startRoute, "/api/participants", {});
    expect(blocked.status).toBe(429);
    expect(blocked.json.error).toMatch(/Too many requests/);

    ip = "198.51.100.250";
    expect((await call(startRoute, "/api/participants", {})).status).toBe(200);
  });
});

describe("admin API", () => {
  it.each([
    ["results", () => call(resultsRoute, "/api/results")],
    ["export", () => call(exportRoute, "/api/admin/export?table=choices")],
    ["override", () => call(overrideRoute, "/api/admin/override", { participantId: crypto.randomUUID(), category: "price" })],
    ["fulfil", () => call(fulfilRoute, "/api/admin/fulfil", { participantId: crypto.randomUUID() })],
    ["insight", () => call(insightRoute, "/api/admin/insight", {})],
    ["reclassify", () => call(reclassifyRoute, "/api/admin/reclassify", {})],
  ])("refuses %s without a session", async (_, request) => {
    const res = await request();
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unauthorised" });
  });

  it("issues an HTTP-only, strict session cookie for the right password only", async () => {
    const wrong = await call(loginRoute, "/api/admin/login", { password: "guess" });
    expect(wrong).toMatchObject({ status: 401, json: { error: "Incorrect password" } });
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const right = await call(loginRoute, "/api/admin/login", { password: "integration-password" });
    expect(right.status).toBe(200);
    const cookie = right.headers.get("set-cookie")!;
    expect(cookie).toMatch(/sp_admin=[0-9a-f]{64}/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    expect(cookie).toMatch(/Max-Age=43200/);
  });

  it("clears the session cookie on logout", async () => {
    const res = await logoutRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/sp_admin=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });

  it("shows live results to a signed-in retailer", async () => {
    await participate();
    await participate();
    await signIn();

    const res = await call(resultsRoute, "/api/results");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ started: 2, completed: 2, experiment: { version: "v1" } });
    expect(res.json.fulfilment.pending).toHaveLength(2);

    expect((await call(resultsRoute, "/api/results?version=v999")).status).toBe(404);
  });

  it("exports anonymised CSV with a download filename", async () => {
    await participate('He said "cheaper", then =HYPERLINK()');
    await signIn();

    const res = await call(exportRoute, "/api/admin/export?table=stated");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="switchpoint-v1-stated.csv"');
    const [header, row] = res.text.split("\n");
    expect(header.split(",")[0]).toBe("participant_id");
    expect(row).toContain('"He said ""cheaper"", then =HYPERLINK()"');

    expect((await call(exportRoute, "/api/admin/export?table=participants")).status).toBe(400);
  });

  it("overrides a category and marks a reward handed over", async () => {
    const { participant } = await participate();
    await signIn();

    expect((await call(overrideRoute, "/api/admin/override", { participantId: participant.participantId, category: "habit" })).status).toBe(200);
    expect((await call(fulfilRoute, "/api/admin/fulfil", { participantId: participant.participantId })).status).toBe(200);

    const results = await call(resultsRoute, "/api/results");
    expect(results.json.reasons[0].overrideCategory).toBe("habit");
    expect(results.json.fulfilment).toMatchObject({ fulfilled: 1, pending: [] });
  });

  it("returns a failed insight, not an error, when the AI provider fails", async () => {
    await participate();
    await signIn();

    const res = await call(insightRoute, "/api/admin/insight", {});
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: "failed", suggestion: null });
  });

  it("queues reclassification of failed reasons", async () => {
    await participate();
    ctx.t.store.reasons.forEach((r) => (r.aiStatus = "failed"));
    await signIn();

    const res = await call(reclassifyRoute, "/api/admin/reclassify", {});
    expect(res).toMatchObject({ status: 200, json: { queued: 1 } });
    await ctx.t.flushDeferred();
    expect([...ctx.t.store.reasons.values()][0].aiStatus).toBe("done");
  });

  it("rate limits password guesses", async () => {
    for (let i = 0; i < 5; i++) await call(loginRoute, "/api/admin/login", { password: "guess" });
    expect((await call(loginRoute, "/api/admin/login", { password: "integration-password" })).status).toBe(429);
  });
});
