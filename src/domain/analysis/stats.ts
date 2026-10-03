/** Deterministic PRNG so bootstrap intervals are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type Interval = [number, number];

/**
 * Percentile bootstrap interval for any statistic of a sample.
 * Returns null when there is no data.
 */
export function bootstrapInterval(
  sample: number[],
  statistic: (xs: number[]) => number | null,
  { iterations = 2000, level = 0.95, seed = 1 } = {},
): Interval | null {
  if (sample.length === 0) return null;
  const random = mulberry32(seed);
  const stats: number[] = [];
  const resample = new Array<number>(sample.length);
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < sample.length; j++) {
      resample[j] = sample[Math.floor(random() * sample.length)];
    }
    const v = statistic(resample);
    if (v !== null && !Number.isNaN(v)) stats.push(v);
  }
  if (stats.length === 0) return null;
  stats.sort((a, b) => a - b);
  const alpha = (1 - level) / 2;
  return [quantile(stats, alpha), quantile(stats, 1 - alpha)];
}
