import { describe, expect, it } from "vitest";
import type { ExportRow } from "../ports";
import { createTestDeps } from "../testing/inMemory";
import { runParticipant } from "../testing/participants";
import { EXPORT_COLUMNS, exportResponses } from "./exportResponses";

describe("exportResponses", () => {
  it("names the file after the version and table", async () => {
    const { deps } = createTestDeps();
    expect((await exportResponses(deps, { table: "choices" })).filename).toBe("switchpoint-v1-choices.csv");
    expect((await exportResponses(deps, { table: "stated", version: "v1-synthetic-demo" })).filename).toBe(
      "switchpoint-v1-synthetic-demo-stated.csv",
    );
  });

  it("passes the export columns to the repository and returns its rows", async () => {
    const { deps } = createTestDeps();
    const asked: (readonly string[])[] = [];
    const rows: ExportRow[] = [{ participant_id: "p1" }];
    deps.choices.exportRows = async (_version, columns) => {
      asked.push(columns);
      return rows;
    };

    const result = await exportResponses(deps, { table: "choices" });
    expect(asked).toEqual([EXPORT_COLUMNS.choices]);
    expect(result.columns).toBe(EXPORT_COLUMNS.choices);
    expect(result.rows).toBe(rows);
  });

  it("exports only the requested version", async () => {
    const { deps } = createTestDeps();
    await runParticipant(deps);

    expect((await exportResponses(deps, { table: "stated" })).rows).toHaveLength(1);
    expect((await exportResponses(deps, { table: "stated", version: "v1-synthetic-demo" })).rows).toHaveLength(0);
  });

  it("never exports identifying columns", () => {
    for (const columns of Object.values(EXPORT_COLUMNS)) {
      for (const banned of ["ip", "email", "name", "rate_limit_key"]) expect(columns).not.toContain(banned);
    }
  });

  it("rejects an unknown version", async () => {
    const { deps } = createTestDeps();
    await expect(exportResponses(deps, { table: "choices", version: "v999" })).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});
