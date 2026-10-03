import { describe, expect, it } from "vitest";
import { claimCode, drawFulfilmentChoice } from "./fulfilment";

describe("claimCode", () => {
  it("uses the first six characters of the participant ID, upper-cased", () => {
    expect(claimCode("3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe("3FA85F");
  });
});

describe("drawFulfilmentChoice", () => {
  const choices = ["a", "b", "c"];

  it("returns the choice at the drawn index", () => {
    expect(drawFulfilmentChoice(choices, () => 0)).toBe("a");
    expect(drawFulfilmentChoice(choices, () => 2)).toBe("c");
  });

  it("asks for an index over exactly the eligible choices", () => {
    const asked: number[] = [];
    drawFulfilmentChoice(choices, (n) => {
      asked.push(n);
      return 0;
    });
    expect(asked).toEqual([3]);
  });

  it("refuses to draw from no choices", () => {
    expect(() => drawFulfilmentChoice([], () => 0)).toThrow("No eligible choices");
  });
});
