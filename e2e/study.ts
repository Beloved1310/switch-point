import { expect, type Page } from "@playwright/test";

/** The current step heading plus progress label; it changes on every step transition. */
const stepSignature = (page: Page) =>
  page.evaluate(() => {
    const heading = document.querySelector("main h1")?.textContent ?? "";
    const progress = document.querySelector("[aria-label$='choices made']")?.getAttribute("aria-label") ?? "";
    return `${heading}|${progress}`;
  });

export const currentHeading = (page: Page) => page.locator("main h1").textContent();

/** Perform one action and wait for the next step to render. */
async function advance(page: Page, action: () => Promise<void>) {
  const before = await stepSignature(page);
  await action();
  await expect.poll(() => stepSignature(page), { timeout: 15_000 }).not.toBe(before);
}

/** Answer whatever step is showing. Returns false once the study is finished. */
export async function answerStep(page: Page, reasonText: string): Promise<boolean> {
  const heading = await currentHeading(page);
  const products = page.getByRole("button", { name: /^Choose / });
  switch (heading) {
    case "Before you start":
      await advance(page, () => page.getByRole("button", { name: "I agree, start" }).click());
      return true;
    case "Which would you buy?":
      await advance(page, () => products.first().click());
      return true;
    case "Which would you buy now?":
      await advance(page, () => products.last().click());
      return true;
    case "In your own words":
      await page.getByLabel(/What would make you switch/).fill(reasonText);
      await page.getByLabel(/How much cheaper/).fill("0.50");
      await advance(page, () => page.getByRole("button", { name: "Continue" }).click());
      return true;
    case "Thank you":
      return false;
    default:
      throw new Error(`Unexpected step: ${heading}`);
  }
}

/** Take part from the consent screen to the end. Returns the reward code shown. */
export async function completeStudy(page: Page, reasonText: string): Promise<{ code: string; product: string }> {
  await page.goto("/experiment");
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  for (let i = 0; i < 20 && (await answerStep(page, reasonText)); i++);
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();

  const reward = page.locator("section", { hasText: "The round drawn for you gives you" });
  const code = (await reward.locator(".tabular").textContent())!.trim();
  const product = (await reward.locator("p.text-xl").textContent())!.trim();
  return { code, product };
}

export const uniqueReason = (label: string) => `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
