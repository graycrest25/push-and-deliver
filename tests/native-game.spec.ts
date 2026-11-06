import { test, expect, type Page } from "@playwright/test";
import { sampleGameRules } from "./native-game-api.mjs";
async function control(body: Record<string, unknown> = {}) {
  return (
    await (
      await fetch("http://127.0.0.1:4319/control", {
        method: "POST",
        body: JSON.stringify(body),
      })
    ).json()
  ).data;
}
async function login(page: Page, role = "super") {
  await control({ game: true, latest: true, adminType: role });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
async function mutations() {
  return (await control()).records.filter(
    (row: any) => row.path === "/v1/admin/game/rules" && row.method === "PUT",
  );
}
async function openForm(container: Page | any, name: string) {
  const form = container.locator("details").filter({ hasText: name });
  await form.locator("summary").click();
  return form;
}
const alert = (page: Page) =>
  page.locator("#workspace-content").getByRole("alert");
test.beforeEach(() => control({ reset: true, game: true }));

test("super admin reads versioned rules, previews elapsed timing, saves and pauses exact editable fields", async ({
  page,
}) => {
  await login(page);
  await page.goto("/game-rules");
  await expect(page.getByLabel("Global active level")).toHaveValue("easy");
  await expect(page.getByLabel("Daily reward cap (UTC)")).toHaveValue("10");
  await expect(
    page.getByRole("region", { name: "Timing preview" }),
  ).toContainText("20,000 ms");
  await expect(
    page.getByRole("region", { name: "Timing preview" }),
  ).toContainText("19,800 ms–20,200 ms");
  await expect(page.getByText("Loaded configuration version: 3")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/game-rules-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: "test-results/game-rules-desktop-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 2142, height: 1200 });
  await page.screenshot({
    path: "test-results/game-rules-user-2142.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/game-rules-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByLabel("Suggested preset").selectOption("beginner");
  await page.getByRole("button", { name: "Apply preset to draft" }).click();
  expect(await mutations()).toHaveLength(0);
  await page.getByLabel("Easy speed multiplier").fill("0.05");
  await page.getByLabel("Easy tolerance (ms)").fill("1000");
  await page.getByLabel("Hard tolerance (ms)").fill("0");
  await page.getByLabel("Daily reward cap (UTC)").fill("25");
  await page.getByLabel("Rewards per player per UTC day").fill("2");
  await expect(
    page.getByRole("region", { name: "Timing preview" }),
  ).toContainText("200,000 ms");
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(
    page.getByText("Save accepted. Showing the current saved configuration."),
  ).toBeVisible();
  const first = (await mutations())[0];
  expect(Object.keys(first.body).sort()).toEqual([
    "activeLevel",
    "enabled",
    "expectedVersion",
    "levels",
    "maxRewardsPerDay",
    "maxRewardsPerUserDay",
  ]);
  expect(first.body).toMatchObject({
    expectedVersion: 3,
    enabled: true,
    maxRewardsPerDay: 25,
    maxRewardsPerUserDay: 2,
    levels: {
      easy: { speedMultiplier: 0.05, toleranceMilliseconds: 1000 },
      hard: { toleranceMilliseconds: 0 },
    },
  });
  expect(first.authorization).toBe("Bearer pnd_a2_private");
  expect(first.account).toBe("user");
  await page.getByRole("switch", { name: "Enable new attempts" }).click();
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect.poll(async () => (await mutations()).length).toBe(2);
  const pause = (await mutations())[1];
  expect(pause.body).toEqual({
    ...first.body,
    expectedVersion: 4,
    enabled: false,
  });
  expect(pause.key).not.toBe(first.key);
  const records = (await control()).records;
  expect(
    records.some(
      (row: any) =>
        row.path === "/v1/config" ||
        row.path === "/v1/admin/config/ten_seconds" ||
        row.path.startsWith("/v1/game/"),
    ),
  ).toBeFalsy();
});

for (const missing of [true, false])
  test(`${missing ? "missing" : "invalid"} rules require explicit setup and use the returned version`, async ({
    page,
  }) => {
    await login(page);
    await control({
      gameRules: null,
      gameInvalid: !missing,
      gameVersion: missing ? 0 : 7,
    });
    await page.goto("/game-rules");
    await expect(
      page.getByRole("button", { name: "Set up game rules" }),
    ).toBeVisible();
    await expect(page.getByLabel("Global active level")).toHaveCount(0);
    await page.getByRole("button", { name: "Set up game rules" }).click();
    await expect(
      page.getByText("Unsaved initial draft", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Enable new attempts" }),
    ).not.toBeChecked();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Easy speed multiplier").fill("0");
    await page.getByLabel("Medium tolerance (ms)").fill("0.5");
    await page.getByLabel("Daily reward cap (UTC)").fill("10001");
    await page.getByLabel("Rewards per player per UTC day").fill("6");
    await page
      .getByRole("button", { name: "Save game rules", exact: true })
      .click();
    await expect(alert(page)).toContainText("greater than 0");
    await expect(alert(page)).toContainText("1 to 10,000");
    await expect(
      page.getByRole("alert", { name: "Game rule validation errors" }),
    ).toBeFocused();
    expect(await mutations()).toHaveLength(0);
    await page.getByLabel("Easy speed multiplier").fill("0.5");
    await page.getByLabel("Medium tolerance (ms)").fill("0");
    await page.getByLabel("Daily reward cap (UTC)").fill("10000");
    await page.getByLabel("Rewards per player per UTC day").fill("5");
    await page
      .getByRole("button", { name: "Save game rules", exact: true })
      .click();
    await expect(
      page.getByText("Save accepted. Showing the current saved configuration."),
    ).toBeVisible();
    expect((await mutations())[0].body).toMatchObject({
      expectedVersion: missing ? 0 : 7,
      enabled: false,
      maxRewardsPerDay: 10000,
      maxRewardsPerUserDay: 5,
    });
  });

test("uncertain rule saves keep their exact version, body and key across refresh and replay", async ({
  page,
}) => {
  await login(page);
  await page.goto("/game-rules");
  await page.getByLabel("Daily reward cap (UTC)").fill("40");
  await control({ gameLoseResponse: true, expire: true });
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(alert(page)).toContainText("response lost");
  await expect(page.getByLabel("Daily reward cap (UTC)")).toBeDisabled();
  await control({
    gameRules: {
      ...sampleGameRules(),
      activeLevel: "hard",
      maxRewardsPerDay: 17,
    },
    gameVersion: 8,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry pending save" }),
  ).toBeVisible();
  await expect(page.getByLabel("Daily reward cap (UTC)")).toHaveValue("40");
  await page.getByRole("button", { name: "Retry pending save" }).click();
  await expect(
    page.getByText("Save accepted. Showing the current saved configuration."),
  ).toBeVisible();
  await expect(page.getByLabel("Daily reward cap (UTC)")).toHaveValue("17");
  await expect(page.getByLabel("Global active level")).toHaveValue("hard");
  const calls = await mutations();
  expect(calls).toHaveLength(2);
  expect(calls[1].rawBody).toBe(calls[0].rawBody);
  expect(calls[1].key).toBe(calls[0].key);
  expect(calls[1].body.expectedVersion).toBe(3);
});

test("restored rules drafts retain their base version and require review after another admin saves", async ({
  page,
}) => {
  await login(page);
  await page.goto("/game-rules");
  await page.getByLabel("Daily reward cap (UTC)").fill("20");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(sessionStorage).find(
          (key) => key.startsWith("pnd-game-rules:") && key.endsWith(":draft"),
        );
        return key
          ? JSON.parse(sessionStorage.getItem(key)!).baseVersion
          : null;
      }),
    )
    .toBe(3);
  await control({
    gameRules: {
      ...sampleGameRules(),
      activeLevel: "hard",
      maxRewardsPerDay: 17,
    },
    gameVersion: 4,
  });
  await page.reload();
  const review = page.getByRole("region", {
    name: "Review current game rules",
  });
  await expect(review).toContainText("4");
  await expect(page.getByLabel("Daily reward cap (UTC)")).toHaveValue("20");
  await expect(
    page.getByRole("button", { name: "Save game rules", exact: true }),
  ).toBeDisabled();
  expect(await mutations()).toHaveLength(0);
  await review
    .getByRole("button", { name: "Use latest version and review draft" })
    .click();
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(
    page.getByText("Save accepted. Showing the current saved configuration."),
  ).toBeVisible();
  expect((await mutations())[0].body).toMatchObject({
    expectedVersion: 4,
    maxRewardsPerDay: 20,
  });
});

test("stale rules preserve the draft and require review of the latest version before a new save", async ({
  page,
}) => {
  await login(page);
  await page.goto("/game-rules");
  await page.getByLabel("Daily reward cap (UTC)").fill("20");
  await control({
    gameRules: { ...sampleGameRules(), activeLevel: "hard" },
    gameVersion: 4,
  });
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(alert(page)).toContainText("saved game rules changed");
  await expect(
    page.getByRole("region", { name: "Review current game rules" }),
  ).toContainText("4");
  await expect(
    page.getByRole("button", { name: "Save game rules", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Daily reward cap (UTC)")).toHaveValue("20");
  await page
    .getByRole("button", { name: "Use latest version and review draft" })
    .click();
  await expect(page.getByLabel("Daily reward cap (UTC)")).toBeEnabled();
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(
    page.getByText("Save accepted. Showing the current saved configuration."),
  ).toBeVisible();
  const calls = await mutations();
  expect(calls[0].body.expectedVersion).toBe(3);
  expect(calls[1].body.expectedVersion).toBe(4);
  expect(calls[1].key).not.toBe(calls[0].key);
  await control({ gameRateLimit: true });
  await page.getByLabel("Daily reward cap (UTC)").fill("30");
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(alert(page)).toContainText("Too many saves");
  const retry = page.getByRole("button", { name: "Retry pending save" });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(
    page.getByText("Save accepted. Showing the current saved configuration."),
  ).toBeVisible();
  const limited = await mutations();
  expect(limited[3].key).toBe(limited[2].key);
  expect(limited[3].rawBody).toBe(limited[2].rawBody);
});

test("rule read failures and failed post-save readback remain distinct and recoverable", async ({
  page,
}) => {
  await login(page);
  await control({ gameReadFailure: true });
  await page.goto("/game-rules");
  await expect(alert(page)).toContainText("Game rules read unavailable");
  await expect(page.getByLabel("Global active level")).toHaveCount(0);
  await control({ gameReadFailure: false });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByLabel("Global active level")).toHaveValue("easy");
  await control({ gameReadbackFailure: true });
  await page.getByLabel("Daily reward cap (UTC)").fill("15");
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(
    page.getByText(/Save succeeded, but readback failed/),
  ).toBeVisible();
  await expect(page.getByLabel("Daily reward cap (UTC)")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Retry pending save" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reload saved settings" }).click();
  await expect(page.getByLabel("Daily reward cap (UTC)")).toHaveValue("15");
  await expect(page.getByLabel("Daily reward cap (UTC)")).toBeEnabled();
});

test("game campaigns use gameEligible and current native campaign versions", async ({
  page,
}) => {
  await login(page);
  await page.goto("/game-rules");
  const create = await openForm(page, "Create game reward campaign");
  await expect(create.getByLabel("Eligible for game rewards")).toBeChecked();
  await create.getByLabel("Campaign title").fill("Ten Seconds reward");
  await create.getByLabel("Discount (%)").fill("10");
  await create.getByLabel("Valid for (hours)").selectOption("48");
  await create.getByLabel("Courier", { exact: true }).check();
  await create.getByLabel("Express", { exact: true }).check();
  await control({ gameLoseResponse: true });
  await create
    .getByRole("button", { name: "Create game reward campaign", exact: true })
    .click();
  await expect(alert(page)).toContainText("response lost");
  await create
    .getByRole("button", { name: "Create game reward campaign", exact: true })
    .click();
  await expect(
    create.getByText("created-game-campaign", { exact: true }),
  ).toBeVisible();
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", {
      name: "created-game-campaign",
      exact: true,
    }),
  });
  await expect(row).toBeVisible();
  const latest = {
    id: "created-game-campaign",
    title: "Ten Seconds reward",
    percentageDiscount: 10,
    validForHours: 48,
    eligibleServices: ["courier", "express"],
    enabled: true,
    gameEligible: true,
    version: 7,
  };
  await control({ gameCampaigns: [latest] });
  const eligible = await openForm(row, "Remove from game rewards");
  await eligible
    .getByRole("button", { name: "Remove from game rewards", exact: true })
    .click();
  await expect(
    row.locator("summary").filter({ hasText: "Include in game rewards" }),
  ).toBeVisible();
  const disable = await openForm(row, "Disable campaign");
  await disable
    .getByRole("button", { name: "Disable campaign", exact: true })
    .click();
  await expect(
    row.locator("summary").filter({ hasText: "Enable campaign" }),
  ).toBeVisible();
  const records = (await control()).records;
  const creations = records.filter(
    (r: any) => r.path === "/v1/admin/coupons/campaigns" && r.method === "POST",
  );
  expect(creations).toHaveLength(2);
  expect(creations[1].key).toBe(creations[0].key);
  expect(creations[0].body).toEqual({
    title: "Ten Seconds reward",
    percentageDiscount: 10,
    validForHours: 48,
    eligibleServices: ["courier", "express"],
    enabled: true,
    gameEligible: true,
  });
  const statuses = records.filter((r: any) =>
    r.path.endsWith("/created-game-campaign/status"),
  );
  expect(statuses[0].body).toEqual({
    enabled: true,
    expectedVersion: 7,
    gameEligible: false,
  });
  expect(statuses[1].body).toEqual({ enabled: false, expectedVersion: 8 });
  expect(await mutations()).toHaveLength(0);
  await expect(
    page.getByRole("switch", { name: "Enable new attempts" }),
  ).toBeChecked();
});

test("version-zero campaigns can be included in game rewards and disabled", async ({
  page,
}) => {
  await login(page);
  await control({
    gameCampaigns: [
      {
        id: "version-zero-campaign",
        title: "Existing reward campaign",
        percentageDiscount: 10,
        validForHours: 24,
        eligibleServices: ["courier"],
        enabled: true,
        gameEligible: false,
        version: 0,
      },
    ],
  });
  await page.goto("/game-rules");
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "version-zero-campaign", exact: true }),
  });
  const include = await openForm(row, "Include in game rewards");
  await include
    .getByRole("button", { name: "Include in game rewards", exact: true })
    .click();
  await expect(
    row.locator("summary").filter({ hasText: "Remove from game rewards" }),
  ).toBeVisible();
  const disable = await openForm(row, "Disable campaign");
  await disable
    .getByRole("button", { name: "Disable campaign", exact: true })
    .click();
  await expect(
    row.locator("summary").filter({ hasText: "Enable campaign" }),
  ).toBeVisible();
  const writes = (await control()).records.filter((r: any) =>
    r.path.endsWith("/version-zero-campaign/status"),
  );
  expect(writes.map((r: any) => r.body)).toEqual([
    { enabled: true, expectedVersion: 0, gameEligible: true },
    { enabled: false, expectedVersion: 1 },
  ]);
});

for (const role of ["regular", "customercare", "verifier"])
  test(`${role} cannot open or bypass super-only game rule access`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(
      page.getByRole("link", { name: "Game rules", exact: true }),
    ).toHaveCount(0);
    await page.goto("/game-rules");
    await expect(page).not.toHaveURL(/game-rules/);
    const statuses = await page.evaluate(
      async (rules) =>
        Promise.all(
          [
            fetch("/api/proxy/v1/admin/game/rules"),
            fetch("/api/proxy/v1/admin/game/rules", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": crypto.randomUUID(),
              },
              body: JSON.stringify({ expectedVersion: 3, ...rules }),
            }),
          ].map(async (request) => (await request).status),
        ),
      sampleGameRules(),
    );
    expect(statuses).toEqual([403, 403]);
    expect(await mutations()).toHaveLength(0);
    if (role === "regular") {
      await page.goto("/coupons");
      const row = page.getByRole("row").filter({
        has: page.getByRole("cell", { name: "campaign-game-1", exact: true }),
      });
      const action = await openForm(row, "Remove from game rewards");
      await action
        .getByRole("button", { name: "Remove from game rewards", exact: true })
        .click();
      await expect(
        row.locator("summary").filter({ hasText: "Include in game rewards" }),
      ).toBeVisible();
    }
  });

test("retired endpoints are blocked and retained rules are isolated by environment and cleared on logout", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/proxy/v1/config")).status()).toBe(404);
  expect((await request.get("/api/proxy/v1/game/rules")).status()).toBe(404);
  await login(page);
  expect(
    (
      await page.request.put("/api/proxy/v1/admin/config/ten_seconds", {
        data: sampleGameRules(),
        headers: {
          Origin: "http://localhost:4320",
          "Idempotency-Key": "retired-game-command",
        },
      })
    ).status(),
  ).toBe(404);
  await page.goto("/game-rules");
  await page.getByLabel("Daily reward cap (UTC)").fill("40");
  await control({ gameLoseResponse: true });
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry pending save" }),
  ).toBeVisible();
  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage).filter(
      (key) =>
        key.startsWith("pnd-game-rules:admin-rules:") &&
        key.endsWith(":pending"),
    ),
  );
  expect(keys).toHaveLength(1);
  expect(keys[0]).toContain(":admin-1:");
  await page.route("**/api/proxy/v1/admin/game/rules", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          headers: { "x-config-environment": "other-environment" },
          json: {
            data: {
              configured: true,
              version: 9,
              configuration: {
                ...sampleGameRules(),
                maxRewardsPerDay: 20,
                version: 9,
                targetMilliseconds: 10000,
                maxAttempts: 5,
                cooldownSeconds: 86400,
              },
              reason: null,
              updatedAt: null,
            },
          },
        })
      : route.continue(),
  );
  await page.reload();
  await expect(page.getByLabel("Daily reward cap (UTC)")).toHaveValue("20");
  await expect(
    page.getByRole("button", { name: "Retry pending save" }),
  ).toHaveCount(0);
  await page.getByLabel("Daily reward cap (UTC)").fill("21");
  await page
    .getByRole("button", { name: "Save game rules", exact: true })
    .click();
  await expect(alert(page)).toContainText("API environment changed");
  expect(await mutations()).toHaveLength(1);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("pnd-game-rules:"),
      ),
    ),
  ).toHaveLength(0);
});
