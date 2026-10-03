/** Short code a participant shows to collect their product. */
export const claimCode = (participantId: string) => participantId.slice(0, 6).toUpperCase();

/**
 * Draw the round whose choice is honoured: uniform over controlled choices (FR23).
 * `randomInt(n)` must return an integer in [0, n).
 */
export function drawFulfilmentChoice<T>(controlledChoices: T[], randomInt: (n: number) => number): T {
  if (controlledChoices.length === 0) throw new Error("No eligible choices");
  return controlledChoices[randomInt(controlledChoices.length)];
}
