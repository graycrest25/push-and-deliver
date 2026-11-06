import { test, expect, type Page } from "@playwright/test";
const control = (body: Record<string, unknown> = {}) =>
  fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.json());
async function coupons(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
  await page.goto("/coupons");
}
function action(page: Page, title: string) {
  return page
    .locator("details")
    .filter({
      has: page
        .locator("summary")
        .filter({ hasText: new RegExp(`^${title}$`) }),
    });
}
test.beforeEach(async () => {
  await control({ reset: true });
});
test("signup coupon pool loads current values, validates IDs, saves and refreshes; requeue refreshes jobs", async ({
  page,
}) => {
  await control({ membership: "regular" });
  await coupons(page);
  const pool = page.getByRole("region", { name: "Automatic signup coupons" });
  await pool.locator("summary").click();
  await expect(
    pool.getByLabel("Enable signup coupons", { exact: true }),
  ).toBeChecked();
  await expect(pool.getByLabel("Campaign IDs", { exact: true })).toHaveValue(
    "campaign-welcome",
  );
  await pool
    .getByLabel("Campaign IDs", { exact: true })
    .fill("campaign-1, campaign-1");
  await pool
    .getByRole("button", { name: "Save signup coupon settings", exact: true })
    .click();
  await expect(pool.getByRole("alert")).toContainText("distinct campaign IDs");
  await pool
    .getByLabel("Campaign IDs", { exact: true })
    .fill("campaign-1, campaign-2");
  await pool.getByLabel("Enable signup coupons", { exact: true }).uncheck();
  await pool
    .getByRole("button", { name: "Save signup coupon settings", exact: true })
    .click();
  await expect(pool.getByText(/Signup coupon settings saved/)).toBeVisible();
  const record = (await control()).records.find(
    (r: any) =>
      r.method === "PUT" && r.path === "/v1/admin/coupons/signup/settings",
  );
  expect(record.body).toEqual({
    enabled: false,
    campaign_ids: ["campaign-1", "campaign-2"],
  });
  expect(record.key).toBeTruthy();
  await expect(
    page.getByText("delivery_failed", { exact: true }),
  ).toBeVisible();
  const requeue = action(page, "Requeue dead signup work");
  await requeue.locator("summary").click();
  await requeue.getByLabel("Account ID *").fill("customer-1");
  await requeue
    .getByRole("button", { name: "Requeue dead signup work", exact: true })
    .click();
  await expect(
    page.getByText("processing_failed", { exact: true }),
  ).toHaveCount(0);
  expect(
    (await control()).records.find((r: any) =>
      r.path.endsWith("/customer-1/requeue"),
    ).body,
  ).toEqual({ queue: "issuance" });
  await expect(
    page.getByRole("region", { name: "Signup wallet bonus" }),
  ).toHaveCount(0);
});
test("super admins configure wallet signup amount and budget as scalar integers", async ({
  page,
}) => {
  await coupons(page);
  const section = page.getByRole("region", { name: "Signup wallet bonus" });
  await expect(section.getByText("₦100.00", { exact: true })).toBeVisible();
  const amount = action(page, "Set signup cash bonus");
  await amount.locator("summary").click();
  await expect(amount.getByLabel("Bonus (minor units) *")).toHaveValue("10000");
  await amount.getByLabel("Bonus (minor units) *").fill("20000");
  await amount
    .getByRole("button", { name: "Set signup cash bonus", exact: true })
    .click();
  await expect(section.getByText("₦200.00", { exact: true })).toBeVisible();
  const budget = action(page, "Set signup bonus budget");
  await budget.locator("summary").click();
  await expect(budget.getByLabel("Total budget (minor units) *")).toHaveValue(
    "",
  );
  await budget.getByLabel("Total budget (minor units) *").fill("500000");
  await budget
    .getByRole("button", { name: "Set signup bonus budget", exact: true })
    .click();
  await expect(budget.getByText(/Signup bonus budget saved/)).toBeVisible();
  const writes = (await control()).records.filter(
    (r: any) => r.method === "PUT",
  );
  expect(
    writes.find((r: any) => r.path.endsWith("/signup_bonus_minor")).body,
  ).toBe(20000);
  expect(
    writes.find((r: any) => r.path.endsWith("/signup_bonus_budget_minor")).body,
  ).toBe(500000);
  expect(
    writes.every(
      (r: any) => r.key && r.authorization === "Bearer access-private",
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/rewards-desktop.png",
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
    path: "test-results/rewards-mobile.png",
    fullPage: true,
  });
});
test("campaign creation and coupon grants use separate backend IDs without fabricating codes", async ({
  page,
}) => {
  await coupons(page);
  const campaign = action(page, "Create campaign");
  await campaign.locator("summary").click();
  await campaign.getByLabel("Name *", { exact: true }).fill("Welcome discount");
  await campaign.getByLabel("Discount (basis points) *").fill("1000");
  await campaign.getByLabel("Maximum discount (minor units) *").fill("50000");
  await campaign
    .getByLabel("Budget (minor units) *", { exact: true })
    .fill("10000000");
  await campaign.getByLabel("Maximum issuances *").fill("1000");
  await campaign
    .getByLabel("Starts at *")
    .fill(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  await campaign
    .getByLabel("Ends at *")
    .fill(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 16));
  await campaign
    .getByLabel("Validity in hours (0 = campaign end) *")
    .selectOption("24");
  await campaign
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await expect(campaign.getByText("campaign-1", { exact: true })).toBeVisible();
  const grant = action(page, "Grant coupon");
  await grant.locator("summary").click();
  await grant.getByLabel("Recipient account ID *").fill("customer-1");
  await grant.getByLabel("Campaign ID *").fill("campaign-1");
  await grant
    .getByRole("button", { name: "Grant coupon", exact: true })
    .click();
  await expect(grant.getByText("coupon-1", { exact: true })).toBeVisible();
  const records = (await control()).records;
  expect(
    records.find((r: any) => r.path === "/v1/admin/coupons/campaigns").body
      .valid_for_hours,
  ).toBe(24);
  expect(
    records.find((r: any) => r.path === "/v1/admin/coupons/grants").body,
  ).toEqual({ user_id: "customer-1", campaign_id: "campaign-1" });
  await expect(
    page.getByRole("link", { name: "open Referral links" }),
  ).toHaveAttribute("href", "/generated");
});
