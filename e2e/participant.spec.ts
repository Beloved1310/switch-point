import { expect, test } from "@playwright/test";
import { answerStep, completeStudy, currentHeading, uniqueReason } from "./study";

test.describe("participant journey", () => {
  test("takes part from consent to a reward code", async ({ page }) => {
    const seen = new Set<string>();
    await page.goto("/experiment");
    await expect(page.getByText("8 quick product choices")).toBeVisible();

    const reason = uniqueReason("Cheaper by fifty pence");
    let choices = 0;
    for (let i = 0; i < 20; i++) {
      const heading = (await currentHeading(page))!;
      seen.add(heading);
      if (heading.startsWith("Which would you buy")) choices++;
      if (!(await answerStep(page, reason))) break;
    }

    expect(choices).toBe(8);
    expect([...seen]).toEqual(expect.arrayContaining(["Which would you buy?", "In your own words", "Thank you"]));
    await expect(page.getByText("Your answers have been recorded.")).toBeVisible();
    await expect(page.getByText(/Show this code to collect it: [0-9A-F]{6}/)).toBeVisible();
  });

  test("shows the baseline products at the same price", async ({ page }) => {
    await page.goto("/experiment");
    await page.getByRole("button", { name: "I agree, start" }).click();
    await expect(page.getByRole("heading", { name: "Which would you buy?" })).toBeVisible();

    const products = page.getByRole("button", { name: /^Choose / });
    await expect(products).toHaveCount(2);
    await expect(products.first()).toHaveAccessibleName(/£4\.00/);
    await expect(products.last()).toHaveAccessibleName(/£4\.00/);
    await expect(page.getByLabel("0 of 8 choices made")).toBeVisible();
  });

  test("restores progress after a page refresh", async ({ page }) => {
    const reason = uniqueReason("Refresh then cheaper");
    await page.goto("/experiment");
    // Consent, baseline, then one more step.
    for (let i = 0; i < 3; i++) await answerStep(page, reason);
    const heading = await currentHeading(page);
    const progress = await page.locator("[aria-label$='choices made']").getAttribute("aria-label");

    await page.reload();
    await expect(page.getByRole("status")).toHaveText("Your saved progress has been restored.");
    await expect(page.locator("main h1")).toHaveText(heading!);
    await expect(page.locator("[aria-label$='choices made']")).toHaveAttribute("aria-label", progress!);

    for (let i = 0; i < 20 && (await answerStep(page, reason)); i++);
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
  });

  test("stops a participant from taking part twice in the same tab", async ({ page }) => {
    await completeStudy(page, uniqueReason("Once only"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "You have already taken part" })).toBeVisible();
    await expect(page.getByRole("button", { name: "I agree, start" })).toHaveCount(0);
  });

  test("keeps the continue button disabled until the stated step is answered", async ({ page }) => {
    await page.goto("/experiment");
    for (let i = 0; i < 20; i++) {
      if ((await currentHeading(page)) === "In your own words") break;
      await answerStep(page, "unused");
    }
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();

    await page.getByLabel(/What would make you switch/).fill("A better price");
    await expect(continueButton).toBeDisabled();
    await page.getByLabel("A lower price would not make me switch").check();
    await expect(page.getByLabel(/How much cheaper/)).toBeDisabled();
    await expect(continueButton).toBeEnabled();
  });
});
