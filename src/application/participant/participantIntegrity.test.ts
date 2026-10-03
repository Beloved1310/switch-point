import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASELINE_SCENARIO_ID } from "@/domain/experiment/types";
import { createTestDeps } from "../testing/inMemory";
import { completeParticipant } from "./completeParticipant";
import { recordChoice } from "./recordChoice";
import { startParticipant } from "./startParticipant";
import { submitStatedReason } from "./submitStatedReason";

describe("participant response integrity", () => {
  it("rejects a choice for a scenario outside the stored plan", async () => {
    const { deps, store } = createTestDeps();
    const participant = await startParticipant(deps);

    await expect(
      recordChoice(deps, {
        participantId: participant.participantId,
        scenarioId: "client-added-scenario",
        side: "left",
      }),
    ).rejects.toMatchObject({ kind: "invalid", message: "Scenario not in plan" });
    expect(store.choices).toHaveLength(0);
  });

  it("keeps a repeated baseline submission idempotent and uses the stored answer", async () => {
    const { deps, store, flushDeferred } = createTestDeps();
    const participant = await startParticipant(deps);
    const first = await recordChoice(deps, {
      participantId: participant.participantId,
      scenarioId: BASELINE_SCENARIO_ID,
      side: "left",
    });
    const retry = await recordChoice(deps, {
      participantId: participant.participantId,
      scenarioId: BASELINE_SCENARIO_ID,
      side: "right",
    });

    expect(store.choices).toHaveLength(1);
    expect(store.choices[0].chosenSide).toBe("left");
    expect(retry).toEqual(first);
    await flushDeferred();
    expect(store.notifications).toEqual(["choice"]);
  });

  it("does not complete until every planned scenario and a stated reason are stored", async () => {
    const { deps, store } = createTestDeps();
    const participant = await startParticipant(deps);
    await recordChoice(deps, {
      participantId: participant.participantId,
      scenarioId: BASELINE_SCENARIO_ID,
      side: "left",
    });
    await submitStatedReason(deps, {
      participantId: participant.participantId,
      reasonText: "I would switch for a lower price.",
      statedPriceThreshold: 0.5,
    });

    await expect(completeParticipant(deps, { participantId: participant.participantId }))
      .rejects.toMatchObject({ kind: "conflict", message: "Experiment not finished" });
    expect(store.participants.get(participant.participantId)?.completedAt).toBeNull();
    expect(store.fulfilments.has(participant.participantId)).toBe(false);
  });

  it("completes the full flow and returns the same fulfilment on retry", async () => {
    const { deps, store } = createTestDeps();
    const participant = await startParticipant(deps);
    const baseline = await recordChoice(deps, {
      participantId: participant.participantId,
      scenarioId: BASELINE_SCENARIO_ID,
      side: "left",
    });
    if (!baseline.screens) throw new Error("Expected planned screens after baseline");

    await submitStatedReason(deps, {
      participantId: participant.participantId,
      reasonText: "I would switch for a lower price.",
      statedPriceThreshold: 0.5,
    });
    for (const screen of baseline.screens) {
      await recordChoice(deps, {
        participantId: participant.participantId,
        scenarioId: screen.scenarioId,
        side: "right",
      });
    }

    const first = await completeParticipant(deps, { participantId: participant.participantId });
    const retry = await completeParticipant(deps, { participantId: participant.participantId });
    expect(store.participants.get(participant.participantId)?.completedAt).toBeTruthy();
    expect(store.fulfilments.size).toBe(1);
    expect(first.reward).toEqual(retry.reward);
  });
});

describe("public database write boundary migration", () => {
  it("removes anonymous response insert policies and grants", () => {
    const migration = readFileSync(
      new URL("../../../supabase/migrations/0003_server_only_response_writes.sql", import.meta.url),
      "utf8",
    ).toLowerCase();

    expect(migration).toContain('drop policy if exists "public insert participants" on participants');
    expect(migration).toContain('drop policy if exists "public insert choices" on choices');
    expect(migration).toContain('drop policy if exists "public insert stated reasons" on stated_reasons');
    expect(migration).toMatch(/revoke\s+insert\s+on\s+participants,\s*choices,\s*stated_reasons\s+from\s+public,\s*anon,\s*authenticated/);
    expect(migration).toContain("drop function if exists participant_exists(uuid)");
  });
});

// Run against a disposable Supabase project by setting both values in the test
// environment. Minimal requests must fail with a database permission response.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const liveDb = supabaseUrl && anonKey ? describe : describe.skip;

liveDb("live anonymous Supabase permissions", () => {
  it.each(["participants", "choices", "stated_reasons"])(
    "denies anonymous inserts into %s",
    async (table) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: anonKey!,
          authorization: `Bearer ${anonKey}`,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({}),
      });

      expect([401, 403]).toContain(response.status);
    },
  );
});
