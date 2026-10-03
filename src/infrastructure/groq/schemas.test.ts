import { describe, expect, it } from "vitest";
import { REASON_CATEGORIES } from "@/domain/experiment/types";
import {
  classificationJsonSchema,
  classificationSchema,
  suggestionJsonSchema,
  suggestionSchema,
} from "./schemas";

const suggestion = {
  title: "Test a bigger promotion",
  hypothesis: "A larger free amount moves more shoppers.",
  rationale: "Promotions beat trust badges in this run.",
  lever: "promotion",
  proposed_conditions: [{ label: "30% extra free", price_discount_gbp: 0, promotion: "30% extra free", trust_badge: null }],
};

describe("classificationSchema", () => {
  it("accepts every known category and confidence", () => {
    for (const category of REASON_CATEGORIES) {
      expect(classificationSchema.safeParse({ category, confidence: "medium" }).success).toBe(true);
    }
  });

  it("rejects labels the model invents", () => {
    expect(classificationSchema.safeParse({ category: "packaging", confidence: "high" }).success).toBe(false);
    expect(classificationSchema.safeParse({ category: "price", confidence: "certain" }).success).toBe(false);
  });

  it("matches the categories sent to the model", () => {
    expect(classificationJsonSchema.properties.category.enum).toEqual([...REASON_CATEGORIES]);
  });
});

describe("suggestionSchema", () => {
  it("accepts a well-formed suggestion", () => {
    expect(suggestionSchema.safeParse(suggestion).success).toBe(true);
  });

  it.each([
    ["no proposed conditions", { ...suggestion, proposed_conditions: [] }],
    ["more than five conditions", { ...suggestion, proposed_conditions: Array(6).fill(suggestion.proposed_conditions[0]) }],
    ["an unknown lever", { ...suggestion, lever: "quality" }],
    ["an empty title", { ...suggestion, title: "" }],
    [
      "a discount above £5",
      { ...suggestion, proposed_conditions: [{ ...suggestion.proposed_conditions[0], price_discount_gbp: 6 }] },
    ],
  ])("rejects %s", (_, value) => {
    expect(suggestionSchema.safeParse(value).success).toBe(false);
  });

  it("requires the same fields the model is asked for", () => {
    expect([...suggestionJsonSchema.required].sort()).toEqual(Object.keys(suggestionSchema.shape).sort());
  });
});
