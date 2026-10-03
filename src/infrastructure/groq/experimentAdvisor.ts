import "server-only";
import type { ExperimentAdvisor } from "@/application/ports";
import { GROQ_MODEL, groqConfigured, structuredCompletion } from "./client";
import { suggestionJsonSchema, suggestionSchema } from "./schemas";

const SYSTEM_PROMPT = [
  "You help a retailer choose the next A/B product-choice experiment.",
  "Use ONLY the evidence packet. Do not invent statistics.",
  "In title, hypothesis and rationale, any number you write must be copied exactly from the packet (percentages as whole numbers, prices in pounds as given). If unsure, write no number.",
  "If evidence_strength is directional, say the evidence is early and directional.",
  "proposed_conditions are design values for the new test and may use new prices.",
].join("\n");

export const groqExperimentAdvisor: ExperimentAdvisor = {
  model: GROQ_MODEL,
  isConfigured: groqConfigured,
  suggest: (evidence) =>
    structuredCompletion({
      name: "next_experiment",
      jsonSchema: suggestionJsonSchema,
      schema: suggestionSchema,
      system: SYSTEM_PROMPT,
      user: JSON.stringify(evidence),
    }),
};
