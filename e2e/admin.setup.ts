import { expect, test as setup } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_STATE } from "./env";

/** Sign in once and reuse the session, keeping under the login rate limit. */
setup("sign in as the retailer", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: ADMIN_STATE });
});
