import "server-only";
import Groq from "groq-sdk";
import type { z } from "zod";

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

let client: Groq | null = null;

export const groqConfigured = () => Boolean(process.env.GROQ_API_KEY);

function groq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return (client ??= new Groq({ apiKey, timeout: 15_000, maxRetries: 1 }));
}

/**
 * One structured-output completion. The JSON schema constrains generation;
 * the Zod schema validates the result before anyone uses it (NFR14).
 */
export async function structuredCompletion<T>(opts: {
  name: string;
  jsonSchema: object;
  schema: z.ZodType<T>;
  system: string;
  user: string;
}): Promise<T> {
  const res = await groq().chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.name, schema: opts.jsonSchema as Record<string, unknown>, strict: true },
    },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return opts.schema.parse(JSON.parse(content));
}
