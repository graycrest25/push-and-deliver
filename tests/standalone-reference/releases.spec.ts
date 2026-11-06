import { test, expect, type Page } from "@playwright/test";
const control = (body: Record<string, unknown> = {}) =>
  fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.json());
async function openSettings(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
  await page.goto("/app-config");
  return page.getByRole("region", {
    name: "App release settings",
    exact: true,
  });
}
test.beforeEach(async () => {
  await control({ reset: true });
});
test("public mobile reads work without credentials while updates require authentication", async ({
  request,
}) => {
  const result = await request.get(
    "/api/proxy/v1/config/mobile?app=rider&platform=ios",
  );
  expect(result.status()).toBe(200);
  expect(await result.json()).toMatchObject({
    app: "rider",
    platform: "ios",
    minimum_version: "2.1.0",
  });
  expect((await control()).records.at(-1).authorization).toBeUndefined();
  const write = await request.put(
    "/api/proxy/v1/admin/config/mobile/rider/ios",
    { headers: { Origin: "http://localhost:4320" }, data: {} },
  );
  expect(write.status()).toBe(401);
});
test("regular admins read, prefill and replace all four user/rider release settings independently", async ({
  page,
}) => {
  await control({ membership: "regular" });
  const section = await openSettings(page);
  for (const [app, platform] of [
    ["user", "android"],
    ["user", "ios"],
    ["rider", "android"],
    ["rider", "ios"],
  ]) {
    await section.getByLabel("App", { exact: true }).selectOption(app);
    await section
      .getByLabel("Platform", { exact: true })
      .selectOption(platform);
    await section
      .locator("summary")
      .filter({ hasText: /^Save release settings$/ })
      .click();
    await expect(
      section.getByLabel("Minimum version *", { exact: true }),
    ).toHaveValue(app === "rider" ? "2.1.0" : "1.2.0");
    await expect(
      section.getByLabel("Support email", { exact: true }),
    ).toHaveValue("");
    await section
      .getByLabel("Minimum version *", { exact: true })
      .fill("1.9.0");
    await section
      .getByLabel("Latest version *", { exact: true })
      .fill("1.10.0");
    await section.getByLabel("App active", { exact: true }).uncheck();
    await section.getByLabel("Require an update", { exact: true }).uncheck();
    await section.getByLabel("Maintenance mode", { exact: true }).uncheck();
    await section
      .getByRole("button", { name: "Save release settings", exact: true })
      .click();
    await expect(
      section.getByRole("status").filter({ hasText: "Release settings saved" }),
    ).toContainText("Release settings saved");
    await expect(
      section.getByRole("button", { name: "Reload saved settings" }),
    ).toBeEnabled();
    const writes = (await control()).records.filter(
      (r: any) => r.method === "PUT",
    );
    const latest = writes.at(-1);
    expect(latest.path).toBe(`/v1/admin/config/mobile/${app}/${platform}`);
    expect(latest.body).toEqual({
      app_name: app === "user" ? "PushNDeliver" : "PushNDeliver Rider",
      minimum_version: "1.9.0",
      latest_version: "1.10.0",
      active: false,
      force_update: false,
      maintenance: false,
      support_email: "",
      head_office_address: "",
    });
    expect(latest.key).toBeTruthy();
    expect(new Set(writes.map((r: any) => r.key)).size).toBe(writes.length);
    expect(
      (await control()).records
        .filter((r: any) => r.path === "/v1/config/mobile")
        .every((r: any) => !r.authorization),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/releases-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await section.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/releases-mobile.png",
    fullPage: true,
  });
});
test("release validation uses numeric versions and byte limits, and retries retain the operation key", async ({
  page,
}) => {
  const section = await openSettings(page);
  await section
    .locator("summary")
    .filter({ hasText: /^Save release settings$/ })
    .click();
  const minimum = section.getByLabel("Minimum version *", { exact: true });
  const latest = section.getByLabel("Latest version *", { exact: true });
  const save = section.getByRole("button", {
    name: "Save release settings",
    exact: true,
  });
  await minimum.fill("01.2.0");
  await save.click();
  expect(
    await minimum.evaluate(
      (el: HTMLInputElement) => el.validity.patternMismatch,
    ),
  ).toBe(true);
  await minimum.fill("1.10.0");
  await latest.fill("1.9.0");
  await save.click();
  await expect(section.getByRole("alert")).toContainText("cannot be newer");
  await minimum.fill("1.9.0");
  await latest.fill("1.10.0");
  await section
    .getByLabel("Head office address", { exact: true })
    .fill("é".repeat(251));
  await save.click();
  await expect(section.getByRole("alert")).toContainText("500 UTF-8 bytes");
  expect(
    (await control()).records.filter((r: any) => r.method === "PUT"),
  ).toHaveLength(0);
  await section
    .getByLabel("Head office address", { exact: true })
    .fill("Lagos");
  await control({ failOnce: true });
  await save.click();
  await expect(section.getByRole("alert")).toContainText(
    "Please retry unchanged",
  );
  await save.click();
  await expect(
    section.getByRole("status").filter({ hasText: "Release settings saved" }),
  ).toContainText("Release settings saved");
  const writes = (await control()).records.filter(
    (r: any) => r.method === "PUT",
  );
  expect(writes).toHaveLength(2);
  expect(writes[0].key).toBe(writes[1].key);
  expect(writes[0].body).toEqual(writes[1].body);
});
test("missing release settings can be created but failed reads never offer an empty replacement", async ({
  page,
}) => {
  await control({ releaseMode: "error" });
  const section = await openSettings(page);
  await expect(section.getByRole("alert")).toContainText(
    "Release settings unavailable",
  );
  await expect(section.locator("summary")).toHaveCount(0);
  await control({ releaseMode: "missing" });
  await section.getByRole("button", { name: "Reload saved settings" }).click();
  await expect(
    section.getByText(/No release settings or global fallback exist/),
  ).toBeVisible();
  await section
    .locator("summary")
    .filter({ hasText: /^Save release settings$/ })
    .click();
  await section.getByLabel("App name *", { exact: true }).fill("PushNDeliver");
  await section.getByLabel("Minimum version *", { exact: true }).fill("1.0.0");
  await section.getByLabel("Latest version *", { exact: true }).fill("1.1.0");
  await section
    .getByRole("button", { name: "Save release settings", exact: true })
    .click();
  await expect(
    section.getByRole("status").filter({ hasText: "Release settings saved" }),
  ).toContainText("Release settings saved");
});
