import { describe, expect, it } from "vitest";
import { gbp, interval, pct, signedGbp } from "./format";

describe("dashboard formatting", () => {
  it("formats rates and money", () => {
    expect(pct(0.426)).toBe("43%");
    expect(pct(null)).toBe("–");
    expect(gbp(0.5)).toBe("£0.50");
  });
  it("never shows a negative zero", () => {
    expect(signedGbp(-0.001)).toBe("£0.00");
    expect(signedGbp(0.25)).toBe("+£0.25");
    expect(signedGbp(-0.25)).toBe("−£0.25");
  });
  it("describes intervals", () => {
    expect(interval([0.1, 0.3], pct)).toBe("95% interval 10% to 30%");
    expect(interval(null, pct)).toBe("no interval yet");
  });
});
