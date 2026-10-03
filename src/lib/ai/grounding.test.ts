import { describe, expect, it } from "vitest";
import { extractNumbers, ungroundedNumbers } from "./grounding";

const evidence = {
  participants: 24,
  conditions: [{ label: "£0.50 cheaper", switch_rate_pct: 42, price_discount_gbp: 0.5 }],
  median_gbp: 1,
};

describe("extractNumbers", () => {
  it("finds integers, decimals, currency and percentages", () => {
    expect(extractNumbers("42% switched at £0.50; 1,200 shoppers")).toEqual([42, 0.5, 1200]);
  });
  it("skips identifiers glued to letters", () => {
    expect(extractNumbers("experiment v1 and SKU A12")).toEqual([]);
  });
});

describe("ungroundedNumbers", () => {
  it("accepts text whose numbers all appear in the packet", () => {
    expect(ungroundedNumbers(["42% of 24 shoppers switched at £0.50"], evidence)).toEqual([]);
    expect(ungroundedNumbers(["A £1.00 cut is the median"], evidence)).toEqual([]);
  });
  it("rejects invented numbers", () => {
    expect(ungroundedNumbers(["Switching rose 65% at £0.75"], evidence)).toEqual([65, 0.75]);
  });
  it("accepts text without numbers", () => {
    expect(ungroundedNumbers(["Promotions look stronger than trust badges."], evidence)).toEqual([]);
  });
});
