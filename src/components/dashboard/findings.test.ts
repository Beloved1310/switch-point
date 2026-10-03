import { describe, expect, it } from "vitest";
import { coffeeV1 } from "@/config/experiments/coffee-v1";
import { analyze, type ChoiceRecord, type StatedRecord } from "@/domain/analysis/analyze";
import type { ProductId, ReasonCategory } from "@/domain/experiment/types";
import type { DashboardData } from "@/contracts/responses";
import { attentionItems, keyFindings } from "./findings";

/** One participant who prefers A and switches to B only in the listed scenarios. */
function participant(id: string, switchesIn: string[]): ChoiceRecord[] {
  const rows: ChoiceRecord[] = [
    { participantId: id, scenarioId: "baseline", chosenProduct: "A", chosenSide: "left", baselineProduct: null },
  ];
  coffeeV1.scenarios.forEach((s, i) => {
    const switched = switchesIn.includes(s.id);
    rows.push({
      participantId: id,
      scenarioId: s.id,
      chosenProduct: (switched ? "B" : "A") as ProductId,
      chosenSide: i % 2 === 0 ? "left" : "right",
      baselineProduct: "A",
    });
  });
  return rows;
}

function dashboard(
  people: { switchesIn: string[]; category: ReasonCategory | null; threshold: number | null }[],
  overrides: Partial<DashboardData> = {},
): DashboardData {
  const choices = people.flatMap((p, i) => participant(`p${i}`, p.switchesIn));
  const stated: StatedRecord[] = people.map((p, i) => ({
    participantId: `p${i}`,
    phase: "before",
    statedPriceThreshold: p.threshold,
    category: p.category,
  }));
  return {
    experiment: { version: "v1", category: coffeeV1.category, products: [] },
    versions: ["v1"],
    analysis: analyze(coffeeV1, choices, stated),
    reasons: [],
    started: people.length,
    completed: people.length,
    fulfilment: { enabled: false, rule: "", fulfilled: 0, pending: [] },
    insight: null,
    generatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("attentionItems", () => {
  it("asks for responses when nobody has started", () => {
    const items = attentionItems(dashboard([]));
    expect(items[0].title).toBe("No responses yet");
  });

  it("flags a small sample, unfinished people and pending rewards", () => {
    const data = dashboard(
      [{ switchesIn: [], category: "price", threshold: 1 }],
      {
        started: 10,
        completed: 1,
        fulfilment: { enabled: true, rule: "", fulfilled: 0, pending: [{ code: "ABC123", participantId: "p0", productName: "Ridgeline" }] },
      },
    );
    const titles = attentionItems(data).map((i) => i.title);
    expect(titles).toContain("Only 1 of the 30 people needed so far");
    expect(titles).toContain("9 of 10 people have not finished");
    expect(titles).toContain("1 reward waiting to be handed over");
  });
});

describe("keyFindings", () => {
  it("names the strongest and weakest offer", () => {
    const data = dashboard([
      { switchesIn: ["price_150", "trust_rating"], category: "price", threshold: 1 },
      { switchesIn: ["price_150"], category: "price", threshold: 1 },
    ]);
    const strongest = keyFindings(data).find((f) => f.label === "Strongest offer");
    expect(strongest?.headline).toBe("£1.50 cheaper made 100% of shoppers switch");
  });

  it("calls out when the stated reason is not what moved people", () => {
    const data = dashboard([
      { switchesIn: ["trust_rating"], category: "price", threshold: 1 },
      { switchesIn: ["trust_rating"], category: "price", threshold: 1 },
    ]);
    const sayDo = keyFindings(data).find((f) => f.label === "Say vs do");
    expect(sayDo?.headline).toBe("Shoppers say they care most about price, but trust badges moved more of them");
  });

  it("compares the stated and observed discount", () => {
    const data = dashboard([
      { switchesIn: ["price_050", "price_100", "price_150"], category: "price", threshold: 1.5 },
      { switchesIn: ["price_050", "price_100", "price_150"], category: "price", threshold: 1.5 },
    ]);
    const price = keyFindings(data).find((f) => f.label === "Price");
    expect(price?.headline).toBe("Shoppers switch for less than they think: £0.50 off, not £1.50");
  });
});
