import { describe, expect, it } from "vitest";
import { afterBaseline, afterChoice, afterStated, choicesMade } from "./flow";

describe("participant flow", () => {
  it("say-first: baseline → stated → choices → complete", () => {
    expect(afterBaseline(true)).toEqual({ kind: "stated" });
    expect(afterStated(true)).toEqual({ kind: "choice", index: 0 });
    expect(afterChoice(0, 3, true)).toEqual({ kind: "choice", index: 1 });
    expect(afterChoice(2, 3, true)).toEqual({ kind: "complete" });
  });

  it("do-first: baseline → choices → stated → complete", () => {
    expect(afterBaseline(false)).toEqual({ kind: "choice", index: 0 });
    expect(afterChoice(2, 3, false)).toEqual({ kind: "stated" });
    expect(afterStated(false)).toEqual({ kind: "complete" });
  });

  it("reports progress", () => {
    expect(choicesMade({ kind: "baseline" }, true, 8)).toBe(0);
    expect(choicesMade({ kind: "choice", index: 2 }, true, 8)).toBe(3);
    expect(choicesMade({ kind: "stated" }, true, 8)).toBe(1);
    expect(choicesMade({ kind: "stated" }, false, 8)).toBe(8);
    expect(choicesMade({ kind: "consent" }, false, 8)).toBeNull();
  });
});
