import { test, expect, type Page } from "@playwright/test";
async function control(body: Record<string, unknown>) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
async function login(page: Page) {
  await control({ reset: true, latest: true, adminType: "super" });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
const riders = {
  type: "riders",
  total: 17,
  byVehicle: { 0: 10, 1: 1, 2: 6 },
  verified: { total: 9, byVehicle: { 0: 3, 1: 1, 2: 5 } },
  pending: { total: 8, byVehicle: { 0: 7, 1: 0, 2: 1 } },
  blocked: { total: 0, byVehicle: { 0: 0, 1: 0, 2: 0 } },
  calculatedAt: "2026-11-04T09:58:00Z",
};
test("overview account totals use readable vehicle rows, compact counts and responsive layout", async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  let reads = 0;
  let userSummary = {
    type: "users",
    total: 1200,
    newToday: 12,
    newThisWeek: 80,
    newLastWeek: 64,
    growthRate: 25,
    calculatedAt: riders.calculatedAt,
  };
  await page.route(
    "**/api/proxy/v1/admin/analytics/account-summary?*",
    (route) => {
      reads++;
      return route.fulfill({
        json: {
          data:
            new URL(route.request().url()).searchParams.get("type") === "riders"
              ? riders
              : userSummary,
        },
      });
    },
  );
  await page.goto("/dashboard");
  await page
    .getByRole("combobox", { name: /^Account summary/ })
    .selectOption("riders");
  const card = page.getByRole("region", {
    name: "Account totals",
    exact: true,
  });
  await expect(
    card.getByText("Riders by vehicle", { exact: true }),
  ).toBeVisible();
  expect(
    await card
      .getByRole("row", { name: /^Car/ })
      .locator("td")
      .allTextContents(),
  ).toEqual(["Car", "10", "3", "7", "0", "0"]);
  await expect(card.getByRole("row", { name: /^Bicycle/ })).toBeVisible();
  await expect(card.getByRole("row", { name: /^Motorbike/ })).toBeVisible();
  await expect(
    card.locator("dl").getByText("17", { exact: true }),
  ).toBeVisible();
  await expect(
    card.locator("dl").getByText("9", { exact: true }),
  ).toBeVisible();
  await expect(
    card.locator("dl").getByText("8", { exact: true }),
  ).toBeVisible();
  await expect(
    card.locator("dl").getByText("0", { exact: true }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await card.boundingBox())!.height).toBeLessThan(650);
  await page.screenshot({
    path: "test-results/account-summary-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: "test-results/account-summary-desktop-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 2142, height: 1200 });
  await page.screenshot({
    path: "test-results/account-summary-user-2142.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/account-summary-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const previous = reads;
  await card.getByRole("button", { name: "Refresh account totals" }).click();
  await expect.poll(() => reads).toBeGreaterThan(previous);
  await page
    .getByRole("combobox", { name: /^Account summary/ })
    .selectOption("users");
  await expect(
    card.locator("dl").getByText("1,200", { exact: true }),
  ).toBeVisible();
  await expect(card).toContainText("Week-over-week growth: +25%");
  await expect(card.getByRole("table")).toHaveCount(0);
  userSummary = {
    ...userSummary,
    total: 2415,
    newToday: 0,
    newThisWeek: 223,
    newLastWeek: 1510,
    growthRate: -85.2,
  };
  await card.getByRole("button", { name: "Refresh account totals" }).click();
  await expect(card).toContainText("-85.2%");
  await expect(card.locator(".analytics-growth")).toHaveAttribute(
    "data-tone",
    "danger",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.screenshot({
    path: "test-results/analytics-colors-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: "test-results/analytics-colors-desktop-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/analytics-colors-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("account summary errors and missing fields never become fake zero totals", async ({
  page,
}) => {
  await login(page);
  let unavailable = true;
  await page.route(
    "**/api/proxy/v1/admin/analytics/account-summary?*",
    (route) =>
      unavailable
        ? route.fulfill({
            status: 503,
            json: { error: { message: "Account summary unavailable" } },
          })
        : route.fulfill({
            json: { data: { ...riders, verified: {}, calculatedAt: null } },
          }),
  );
  await page.goto("/dashboard");
  await page
    .getByRole("combobox", { name: /^Account summary/ })
    .selectOption("riders");
  const card = page.getByRole("region", {
    name: "Account totals",
    exact: true,
  });
  await expect(card.getByRole("alert")).toContainText(
    "Account summary unavailable",
  );
  await expect(card.locator("dl")).toHaveCount(0);
  unavailable = false;
  await card.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    card
      .locator("dl > div")
      .filter({ hasText: "Verified" })
      .getByText("Unavailable", { exact: true }),
  ).toBeVisible();
  await expect(card).toContainText("Calculation time unavailable");
  await expect(card.getByRole("row", { name: /^Car/ })).toContainText(
    "Unavailable",
  );
});
