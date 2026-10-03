import { describe, expect, it } from "vitest";
import { bootstrapInterval, mean, mulberry32, quantile } from "./stats";

describe("mulberry32", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it("gives different sequences for different seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("stays within [0, 1)", () => {
    const random = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const x = random();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("mean", () => {
  it("averages values and is NaN for no data", () => {
    expect(mean([1, 2, 3, 6])).toBe(3);
    expect(mean([])).toBeNaN();
  });
});

describe("quantile", () => {
  it("interpolates linearly between sorted values", () => {
    expect(quantile([0, 10], 0.25)).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
  });

  it("is NaN for no data", () => {
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe("bootstrapInterval", () => {
  it("returns null when there is no sample", () => {
    expect(bootstrapInterval([], mean)).toBeNull();
  });

  it("returns null when the statistic is never defined", () => {
    expect(bootstrapInterval([1, 2, 3], () => null, { iterations: 50 })).toBeNull();
  });

  it("narrows as the confidence level drops", () => {
    const sample = [0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0];
    const wide = bootstrapInterval(sample, mean, { level: 0.95 })!;
    const narrow = bootstrapInterval(sample, mean, { level: 0.5 })!;
    expect(narrow[0]).toBeGreaterThanOrEqual(wide[0]);
    expect(narrow[1]).toBeLessThanOrEqual(wide[1]);
  });

  it("changes with the seed but is stable for a given seed", () => {
    const sample = [0, 1, 0, 1, 1, 0, 0, 1, 1, 1];
    expect(bootstrapInterval(sample, mean, { seed: 5 })).toEqual(bootstrapInterval(sample, mean, { seed: 5 }));
  });
});
