import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE, checkPassword, isAdmin, requireAdmin } from "./auth";

const jar = new Map<string, string>();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

beforeEach(() => {
  jar.clear();
  vi.stubEnv("ADMIN_PASSWORD", "correct horse");
});
afterEach(() => vi.unstubAllEnvs());

describe("checkPassword", () => {
  it("returns a session token for the right password", () => {
    const token = checkPassword("correct horse");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toContain("correct horse");
  });

  it("returns null for a wrong or differently sized password", () => {
    expect(checkPassword("correct horsf")).toBeNull();
    expect(checkPassword("correct")).toBeNull();
  });

  it("refuses every password when none is configured", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(checkPassword("")).toBeNull();
    expect(checkPassword("anything")).toBeNull();
  });

  it("changes the token when the password changes, ending old sessions", () => {
    const before = checkPassword("correct horse");
    vi.stubEnv("ADMIN_PASSWORD", "battery staple");
    expect(checkPassword("battery staple")).not.toBe(before);
  });
});

describe("isAdmin / requireAdmin", () => {
  it("accepts the session cookie issued at login", async () => {
    jar.set(ADMIN_COOKIE, checkPassword("correct horse")!);
    expect(await isAdmin()).toBe(true);
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it("rejects a missing or forged cookie", async () => {
    expect(await isAdmin()).toBe(false);
    jar.set(ADMIN_COOKIE, "0".repeat(64));
    expect(await isAdmin()).toBe(false);
    await expect(requireAdmin()).rejects.toMatchObject({ kind: "unauthorised" });
  });

  it("rejects an old cookie after the password is rotated", async () => {
    jar.set(ADMIN_COOKIE, checkPassword("correct horse")!);
    vi.stubEnv("ADMIN_PASSWORD", "battery staple");
    expect(await isAdmin()).toBe(false);
  });

  it("rejects everyone when no password is configured", async () => {
    jar.set(ADMIN_COOKIE, checkPassword("correct horse")!);
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(await isAdmin()).toBe(false);
  });
});
