import { z } from "zod";
import { REASON_CATEGORIES } from "@/domain/experiment/types";

/** Request bodies accepted by the API. Validated at the HTTP boundary. */

export const recordChoiceRequest = z.object({
  participantId: z.uuid(),
  scenarioId: z.string().min(1).max(40),
  side: z.enum(["left", "right"]),
});
export type RecordChoiceRequest = z.infer<typeof recordChoiceRequest>;

export const submitStatedRequest = z.object({
  participantId: z.uuid(),
  reasonText: z.string().trim().min(1).max(500),
  statedPriceThreshold: z.number().min(0).max(100).multipleOf(0.01).nullable(),
});
export type SubmitStatedRequest = z.infer<typeof submitStatedRequest>;

export const participantRequest = z.object({ participantId: z.uuid() });
export type ParticipantRequest = z.infer<typeof participantRequest>;

export const overrideCategoryRequest = z.object({
  participantId: z.uuid(),
  category: z.enum(REASON_CATEGORIES).nullable(),
});
export type OverrideCategoryRequest = z.infer<typeof overrideCategoryRequest>;

export const loginRequest = z.object({ password: z.string().min(1).max(200) });

export const versionQuery = z.string().min(1).max(40).optional();

export const exportQuery = z.object({
  table: z.enum(["choices", "stated"]),
  version: versionQuery,
});
export type ExportTable = z.infer<typeof exportQuery>["table"];
