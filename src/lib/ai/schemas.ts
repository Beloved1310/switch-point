import { z } from "zod";
import { REASON_CATEGORIES } from "../experiment/types";

export const classificationSchema = z.object({
  category: z.enum(REASON_CATEGORIES),
  confidence: z.enum(["low", "medium", "high"]),
});
export type Classification = z.infer<typeof classificationSchema>;

export const classificationJsonSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: [...REASON_CATEGORIES] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["category", "confidence"],
  additionalProperties: false,
};

export const suggestionSchema = z.object({
  title: z.string().min(1).max(120),
  hypothesis: z.string().min(1).max(400),
  rationale: z.string().min(1).max(800),
  lever: z.enum(["price", "promotion", "trust"]),
  proposed_conditions: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        price_discount_gbp: z.number().min(0).max(5),
        promotion: z.string().max(60).nullable(),
        trust_badge: z.string().max(60).nullable(),
      }),
    )
    .min(1)
    .max(5),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

export const suggestionJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    hypothesis: { type: "string" },
    rationale: { type: "string" },
    lever: { type: "string", enum: ["price", "promotion", "trust"] },
    proposed_conditions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          price_discount_gbp: { type: "number" },
          promotion: { type: ["string", "null"] },
          trust_badge: { type: ["string", "null"] },
        },
        required: ["label", "price_discount_gbp", "promotion", "trust_badge"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "hypothesis", "rationale", "lever", "proposed_conditions"],
  additionalProperties: false,
};
