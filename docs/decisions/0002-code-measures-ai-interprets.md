# 0002. Code measures, AI only interprets

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Retailers will act on the dashboard numbers. Language models invent plausible statistics, return malformed output, and go down or run out of quota. If AI sat in the path of measurement or data collection, any of those would corrupt results or block participants.

## Decision

**All measured results come from deterministic code.**
Switch rates, price switch points, say-do gaps and 95% bootstrap intervals are computed in [src/domain/analysis/](../../src/domain/analysis/), plain TypeScript with no AI, UI or database imports. The bootstrap uses a seeded PRNG so intervals don't change on refresh. Results from fewer than 30 participants are labelled directional. The module is tested with Vitest.

**AI never blocks or touches stored data.**
A stated reason is saved first with `ai_status = 'pending'`. Classification then runs after the response is sent (`after()`), and records `done`, `failed` or `skipped`. With no `GROQ_API_KEY`, AI steps are skipped and everything else works. The original text is always kept, and an admin can override the category.

**AI failures are recoverable and visible.**
Every handled AI failure is logged with its cause through `runtime.reportError`. From the dashboard, an admin can retry classification for reasons that are `failed`, `skipped`, or stuck in `pending` for over two minutes ([reclassifyReasons.ts](../../src/application/retailer/reclassifyReasons.ts)). A retry handles up to 50 reasons after the response is sent, and stops after 3 failures in a row, so a provider outage doesn't burn through the batch.

**AI output is constrained, validated and grounded.**
- Groq is called with strict JSON schema output and `temperature: 0`, and the result is parsed again with Zod before use ([client.ts](../../src/infrastructure/groq/client.ts)).
- The next-experiment advisor sees only an evidence packet built from the analysis ([evidence.ts](../../src/domain/insight/evidence.ts)), and runs only when a retailer asks.
- Every number in the suggestion is checked against the packet. If any number is not in it, the whole suggestion is suppressed ([grounding.ts](../../src/domain/insight/grounding.ts)).
- The dashboard labels measured results and AI output separately.

## Consequences

- The retailer never sees an AI-invented statistic, and the dashboard works fully without AI.
- Suggestions that do harmless arithmetic on packet numbers are also rejected; we accept false rejections over false numbers.
- AI cost is bounded: one classification per participant, plus explicit retailer requests.
