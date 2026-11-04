import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/standalone-reference/**",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:4320",
    trace: "retain-on-failure",
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium" ? "chromium" : undefined,
  },
  webServer: [
    {
      command: "node tests/harness/build.cjs && node tests/native-auth-api.mjs",
      url: "http://127.0.0.1:4319/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 4320",
      url: "http://localhost:4320/sign-in",
      env: {
        BASE_URL: "http://127.0.0.1:4319",
        NEXT_TELEMETRY_DISABLED: "1",
        ADMIN_TEST_BUILD: "1",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
