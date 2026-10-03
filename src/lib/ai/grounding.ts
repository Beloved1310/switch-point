/** Collect every number in a JSON-like value. */
export function collectNumbers(value: unknown, out: Set<number> = new Set()): Set<number> {
  if (typeof value === "number" && Number.isFinite(value)) out.add(value);
  else if (typeof value === "string") for (const n of extractNumbers(value)) out.add(n);
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectNumbers(v, out));
  return out;
}

/**
 * Numbers written in text. Digits glued to letters (e.g. "v1", "A1") are
 * identifiers rather than quantities and are skipped; thousands separators
 * are removed.
 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/(?<![\p{L}\d.])\d[\d,]*(?:\.\d+)?(?![\p{L}\d])/gu) ?? [];
  return matches.map((m) => Number(m.replace(/,/g, ""))).filter(Number.isFinite);
}

/**
 * Return the numbers in `texts` that do not appear in the evidence packet.
 * An empty result means the text is grounded (FR21).
 */
export function ungroundedNumbers(texts: string[], evidence: unknown): number[] {
  const allowed = [...collectNumbers(evidence)];
  const bad = new Set<number>();
  for (const t of texts) {
    for (const n of extractNumbers(t)) {
      if (!allowed.some((a) => Math.abs(a - n) < 1e-9)) bad.add(n);
    }
  }
  return [...bad];
}
