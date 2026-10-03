import { describe, expect, it } from "vitest";
import { activeExperiment } from "@/config/experiments";
import { ensureRegistered, requireParticipant, resolveExperiment } from "./experiments";
import { startParticipant } from "./participant/startParticipant";
import { createTestDeps } from "./testing/inMemory";

describe("ensureRegistered", () => {
  it("registers a version on first use", async () => {
    const { deps, store } = createTestDeps();
    await ensureRegistered(deps, activeExperiment());
    expect(store.fingerprints.get(activeExperiment().version)).toBeTruthy();
  });

  it("accepts an unchanged config that was registered earlier", async () => {
    const { deps, store } = createTestDeps();
    const config = activeExperiment();
    store.fingerprints.set(config.version, deps.runtime.fingerprint(JSON.stringify(config)));
    await expect(ensureRegistered(deps, config)).resolves.toBeUndefined();
  });

  it("refuses a config that changed under an existing version", async () => {
    const { deps, store } = createTestDeps();
    store.fingerprints.set(activeExperiment().version, "fingerprint-of-an-older-config");
    await expect(ensureRegistered(deps, activeExperiment())).rejects.toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("Publish it as a new version"),
    });
  });

  it("blocks new participants while the config mismatch stands", async () => {
    const { deps, store } = createTestDeps();
    store.fingerprints.set(activeExperiment().version, "fingerprint-of-an-older-config");
    await expect(startParticipant(deps)).rejects.toMatchObject({ kind: "unavailable" });
    expect(store.participants.size).toBe(0);
  });
});

describe("resolveExperiment", () => {
  it("defaults to the active experiment", () => {
    expect(resolveExperiment()).toBe(activeExperiment());
  });

  it("finds a registered version and rejects an unknown one", () => {
    expect(resolveExperiment("v1").version).toBe("v1");
    expect(() => resolveExperiment("v999")).toThrow(expect.objectContaining({ kind: "not_found" }));
  });
});

describe("requireParticipant", () => {
  it("returns the participant with the config they enrolled in", async () => {
    const { deps } = createTestDeps();
    const { participantId } = await startParticipant(deps);
    const { participant, config } = await requireParticipant(deps, participantId);
    expect(participant.id).toBe(participantId);
    expect(config.version).toBe(activeExperiment().version);
  });

  it("rejects an unknown participant", async () => {
    const { deps } = createTestDeps();
    await expect(requireParticipant(deps, "00000000-0000-4000-8000-999999999999")).rejects.toMatchObject({
      kind: "not_found",
    });
  });

  it("rejects a participant whose experiment version is no longer registered", async () => {
    const { deps, store } = createTestDeps();
    const { participantId } = await startParticipant(deps);
    store.participants.get(participantId)!.experimentVersion = "retired";
    await expect(requireParticipant(deps, participantId)).rejects.toMatchObject({ kind: "not_found" });
  });
});
