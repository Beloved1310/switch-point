import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain values unquoted", () => {
    expect(csvCell("Hearth Roast")).toBe("Hearth Roast");
    expect(csvCell(0.5)).toBe("0.5");
    expect(csvCell(false)).toBe("false");
  });

  it("writes missing values as empty cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("cheaper, maybe")).toBe('"cheaper, maybe"');
    expect(csvCell('say "cheaper"')).toBe('"say ""cheaper"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("serialises objects and arrays as JSON", () => {
    expect(csvCell(["price", "promotion"])).toBe('"[""price"",""promotion""]"');
    expect(csvCell({ priceDiscount: 0.2 })).toBe('"{""priceDiscount"":0.2}"');
  });

  it.each(["=SUM(A1)", "+1", "-1", "@cmd"])("neutralises a spreadsheet formula in %s", (value) => {
    expect(csvCell(value).replace(/^"|"$/g, "")).toBe(`'${value}`);
  });
});

describe("toCsv", () => {
  it("writes a header row and one line per row, in column order", () => {
    const csv = toCsv(["b", "a"], [
      { a: 1, b: "x" },
      { a: 2, b: null, extra: "ignored" },
    ]);
    expect(csv).toBe("b,a\nx,1\n,2");
  });

  it("writes only the header when there are no rows", () => {
    expect(toCsv(["participant_id"], [])).toBe("participant_id");
  });
});
