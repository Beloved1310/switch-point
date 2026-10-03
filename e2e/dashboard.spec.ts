import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "./env";
import { completeStudy, uniqueReason } from "./study";

test.describe("signed out", () => {
  test("sends visitors to the login page and rejects a wrong password", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("Incorrect password");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("keeps the results API closed", async ({ request }) => {
    const res = await request.get("/api/results");
    expect(res.status()).toBe(401);
    expect((await request.get("/api/admin/export?table=choices&version=v1")).status()).toBe(401);
  });
});

test.describe("retailer dashboard", () => {
  test.use({ storageState: ADMIN_STATE });

  const finishedNote = /(\d+) finished out of (\d+) started/;

  test("counts a new participant and lists their reward", async ({ page, browser }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Ground coffee, 227g" })).toBeVisible();
    const [, finishedBefore, startedBefore] = (await page.getByText(finishedNote).textContent())!.match(finishedNote)!;

    // A shopper takes part on their own device.
    const shopper = await browser.newContext({ storageState: undefined });
    const { code, product } = await completeStudy(await shopper.newPage(), uniqueReason("Dashboard count"));
    await shopper.close();

    await page.reload();
    await expect(page.getByText(`${Number(finishedBefore) + 1} finished out of ${Number(startedBefore) + 1} started`)).toBeVisible();

    await page.getByRole("tab", { name: /Rewards/ }).click();
    await expect(page).toHaveURL(/#rewards$/);
    const row = page.getByRole("listitem").filter({ hasText: code });
    await expect(row).toContainText(product);

    await row.getByRole("button", { name: "Mark handed over" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: code })).toHaveCount(0);
  });

  test("shows a participant's reason and exports it as CSV", async ({ page, browser }) => {
    const reason = uniqueReason("Exported reason, with a comma");
    const shopper = await browser.newContext({ storageState: undefined });
    await completeStudy(await shopper.newPage(), reason);
    await shopper.close();

    await page.goto("/dashboard#reasons");
    await expect(page.getByRole("tab", { name: /Reasons/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(reason)).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Stated reasons CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("switchpoint-v1-stated.csv");

    const csv = await (await page.request.get("/api/admin/export?table=stated&version=v1")).text();
    expect(csv.split("\n")[0]).toBe(
      "participant_id,experiment_version,phase,reason_text,stated_price_threshold,ai_status,ai_category,ai_confidence,ai_model,override_category,created_at",
    );
    expect(csv).toContain(`"${reason}"`);
  });

  test("moves between dashboard tabs", async ({ page }) => {
    await page.goto("/dashboard");
    for (const name of ["What shoppers did", "Say vs do", "Reasons", "Summary"]) {
      const tab = page.getByRole("tab", { name: new RegExp(`^${name}`) });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });

  test("signs out", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
