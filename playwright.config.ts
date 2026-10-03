import { defineConfig } from "@playwright/test";
import { ADMIN_PASSWORD, PORT } from "./e2e/env";

/**
 * End-to-end tests drive the real app in Chrome against `next dev` with
 * in-memory adapters (SWITCHPOINT_IN_MEMORY), so no Supabase project or
 * Groq key is needed and no real data is written. Values set here take
 * precedence over .env.local.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  // One server-side store is shared by every test, so run them one at a time.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the installed Google Chrome; on CI run `npx playwright install chrome` first.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /admin\.setup\.ts/ },
    { name: "e2e", dependencies: ["setup"] },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/experiment`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      SWITCHPOINT_IN_MEMORY: "1",
      ADMIN_PASSWORD,
      SUPABASE_SERVICE_ROLE_KEY: "e2e-rate-limit-secret",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      GROQ_API_KEY: "",
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    },
  },
});
