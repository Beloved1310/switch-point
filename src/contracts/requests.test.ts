import { describe, expect, it } from "vitest";
import {
  exportQuery,
  loginRequest,
  overrideCategoryRequest,
  participantRequest,
  recordChoiceRequest,
  submitStatedRequest,
} from "./requests";

const participantId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("recordChoiceRequest", () => {
  it("accepts a participant, scenario and side", () => {
    expect(recordChoiceRequest.safeParse({ participantId, scenarioId: "price_050", side: "left" }).success).toBe(true);
  });

  it.each([
    ["a non-UUID participant", { participantId: "123", scenarioId: "baseline", side: "left" }],
    ["an unknown side", { participantId, scenarioId: "baseline", side: "middle" }],
    ["an empty scenario", { participantId, scenarioId: "", side: "left" }],
    ["an over-long scenario", { participantId, scenarioId: "x".repeat(41), side: "left" }],
  ])("rejects %s", (_, body) => {
    expect(recordChoiceRequest.safeParse(body).success).toBe(false);
  });

  it("drops fields the client should not control, such as product or price", () => {
    const parsed = recordChoiceRequest.parse({
      participantId,
      scenarioId: "baseline",
      side: "left",
      chosenProduct: "B",
      price: 0,
    });
    expect(parsed).toEqual({ participantId, scenarioId: "baseline", side: "left" });
  });
});

describe("submitStatedRequest", () => {
  const valid = { participantId, reasonText: "Cheaper", statedPriceThreshold: 0.5 };

  it("trims the reason and accepts a null threshold", () => {
    const parsed = submitStatedRequest.parse({ ...valid, reasonText: "  Cheaper  ", statedPriceThreshold: null });
    expect(parsed.reasonText).toBe("Cheaper");
    expect(parsed.statedPriceThreshold).toBeNull();
  });

  it.each([
    ["a blank reason", { ...valid, reasonText: "   " }],
    ["a reason over 500 characters", { ...valid, reasonText: "x".repeat(501) }],
    ["a negative threshold", { ...valid, statedPriceThreshold: -0.01 }],
    ["a threshold over £100", { ...valid, statedPriceThreshold: 100.01 }],
    ["a threshold below a penny", { ...valid, statedPriceThreshold: 0.505 }],
    ["a missing threshold", { participantId, reasonText: "Cheaper" }],
  ])("rejects %s", (_, body) => {
    expect(submitStatedRequest.safeParse(body).success).toBe(false);
  });
});

describe("overrideCategoryRequest", () => {
  it("accepts a known category or null to clear the override", () => {
    expect(overrideCategoryRequest.safeParse({ participantId, category: "trust" }).success).toBe(true);
    expect(overrideCategoryRequest.safeParse({ participantId, category: null }).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(overrideCategoryRequest.safeParse({ participantId, category: "colour" }).success).toBe(false);
  });
});

describe("other requests", () => {
  it("requires a UUID participant", () => {
    expect(participantRequest.safeParse({ participantId }).success).toBe(true);
    expect(participantRequest.safeParse({}).success).toBe(false);
  });

  it("requires a non-empty, bounded password", () => {
    expect(loginRequest.safeParse({ password: "" }).success).toBe(false);
    expect(loginRequest.safeParse({ password: "x".repeat(201) }).success).toBe(false);
    expect(loginRequest.safeParse({ password: "secret" }).success).toBe(true);
  });

  it("accepts only known export tables, with an optional version", () => {
    expect(exportQuery.safeParse({ table: "choices" }).success).toBe(true);
    expect(exportQuery.safeParse({ table: "stated", version: "v1" }).success).toBe(true);
    expect(exportQuery.safeParse({ table: "participants" }).success).toBe(false);
  });
});
